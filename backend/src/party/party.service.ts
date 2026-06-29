import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { randomUUID } from 'crypto';
import { User } from '../users/entities/user.entity';
import { Friendship, FriendshipStatus } from '../users/entities/friendship.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AppGateway } from '../gateway/app.gateway';
import { MatchesService } from '../matches/matches.service';
import { TelegramNotifyService } from '../notifications/telegram-notify.service';

interface Party {
  id: string;
  leaderId: number;
  memberIds: number[]; // includes leader
  invites: number[];   // pending invited userIds
  createdAt: number;
}

const FREE_MAX = 3;
const PREMIUM_MAX = 5;

@Injectable()
export class PartyService {
  private parties = new Map<string, Party>();
  private userParty = new Map<number, string>();        // userId → partyId (members)
  private userInvites = new Map<number, Set<string>>(); // userId → set of partyIds inviting them

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Friendship) private friendshipRepo: Repository<Friendship>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    private gateway: AppGateway,
    private matchesService: MatchesService,
    private tgNotify: TelegramNotifyService,
  ) {}

  // ── helpers ────────────────────────────────────────────────────────────────
  private partyOf(userId: number): Party | null {
    const id = this.userParty.get(userId);
    return id ? this.parties.get(id) ?? null : null;
  }

  private async maxSizeForLeader(leaderId: number): Promise<number> {
    const u = await this.userRepo.findOne({ where: { id: leaderId } });
    return u?.isPremium ? PREMIUM_MAX : FREE_MAX;
  }

  private async areFriends(a: number, b: number): Promise<boolean> {
    const row = await this.friendshipRepo.findOne({
      where: [
        { userId: a, friendId: b, status: FriendshipStatus.ACCEPTED },
        { userId: b, friendId: a, status: FriendshipStatus.ACCEPTED },
      ],
    });
    return !!row;
  }

  /** Шлём «party_updated» всем участникам и приглашённым — клиент перезапросит /party. */
  private ping(party: Party, extra: number[] = []) {
    const targets = new Set<number>([...party.memberIds, ...party.invites, ...extra]);
    for (const uid of targets) this.gateway.emitToUser(uid, 'party_updated', { partyId: party.id });
  }

  private disband(party: Party) {
    for (const uid of party.memberIds) this.userParty.delete(uid);
    for (const uid of party.invites) this.userInvites.get(uid)?.delete(party.id);
    this.parties.delete(party.id);
  }

  // ── serialization ────────────────────────────────────────────────────────────
  private async userBrief(id: number) {
    const u = await this.userRepo.findOne({ where: { id } });
    return {
      id,
      nickname: u?.gameNickname || u?.firstName || `#${id}`,
      avatarUrl: u?.avatarUrl ?? null,
      elo: u?.elo ?? 1000,
      isVerified: u?.isVerified ?? false,
      online: this.gateway.isUserOnline(id),
    };
  }

  async getState(userId: number) {
    const party = this.partyOf(userId);
    const inviteIds = [...(this.userInvites.get(userId) ?? [])].filter((pid) => this.parties.has(pid));

    let serialized: any = null;
    if (party) {
      const maxSize = await this.maxSizeForLeader(party.leaderId);
      const members = await Promise.all(party.memberIds.map((id) => this.userBrief(id)));
      const invites = await Promise.all(party.invites.map((id) => this.userBrief(id)));
      serialized = {
        id: party.id,
        leaderId: party.leaderId,
        isLeader: party.leaderId === userId,
        maxSize,
        members: members.map((m) => ({ ...m, isLeader: m.id === party.leaderId })),
        invites,
      };
    }

    const invitations = await Promise.all(
      inviteIds.map(async (pid) => {
        const p = this.parties.get(pid)!;
        return { partyId: pid, leader: await this.userBrief(p.leaderId), size: p.memberIds.length };
      }),
    );

    return { party: serialized, invitations };
  }

  // ── actions ──────────────────────────────────────────────────────────────────
  async invite(leaderId: number, friendId: number) {
    if (leaderId === friendId) throw new BadRequestException('Нельзя пригласить себя');
    if (!(await this.areFriends(leaderId, friendId))) throw new BadRequestException('Можно приглашать только друзей');

    const friend = await this.userRepo.findOne({ where: { id: friendId } });
    if (!friend) throw new BadRequestException('Игрок не найден');
    if (friend.isBanned) throw new BadRequestException('Игрок заблокирован');
    if (this.userParty.has(friendId)) throw new BadRequestException('Игрок уже в отряде');

    // Получаем/создаём отряд лидера
    let party = this.partyOf(leaderId);
    if (party && party.leaderId !== leaderId) throw new BadRequestException('Приглашать может только лидер отряда');
    if (!party) {
      party = { id: randomUUID(), leaderId, memberIds: [leaderId], invites: [], createdAt: Date.now() };
      this.parties.set(party.id, party);
      this.userParty.set(leaderId, party.id);
    }

    const maxSize = await this.maxSizeForLeader(leaderId);
    if (party.memberIds.length + party.invites.length >= maxSize) throw new BadRequestException('Отряд заполнен');
    if (party.invites.includes(friendId)) throw new BadRequestException('Приглашение уже отправлено');

    party.invites.push(friendId);
    if (!this.userInvites.has(friendId)) this.userInvites.set(friendId, new Set());
    this.userInvites.get(friendId)!.add(party.id);

    const leader = await this.userRepo.findOne({ where: { id: leaderId } });
    this.gateway.emitToUser(friendId, 'party_invite', { partyId: party.id, fromId: leaderId });
    this.notifRepo.save(this.notifRepo.create({
      userId: friendId, type: 'party_invite',
      title: 'Приглашение в отряд',
      body: `${leader?.gameNickname || leader?.firstName || 'Игрок'} зовёт вас в отряд`,
      meta: { partyId: party.id, fromId: leaderId },
    })).catch(() => {});
    this.tgNotify.push(friendId, 'party_invite',
      `🤝 <b>${leader?.gameNickname || leader?.firstName || 'Игрок'}</b> зовёт тебя в отряд.`,
      { text: '👥 Открыть CONDR', webApp: true, path: '/dashboard' });

    this.ping(party);
    return this.getState(leaderId);
  }

  async accept(userId: number, partyId: string) {
    const party = this.parties.get(partyId);
    if (!party) throw new BadRequestException('Отряд больше не существует');
    if (!this.userInvites.get(userId)?.has(partyId)) throw new BadRequestException('Приглашение недействительно');

    // Покидаем текущий отряд, если был
    if (this.userParty.has(userId)) this.leaveInternal(userId);

    const maxSize = await this.maxSizeForLeader(party.leaderId);
    if (party.memberIds.length >= maxSize) throw new BadRequestException('Отряд уже заполнен');

    party.invites = party.invites.filter((id) => id !== userId);
    this.userInvites.get(userId)?.delete(partyId);
    party.memberIds.push(userId);
    this.userParty.set(userId, partyId);

    this.ping(party, [userId]);
    return this.getState(userId);
  }

  async decline(userId: number, partyId: string) {
    const party = this.parties.get(partyId);
    if (party) party.invites = party.invites.filter((id) => id !== userId);
    this.userInvites.get(userId)?.delete(partyId);
    if (party) this.ping(party, [userId]);
    return this.getState(userId);
  }

  private leaveInternal(userId: number): Party | null {
    const party = this.partyOf(userId);
    if (!party) return null;
    party.memberIds = party.memberIds.filter((id) => id !== userId);
    this.userParty.delete(userId);

    if (party.memberIds.length === 0) {
      this.disband(party);
      return party;
    }
    if (party.leaderId === userId) {
      party.leaderId = party.memberIds[0]; // передаём лидерство
    }
    return party;
  }

  async leave(userId: number) {
    const party = this.leaveInternal(userId);
    if (party) this.ping(party, [userId]);
    return this.getState(userId);
  }

  async kick(leaderId: number, targetId: number) {
    const party = this.partyOf(leaderId);
    if (!party || party.leaderId !== leaderId) throw new BadRequestException('Только лидер может исключать');
    if (targetId === leaderId) throw new BadRequestException('Нельзя исключить себя');
    if (!party.memberIds.includes(targetId)) throw new BadRequestException('Игрок не в отряде');
    party.memberIds = party.memberIds.filter((id) => id !== targetId);
    this.userParty.delete(targetId);
    this.ping(party, [targetId]);
    return this.getState(leaderId);
  }

  async cancelInvite(leaderId: number, targetId: number) {
    const party = this.partyOf(leaderId);
    if (!party || party.leaderId !== leaderId) throw new BadRequestException('Только лидер');
    party.invites = party.invites.filter((id) => id !== targetId);
    this.userInvites.get(targetId)?.delete(party.id);
    this.ping(party, [targetId]);
    return this.getState(leaderId);
  }

  /** Лидер запускает поиск всем отрядом. */
  async queue(leaderId: number) {
    const party = this.partyOf(leaderId);
    if (!party) throw new BadRequestException('Вы не в отряде');
    if (party.leaderId !== leaderId) throw new BadRequestException('Поиск запускает лидер');
    if (party.memberIds.length < 2) throw new BadRequestException('В отряде должно быть минимум 2 игрока');

    const offline = party.memberIds.filter((id) => !this.gateway.isUserOnline(id));
    if (offline.length) throw new BadRequestException('Не все участники онлайн');

    const match = await this.matchesService.joinLobbyAsParty([...party.memberIds]);
    return { matchId: match.id };
  }
}
