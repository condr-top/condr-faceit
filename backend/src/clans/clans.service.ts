import { Injectable, BadRequestException, NotFoundException, ForbiddenException, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Like, MoreThan, Between, LessThan } from 'typeorm';
import { Clan } from './entities/clan.entity';
import { ClanMember, ClanRole } from './entities/clan-member.entity';
import { ClanRequest } from './entities/clan-request.entity';
import { ClanMatch, ClanMatchStatus } from './entities/clan-match.entity';
import { ClanEvent, ClanEventType } from './entities/clan-event.entity';
import { ClanScrimListing, ScrimListingStatus } from './entities/clan-scrim-listing.entity';
import { ClanScrimResponse } from './entities/clan-scrim-response.entity';
import { ClanSeason } from './entities/clan-season.entity';
import { ClanSeasonResult } from './entities/clan-season-result.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AppGateway } from '../gateway/app.gateway';

const TAG_RE = /^[A-Za-z0-9]{2,5}$/;
const VALID_MAPS = ['PRISON', 'SANDSTONE', 'PROVINCE', 'BREEZE', 'HANAMI', 'RUST', 'DUNE'];
const CLAN_CREATION_COST = 4990;

@Injectable()
export class ClansService implements OnModuleInit {
  constructor(
    @InjectRepository(Clan) private clanRepo: Repository<Clan>,
    @InjectRepository(ClanMember) private memberRepo: Repository<ClanMember>,
    @InjectRepository(ClanRequest) private requestRepo: Repository<ClanRequest>,
    @InjectRepository(ClanMatch) private matchRepo: Repository<ClanMatch>,
    @InjectRepository(ClanEvent) private eventRepo: Repository<ClanEvent>,
    @InjectRepository(ClanScrimListing) private scrimRepo: Repository<ClanScrimListing>,
    @InjectRepository(ClanScrimResponse) private responseRepo: Repository<ClanScrimResponse>,
    @InjectRepository(ClanSeason) private seasonRepo: Repository<ClanSeason>,
    @InjectRepository(ClanSeasonResult) private seasonResultRepo: Repository<ClanSeasonResult>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    private gateway: AppGateway,
  ) {}

  // Realtime: оповестить участников клана (комната clan:{id}) о необходимости обновиться
  private emitClan(clanId: number, reason: string, payload: any = {}) {
    this.gateway.emitToClan(clanId, 'clan_update', { reason, ...payload });
  }
  private emitExchange(reason: string) {
    this.gateway.emitToExchange('exchange_update', { reason });
  }

  async onModuleInit() {
    // Гарантируем наличие активного сезона
    const active = await this.seasonRepo.findOne({ where: { status: 'active' } });
    if (!active) {
      const last = await this.seasonRepo.findOne({ where: {}, order: { number: 'DESC' } });
      const number = last ? last.number + 1 : 1;
      await this.seasonRepo.save(this.seasonRepo.create({
        number, name: `Сезон ${number}`, status: 'active', startedAt: new Date(),
      }));
    }
  }

  private async notify(userId: number, type: string, title: string, body: string, meta?: any) {
    await this.notifRepo.save(this.notifRepo.create({ userId, type, title, body, meta }));
  }

  private async memberOf(userId: number): Promise<ClanMember | null> {
    return this.memberRepo.findOne({ where: { userId } });
  }

  private async requireRole(clanId: number, userId: number, roles: ClanRole[]): Promise<ClanMember> {
    const m = await this.memberRepo.findOne({ where: { clanId, userId } });
    if (!m) throw new ForbiddenException('Вы не состоите в этом клане');
    if (!roles.includes(m.role)) throw new ForbiddenException('Недостаточно прав');
    return m;
  }

  private async position(clan: Clan): Promise<number> {
    const higher = await this.clanRepo.count({ where: { rating: MoreThan(clan.rating) } });
    return higher + 1;
  }

  private async memberDtos(clanId: number) {
    const members = await this.memberRepo.find({ where: { clanId }, order: { joinedAt: 'ASC' } });
    const ids = members.map((m) => m.userId);
    const users = ids.length ? await this.userRepo.findBy({ id: In(ids) }) : [];
    const uMap = Object.fromEntries(users.map((u) => [u.id, u]));
    const roleOrder: Record<ClanRole, number> = { leader: 0, officer: 1, member: 2 };
    return members
      .map((m) => {
        const u: User | undefined = uMap[m.userId];
        return {
          userId: m.userId,
          role: m.role,
          joinedAt: m.joinedAt,
          nickname: u?.gameNickname || u?.firstName || `Игрок ${m.userId}`,
          avatarUrl: u?.avatarUrl ?? null,
          elo: u?.elo ?? 1000,
          region: u?.region ?? null,
          isVerified: u?.isVerified ?? false,
        };
      })
      .sort((a, b) => roleOrder[a.role] - roleOrder[b.role] || b.elo - a.elo);
  }

  private async clanDetail(clan: Clan, viewerId?: number) {
    const memberCount = await this.memberRepo.count({ where: { clanId: clan.id } });
    const members = await this.memberDtos(clan.id);
    const pos = await this.position(clan);
    const decided = clan.wins + clan.losses;
    let myRole: ClanRole | null = null;
    if (viewerId) {
      const me = members.find((m) => m.userId === viewerId);
      myRole = me ? me.role : null;
    }
    const pendingRequests = (clan.leaderId === viewerId || myRole === 'leader' || myRole === 'officer')
      ? await this.requestRepo.count({ where: { clanId: clan.id, type: 'request', status: 'pending' } })
      : 0;
    return {
      id: clan.id,
      tag: clan.tag,
      name: clan.name,
      description: clan.description,
      avatarUrl: clan.avatarUrl,
      region: clan.region,
      language: clan.language,
      rating: clan.rating,
      wins: clan.wins,
      losses: clan.losses,
      winRate: decided > 0 ? Math.round((clan.wins / decided) * 1000) / 10 : 0,
      leaderId: clan.leaderId,
      createdAt: clan.createdAt,
      memberCount,
      position: pos,
      myRole,
      pendingRequests,
      members,
      recentMatches: await this.recentMatchDtos(clan.id, 5),
    };
  }

  // ── Уведомление штаба клана (лидер + офицеры) ───────────────────────────────
  private async notifyStaff(clanId: number, type: string, title: string, body: string, meta?: any, exceptUserId?: number) {
    const staff = await this.memberRepo.find({ where: [{ clanId, role: 'leader' }, { clanId, role: 'officer' }] });
    for (const s of staff) {
      if (s.userId === exceptUserId) continue;
      await this.notify(s.userId, type, title, body, meta);
    }
  }

  // ── DTO недавних / активных клановых матчей ──────────────────────────────────
  private async matchDto(m: ClanMatch, clanCache?: Map<number, Clan>) {
    const ids = [m.clanAId, m.clanBId];
    let clans: Clan[];
    if (clanCache) clans = ids.map((id) => clanCache.get(id)!).filter(Boolean);
    else clans = await this.clanRepo.findBy({ id: In(ids) });
    const cMap = new Map(clans.map((c) => [c.id, c]));
    const brief = (c?: Clan) => c ? { id: c.id, tag: c.tag, name: c.name, avatarUrl: c.avatarUrl, rating: c.rating } : null;
    return {
      id: m.id, mode: m.mode, status: m.status, map: m.map,
      scheduledAt: m.scheduledAt, createdBy: m.createdBy,
      clanA: brief(cMap.get(m.clanAId)), clanB: brief(cMap.get(m.clanBId)),
      scoreA: m.scoreA, scoreB: m.scoreB, winnerClanId: m.winnerClanId,
      ratingDelta: m.ratingDelta, season: m.season,
      createdAt: m.createdAt, completedAt: m.completedAt,
    };
  }

  private async recentMatchDtos(clanId: number, limit: number) {
    const ms = await this.matchRepo.find({
      where: [{ clanAId: clanId, status: 'completed' }, { clanBId: clanId, status: 'completed' }],
      order: { completedAt: 'DESC' }, take: limit,
    });
    return Promise.all(ms.map((m) => this.matchDto(m)));
  }

  // ── Создание ───────────────────────────────────────────────────────────────
  async createClan(userId: number, dto: { tag: string; name: string; description?: string; avatarUrl?: string; region?: string; language?: string }) {
    if (await this.memberOf(userId)) throw new BadRequestException('Вы уже состоите в клане');
    const tag = (dto.tag || '').trim();
    const name = (dto.name || '').trim();
    if (!TAG_RE.test(tag)) throw new BadRequestException('Тэг: 2–5 символов, латиница и цифры');
    if (name.length < 2 || name.length > 50) throw new BadRequestException('Название: от 2 до 50 символов');
    if ((dto.description ?? '').length > 500) throw new BadRequestException('Описание до 500 символов');
    const exists = await this.clanRepo.findOne({ where: { tag } });
    if (exists) throw new BadRequestException('Такой тэг уже занят');

    // Стоимость создания клана
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Пользователь не найден');
    if ((user.coins ?? 0) < CLAN_CREATION_COST) {
      throw new BadRequestException(`Недостаточно средств. Создание клана стоит ${CLAN_CREATION_COST} CONDR COIN`);
    }

    const clan = await this.clanRepo.save(this.clanRepo.create({
      tag, name,
      description: dto.description?.trim() || null,
      avatarUrl: dto.avatarUrl || null,
      region: dto.region || null,
      language: dto.language || null,
      leaderId: userId,
    }));
    // Списываем стоимость
    user.coins = (user.coins ?? 0) - CLAN_CREATION_COST;
    await this.userRepo.save(user);
    await this.memberRepo.save(this.memberRepo.create({ clanId: clan.id, userId, role: 'leader' }));
    // отзываем все висящие заявки игрока в другие кланы
    await this.requestRepo.update({ userId, status: 'pending' }, { status: 'rejected' });
    return this.clanDetail(clan, userId);
  }

  // ── Чтение ─────────────────────────────────────────────────────────────────
  async getMyClan(userId: number) {
    const m = await this.memberOf(userId);
    if (!m) return null;
    const clan = await this.clanRepo.findOne({ where: { id: m.clanId } });
    if (!clan) return null;
    return this.clanDetail(clan, userId);
  }

  async getClan(id: number, viewerId?: number) {
    const clan = await this.clanRepo.findOne({ where: { id } });
    if (!clan) throw new NotFoundException('Клан не найден');
    return this.clanDetail(clan, viewerId);
  }

  async listClans(opts: { q?: string; region?: string; language?: string; minRating?: number; minMembers?: number; sort?: 'rating' | 'members' | 'new' }) {
    const where: any = {};
    if (opts.region) where.region = opts.region;
    if (opts.language) where.language = opts.language;
    if (opts.minRating) where.rating = MoreThan(opts.minRating - 1);
    const order: any = opts.sort === 'new' ? { createdAt: 'DESC' } : { rating: 'DESC' };
    let clans: Clan[];
    if (opts.q) {
      const q = `%${opts.q}%`;
      clans = await this.clanRepo.find({
        where: [{ ...where, tag: Like(q) }, { ...where, name: Like(q) }],
        order, take: 120,
      });
    } else {
      clans = await this.clanRepo.find({ where, order, take: 120 });
    }
    let list = await this.mapList(clans);
    if (opts.minMembers) list = list.filter((c) => c.memberCount >= opts.minMembers!);
    if (opts.sort === 'members') list.sort((a, b) => b.memberCount - a.memberCount || b.rating - a.rating);
    return list.slice(0, 60);
  }

  async leaderboard() {
    const clans = await this.clanRepo.find({ order: { rating: 'DESC', id: 'ASC' }, take: 100 });
    const list = await this.mapList(clans);
    return list.map((c, i) => ({ ...c, rank: i + 1 }));
  }

  private async mapList(clans: Clan[]) {
    if (!clans.length) return [];
    const counts = await this.memberRepo
      .createQueryBuilder('m')
      .select('m.clan_id', 'cid')
      .addSelect('COUNT(*)', 'cnt')
      .where('m.clan_id IN (:...ids)', { ids: clans.map((c) => c.id) })
      .groupBy('m.clan_id')
      .getRawMany();
    const cMap = Object.fromEntries(counts.map((r) => [Number(r.cid), Number(r.cnt)]));
    return clans.map((c) => {
      const decided = c.wins + c.losses;
      return {
        id: c.id, tag: c.tag, name: c.name, avatarUrl: c.avatarUrl,
        region: c.region, language: c.language, rating: c.rating,
        wins: c.wins, losses: c.losses,
        matchesPlayed: decided,
        winRate: decided > 0 ? Math.round((c.wins / decided) * 1000) / 10 : 0,
        memberCount: cMap[c.id] ?? 0,
      };
    });
  }

  // ── Заявки / приглашения ───────────────────────────────────────────────────
  async requestJoin(userId: number, clanId: number) {
    if (await this.memberOf(userId)) throw new BadRequestException('Вы уже состоите в клане');
    const clan = await this.clanRepo.findOne({ where: { id: clanId } });
    if (!clan) throw new NotFoundException('Клан не найден');
    const existing = await this.requestRepo.findOne({ where: { clanId, userId, status: 'pending' } });
    if (existing) return existing;
    const req = await this.requestRepo.save(this.requestRepo.create({ clanId, userId, type: 'request' }));
    this.emitClan(clanId, 'request');
    return req;
  }

  async invite(actorId: number, clanId: number, targetUserId: number) {
    await this.requireRole(clanId, actorId, ['leader', 'officer']);
    if (await this.memberOf(targetUserId)) throw new BadRequestException('Игрок уже в клане');
    const existing = await this.requestRepo.findOne({ where: { clanId, userId: targetUserId, type: 'invite', status: 'pending' } });
    if (existing) return existing;
    const clan = await this.clanRepo.findOne({ where: { id: clanId } });
    const req = await this.requestRepo.save(this.requestRepo.create({ clanId, userId: targetUserId, type: 'invite' }));
    await this.notify(targetUserId, 'clan_invite', 'Приглашение в клан', `Клан [${clan?.tag}] ${clan?.name} приглашает вас вступить`, { clanId });
    return req;
  }

  async listRequests(clanId: number, actorId: number) {
    await this.requireRole(clanId, actorId, ['leader', 'officer']);
    const reqs = await this.requestRepo.find({ where: { clanId, type: 'request', status: 'pending' }, order: { createdAt: 'DESC' } });
    const ids = reqs.map((r) => r.userId);
    const users = ids.length ? await this.userRepo.findBy({ id: In(ids) }) : [];
    const uMap = Object.fromEntries(users.map((u) => [u.id, u]));
    return reqs.map((r) => {
      const u: User | undefined = uMap[r.userId];
      return { id: r.id, userId: r.userId, createdAt: r.createdAt, nickname: u?.gameNickname || u?.firstName || `Игрок ${r.userId}`, avatarUrl: u?.avatarUrl ?? null, elo: u?.elo ?? 1000 };
    });
  }

  // Игрок отвечает на приглашение / лидер-офицер обрабатывает заявку
  async respondRequest(actorId: number, requestId: number, accept: boolean) {
    const req = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!req || req.status !== 'pending') throw new NotFoundException('Заявка не найдена');
    const clan = await this.clanRepo.findOne({ where: { id: req.clanId } });
    if (!clan) throw new NotFoundException('Клан не найден');

    if (req.type === 'invite') {
      // отвечает приглашённый игрок
      if (req.userId !== actorId) throw new ForbiddenException('Это приглашение не вам');
    } else {
      // заявку на вступление обрабатывает лидер/офицер
      await this.requireRole(req.clanId, actorId, ['leader', 'officer']);
    }

    req.status = accept ? 'accepted' : 'rejected';
    await this.requestRepo.save(req);

    if (accept) {
      if (await this.memberOf(req.userId)) throw new BadRequestException('Игрок уже в клане');
      await this.memberRepo.save(this.memberRepo.create({ clanId: req.clanId, userId: req.userId, role: 'member' }));
      // отклоняем остальные заявки этого игрока
      await this.requestRepo.update({ userId: req.userId, status: 'pending' }, { status: 'rejected' });
      await this.notify(req.userId, 'clan_joined', 'Вы в клане!', `Вы вступили в клан [${clan.tag}] ${clan.name}`, { clanId: clan.id });
      this.emitClan(clan.id, 'member_joined');
    } else {
      this.emitClan(clan.id, 'request');
    }
    return { ok: true };
  }

  // ── Управление участниками ─────────────────────────────────────────────────
  async kick(actorId: number, clanId: number, targetUserId: number) {
    const actor = await this.requireRole(clanId, actorId, ['leader', 'officer']);
    if (targetUserId === actorId) throw new BadRequestException('Нельзя исключить себя');
    const target = await this.memberRepo.findOne({ where: { clanId, userId: targetUserId } });
    if (!target) throw new NotFoundException('Участник не найден');
    if (target.role === 'leader') throw new ForbiddenException('Нельзя исключить главу');
    if (actor.role === 'officer' && target.role === 'officer') throw new ForbiddenException('Офицер не может исключать офицеров');
    await this.memberRepo.delete({ id: target.id });
    const clan = await this.clanRepo.findOne({ where: { id: clanId } });
    await this.notify(targetUserId, 'clan_kicked', 'Исключение из клана', `Вы были исключены из клана [${clan?.tag}]`, { clanId });
    this.emitClan(clanId, 'member_kicked'); this.gateway.emitToUser(targetUserId, 'clan_update', { reason: 'kicked' });
    return { ok: true };
  }

  async setOfficer(actorId: number, clanId: number, targetUserId: number, value: boolean) {
    await this.requireRole(clanId, actorId, ['leader']);
    const target = await this.memberRepo.findOne({ where: { clanId, userId: targetUserId } });
    if (!target) throw new NotFoundException('Участник не найден');
    if (target.role === 'leader') throw new BadRequestException('Это глава клана');
    target.role = value ? 'officer' : 'member';
    await this.memberRepo.save(target);
    if (value) {
      const clan = await this.clanRepo.findOne({ where: { id: clanId } });
      await this.notify(targetUserId, 'clan_officer', 'Вы — Со-Лидер', `Вас назначили Со-Лидером клана [${clan?.tag}]`, { clanId });
    }
    this.emitClan(clanId, 'roles');
    return { ok: true };
  }

  async transferLeadership(actorId: number, clanId: number, targetUserId: number) {
    await this.requireRole(clanId, actorId, ['leader']);
    const target = await this.memberRepo.findOne({ where: { clanId, userId: targetUserId } });
    if (!target) throw new NotFoundException('Участник не найден');
    const me = await this.memberRepo.findOne({ where: { clanId, userId: actorId } });
    if (me) { me.role = 'officer'; await this.memberRepo.save(me); }
    target.role = 'leader';
    await this.memberRepo.save(target);
    await this.clanRepo.update({ id: clanId }, { leaderId: targetUserId });
    this.emitClan(clanId, 'roles');
    return { ok: true };
  }

  async leave(userId: number) {
    const m = await this.memberOf(userId);
    if (!m) throw new BadRequestException('Вы не состоите в клане');
    if (m.role === 'leader') {
      const count = await this.memberRepo.count({ where: { clanId: m.clanId } });
      if (count > 1) throw new BadRequestException('Передайте лидерство перед выходом или распустите клан');
      // последний участник — распускаем клан
      await this.disband(userId, m.clanId);
      return { ok: true, disbanded: true };
    }
    await this.memberRepo.delete({ id: m.id });
    this.emitClan(m.clanId, 'member_left');
    return { ok: true };
  }

  async updateClan(actorId: number, clanId: number, dto: { name?: string; description?: string; avatarUrl?: string; region?: string; language?: string }) {
    await this.requireRole(clanId, actorId, ['leader']);
    const clan = await this.clanRepo.findOne({ where: { id: clanId } });
    if (!clan) throw new NotFoundException('Клан не найден');
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (name.length < 2 || name.length > 50) throw new BadRequestException('Название: от 2 до 50 символов');
      clan.name = name;
    }
    if (dto.description !== undefined) {
      if (dto.description.length > 500) throw new BadRequestException('Описание до 500 символов');
      clan.description = dto.description.trim() || null;
    }
    if (dto.avatarUrl !== undefined) clan.avatarUrl = dto.avatarUrl || null;
    if (dto.region !== undefined) clan.region = dto.region || null;
    if (dto.language !== undefined) clan.language = dto.language || null;
    await this.clanRepo.save(clan);
    return this.clanDetail(clan, actorId);
  }

  async disband(actorId: number, clanId: number) {
    await this.requireRole(clanId, actorId, ['leader']);
    // Завершённые матчи остаёмся в истории; активные вызовы отменяем.
    await this.matchRepo.update(
      [
        { clanAId: clanId, status: In(['pending', 'accepted', 'awaiting_confirm', 'disputed'] as ClanMatchStatus[]) },
        { clanBId: clanId, status: In(['pending', 'accepted', 'awaiting_confirm', 'disputed'] as ClanMatchStatus[]) },
      ],
      { status: 'cancelled' },
    );
    await this.memberRepo.delete({ clanId });
    await this.requestRepo.delete({ clanId });
    await this.clanRepo.delete({ id: clanId });
    return { ok: true, disbanded: true };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  КЛАНОВЫЕ БОИ
  // ════════════════════════════════════════════════════════════════════════════

  /** Стандартный Elo: ожидание победы me против opp. */
  private expected(me: number, opp: number): number {
    return 1 / (1 + Math.pow(10, (opp - me) / 400));
  }

  /**
   * Изменение рейтинга клана за матч (симметрично: победитель +X, проигравший −X).
   * База ±30, коррекция от разницы рейтингов:
   *  — равны → 30
   *  — победитель слабее (андердог): 1–200 → 31..44, 201+ → 45
   *  — победитель сильнее (фаворит):  1–200 → 29..16, 201+ → 15
   */
  private clanRatingDelta(winnerRating: number, loserRating: number): number {
    const diff = winnerRating - loserRating;
    if (diff === 0) return 30;
    if (diff < 0) {
      // андердог победил
      if (Math.abs(diff) >= 201) return 45;
      return 30 + Math.ceil((Math.abs(diff) / 200) * 14); // 31..44
    }
    // фаворит победил
    if (diff >= 201) return 15;
    return 30 - Math.ceil((diff / 200) * 14); // 29..16
  }

  private async myClanIdOrThrow(userId: number): Promise<number> {
    const m = await this.memberOf(userId);
    if (!m) throw new BadRequestException('Вы не состоите в клане');
    return m.clanId;
  }

  // Создать вызов другому клану (лидер/офицер)
  async createChallenge(actorId: number, dto: { opponentClanId: number; map?: string; scheduledAt?: string }) {
    const myClanId = await this.myClanIdOrThrow(actorId);
    await this.requireRole(myClanId, actorId, ['leader', 'officer']);
    const oppId = Number(dto.opponentClanId);
    if (!oppId || oppId === myClanId) throw new BadRequestException('Выберите клан-соперника');
    const opp = await this.clanRepo.findOne({ where: { id: oppId } });
    if (!opp) throw new NotFoundException('Клан-соперник не найден');
    if (dto.map && !VALID_MAPS.includes(dto.map)) throw new BadRequestException('Неизвестная карта');

    // нет ли уже активного боя между этими кланами
    const active: ClanMatchStatus[] = ['pending', 'accepted', 'awaiting_confirm', 'disputed'];
    const dup = await this.matchRepo.findOne({
      where: [
        { clanAId: myClanId, clanBId: oppId, status: In(active) },
        { clanAId: oppId, clanBId: myClanId, status: In(active) },
      ],
    });
    if (dup) throw new BadRequestException('С этим кланом уже есть активный бой или вызов');

    const match = await this.matchRepo.save(this.matchRepo.create({
      mode: 'clan_battle',
      clanAId: myClanId, clanBId: oppId,
      status: 'pending',
      map: dto.map || null,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
      createdBy: actorId,
      season: await this.currentSeasonNumber(),
    }));
    const me = await this.clanRepo.findOne({ where: { id: myClanId } });
    await this.notifyStaff(oppId, 'clan_challenge', 'Вызов на клановый бой', `Клан [${me?.tag}] вызывает вас на клановый бой`, { matchId: match.id, clanId: myClanId });
    this.emitClan(oppId, 'challenge'); this.emitClan(myClanId, 'challenge');
    return this.matchDto(match);
  }

  // Соперник принимает / отклоняет вызов
  async respondChallenge(actorId: number, matchId: number, accept: boolean) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match || match.status !== 'pending') throw new NotFoundException('Вызов не найден');
    await this.requireRole(match.clanBId, actorId, ['leader', 'officer']);
    match.status = accept ? 'accepted' : 'rejected';
    await this.matchRepo.save(match);
    const opp = await this.clanRepo.findOne({ where: { id: match.clanBId } });
    await this.notifyStaff(match.clanAId, accept ? 'clan_challenge_accepted' : 'clan_challenge_rejected',
      accept ? 'Вызов принят' : 'Вызов отклонён',
      `Клан [${opp?.tag}] ${accept ? 'принял ваш вызов' : 'отклонил ваш вызов'}`,
      { matchId: match.id });
    this.emitClan(match.clanAId, 'challenge_response'); this.emitClan(match.clanBId, 'challenge_response');
    return this.matchDto(match);
  }

  // Создатель отменяет вызов до принятия
  async cancelChallenge(actorId: number, matchId: number) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Бой не найден');
    if (!['pending', 'accepted'].includes(match.status)) throw new BadRequestException('Этот бой уже нельзя отменить');
    await this.requireRole(match.clanAId, actorId, ['leader', 'officer']);
    match.status = 'cancelled';
    await this.matchRepo.save(match);
    this.emitClan(match.clanAId, 'challenge_cancelled'); this.emitClan(match.clanBId, 'challenge_cancelled');
    return this.matchDto(match);
  }

  // Сообщить / подтвердить счёт. scoreA и scoreB — счёт clanA и clanB соответственно.
  async reportResult(actorId: number, matchId: number, scoreA: number, scoreB: number) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Бой не найден');
    if (!['accepted', 'awaiting_confirm', 'disputed'].includes(match.status)) {
      throw new BadRequestException('Счёт можно сообщить только для принятого боя');
    }
    const myClanId = await this.myClanIdOrThrow(actorId);
    const isA = myClanId === match.clanAId;
    const isB = myClanId === match.clanBId;
    if (!isA && !isB) throw new ForbiddenException('Ваш клан не участвует в этом бою');
    await this.requireRole(myClanId, actorId, ['leader', 'officer']);

    const a = Math.max(0, Math.floor(Number(scoreA)));
    const b = Math.max(0, Math.floor(Number(scoreB)));
    if (a === b) throw new BadRequestException('В клановом бою не может быть ничьей');
    if (a > 50 || b > 50) throw new BadRequestException('Некорректный счёт');

    if (isA) { match.reportAScoreA = a; match.reportAScoreB = b; }
    else { match.reportBScoreA = a; match.reportBScoreB = b; }

    const haveBoth = match.reportAScoreA != null && match.reportBScoreA != null;
    if (haveBoth) {
      const agree = match.reportAScoreA === match.reportBScoreA && match.reportAScoreB === match.reportBScoreB;
      if (agree) {
        await this.completeMatch(match, match.reportAScoreA!, match.reportAScoreB!);
        return this.matchDto(match);
      }
      match.status = 'disputed';
      await this.matchRepo.save(match);
      await this.notifyStaff(match.clanAId, 'clan_match_disputed', 'Спор по счёту', 'Кланы сообщили разный счёт. Перепроверьте и отправьте снова.', { matchId: match.id });
      await this.notifyStaff(match.clanBId, 'clan_match_disputed', 'Спор по счёту', 'Кланы сообщили разный счёт. Перепроверьте и отправьте снова.', { matchId: match.id });
      this.emitClan(match.clanAId, 'match_disputed'); this.emitClan(match.clanBId, 'match_disputed');
      return this.matchDto(match);
    }

    match.status = 'awaiting_confirm';
    await this.matchRepo.save(match);
    // уведомляем штаб клана-соперника, что нужно подтвердить счёт
    const otherClan = isA ? match.clanBId : match.clanAId;
    await this.notifyStaff(otherClan, 'clan_match_report', 'Подтвердите счёт', `Соперник сообщил счёт ${a}:${b}. Подтвердите или отправьте свой.`, { matchId: match.id });
    this.emitClan(match.clanAId, 'match_report'); this.emitClan(match.clanBId, 'match_report');
    return this.matchDto(match);
  }

  private async completeMatch(match: ClanMatch, scoreA: number, scoreB: number) {
    const [clanA, clanB] = await Promise.all([
      this.clanRepo.findOne({ where: { id: match.clanAId } }),
      this.clanRepo.findOne({ where: { id: match.clanBId } }),
    ]);
    match.scoreA = scoreA;
    match.scoreB = scoreB;
    match.status = 'completed';
    match.completedAt = new Date();

    const aWon = scoreA > scoreB;
    match.winnerClanId = aWon ? match.clanAId : match.clanBId;

    if (clanA && clanB && match.mode === 'clan_battle') {
      match.clanARatingBefore = clanA.rating;
      match.clanBRatingBefore = clanB.rating;
      const winnerRating = aWon ? clanA.rating : clanB.rating;
      const loserRating = aWon ? clanB.rating : clanA.rating;
      const delta = this.clanRatingDelta(winnerRating, loserRating); // симметрично: +delta / −delta
      if (aWon) { clanA.rating = Math.max(100, clanA.rating + delta); clanB.rating = Math.max(100, clanB.rating - delta); }
      else { clanB.rating = Math.max(100, clanB.rating + delta); clanA.rating = Math.max(100, clanA.rating - delta); }
      if (aWon) { clanA.wins += 1; clanB.losses += 1; } else { clanB.wins += 1; clanA.losses += 1; }
      match.ratingDelta = delta;
      await this.clanRepo.save([clanA, clanB]);
    }
    await this.matchRepo.save(match);

    const winnerTag = aWon ? clanA?.tag : clanB?.tag;
    const delta = match.ratingDelta ?? 0;
    await this.notifyStaff(match.clanAId, 'clan_match_result', 'Результат кланового боя', `Счёт ${scoreA}:${scoreB}. ${aWon ? `Победа! +${delta} рейтинга` : `Поражение. −${delta} рейтинга`}`, { matchId: match.id });
    await this.notifyStaff(match.clanBId, 'clan_match_result', 'Результат кланового боя', `Счёт ${scoreA}:${scoreB}. ${!aWon ? `Победа! +${delta} рейтинга` : `Поражение. −${delta} рейтинга`}`, { matchId: match.id });
    this.emitClan(match.clanAId, 'match_completed'); this.emitClan(match.clanBId, 'match_completed');
  }

  // Клан пользователя (id) или null
  async clanIdOfUser(userId: number): Promise<number | null> {
    const m = await this.memberOf(userId);
    return m?.clanId ?? null;
  }

  // Проверка ростера для кланового подбора: actor — лидер/со-лидер, ровно 5 игроков того же клана
  async validateRoster(actorId: number, memberIds: number[]): Promise<{ clanId: number; roster: number[] }> {
    const clanId = await this.myClanIdOrThrow(actorId);
    await this.requireRole(clanId, actorId, ['leader', 'officer']);
    const roster = [...new Set(memberIds.map(Number).filter(Boolean))];
    if (roster.length !== 5) throw new BadRequestException('В составе должно быть ровно 5 игроков');
    const members = await this.memberRepo.find({ where: { clanId, userId: In(roster) } });
    if (members.length !== 5) throw new BadRequestException('Все игроки состава должны быть участниками клана');
    return { clanId, roster };
  }

  async clanBrief(clanId: number) {
    const c = await this.clanRepo.findOne({ where: { id: clanId } });
    return c ? { id: c.id, tag: c.tag, name: c.name, avatarUrl: c.avatarUrl, rating: c.rating } : null;
  }

  /**
   * Записать результат завершённого кланового боя 5x5 (матч идёт через обычный Match
   * пайплайн в MatchesService; сюда передаётся итог). Обновляет рейтинг кланов по
   * симметричной формуле и пишет запись в историю (ClanMatch). Праки сюда НЕ попадают.
   */
  async recordClanMatchResult(input: { clanAId: number; clanBId: number; scoreA: number; scoreB: number; map: string | null }) {
    const { clanAId, clanBId, scoreA, scoreB, map } = input;
    if (scoreA === scoreB) return null; // ничьих в клановом бою нет
    const [clanA, clanB] = await Promise.all([
      this.clanRepo.findOne({ where: { id: clanAId } }),
      this.clanRepo.findOne({ where: { id: clanBId } }),
    ]);
    if (!clanA || !clanB) return null;

    const aWon = scoreA > scoreB;
    const winnerRating = aWon ? clanA.rating : clanB.rating;
    const loserRating = aWon ? clanB.rating : clanA.rating;
    const delta = this.clanRatingDelta(winnerRating, loserRating);
    const aBefore = clanA.rating, bBefore = clanB.rating;
    if (aWon) { clanA.rating = Math.max(100, clanA.rating + delta); clanB.rating = Math.max(100, clanB.rating - delta); clanA.wins++; clanB.losses++; }
    else { clanB.rating = Math.max(100, clanB.rating + delta); clanA.rating = Math.max(100, clanA.rating - delta); clanB.wins++; clanA.losses++; }
    await this.clanRepo.save([clanA, clanB]);

    const rec = await this.matchRepo.save(this.matchRepo.create({
      mode: 'clan_battle',
      clanAId, clanBId,
      status: 'completed',
      map: map || null,
      scoreA, scoreB,
      winnerClanId: aWon ? clanAId : clanBId,
      clanARatingBefore: aBefore, clanBRatingBefore: bBefore,
      ratingDelta: delta,
      season: await this.currentSeasonNumber(),
      createdBy: 0,
      completedAt: new Date(),
    }));
    this.emitClan(clanAId, 'match_completed'); this.emitClan(clanBId, 'match_completed');
    return { ratingDelta: delta, winnerClanId: aWon ? clanAId : clanBId, recordId: rec.id };
  }

  // Активные бои/вызовы клана (для штаба и состава)
  // Гасим праки, у которых тайминг уже прошёл, а матч так и не начался.
  // Прак считается несостоявшимся: mode=scrim, status=accepted, время прошло (+ грейс), нет live-матча.
  async expireStaleScrims(): Promise<number> {
    const GRACE_MS = 10 * 60 * 1000; // 10 минут после назначенного времени
    const cutoff = new Date(Date.now() - GRACE_MS);
    const res = await this.matchRepo
      .createQueryBuilder()
      .update(ClanMatch)
      .set({ status: 'cancelled' as ClanMatchStatus })
      .where('mode = :mode', { mode: 'scrim' })
      .andWhere('status = :st', { st: 'accepted' })
      .andWhere('match_id IS NULL')
      .andWhere('scheduled_at IS NOT NULL')
      .andWhere('scheduled_at < :cutoff', { cutoff })
      .execute();
    return res.affected ?? 0;
  }

  @Cron('0 */2 * * * *') // каждые 2 минуты
  async cronExpireStaleScrims() {
    try { await this.expireStaleScrims(); } catch {}
  }

  async listMatches(actorId: number, clanId: number) {
    const clan = await this.clanRepo.findOne({ where: { id: clanId } });
    if (!clan) throw new NotFoundException('Клан не найден');
    await this.expireStaleScrims(); // мгновенно убираем просроченные праки при открытии
    const active: ClanMatchStatus[] = ['pending', 'accepted', 'awaiting_confirm', 'disputed'];
    const rows = await this.matchRepo.find({
      where: [
        { clanAId: clanId, status: In(active) },
        { clanBId: clanId, status: In(active) },
      ],
      order: { createdAt: 'DESC' },
    });
    const dtos = await Promise.all(rows.map((m) => this.matchDto(m)));
    // направление вызова относительно запрашивающего клана
    return dtos.map((d) => ({ ...d, isIncoming: d.status === 'pending' && d.clanB?.id === clanId, isOutgoing: d.status === 'pending' && d.clanA?.id === clanId }));
  }

  // История завершённых боёв клана
  async matchHistory(clanId: number, offset = 0, limit = 30) {
    const rows = await this.matchRepo.find({
      where: [{ clanAId: clanId, status: 'completed' }, { clanBId: clanId, status: 'completed' }],
      order: { completedAt: 'DESC' }, skip: offset, take: Math.min(limit, 50),
    });
    return Promise.all(rows.map((m) => this.matchDto(m)));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  КАЛЕНДАРЬ
  // ════════════════════════════════════════════════════════════════════════════

  // Объединённый календарь: ручные события клана + клановые бои с назначенным временем.
  async calendar(clanId: number, fromISO?: string, toISO?: string) {
    const clan = await this.clanRepo.findOne({ where: { id: clanId } });
    if (!clan) throw new NotFoundException('Клан не найден');
    const from = fromISO ? new Date(fromISO) : new Date(Date.now() - 31 * 86400_000);
    const to = toISO ? new Date(toISO) : new Date(Date.now() + 92 * 86400_000);

    const events = await this.eventRepo.find({
      where: { clanId, startsAt: Between(from, to) },
      order: { startsAt: 'ASC' },
    });

    // клановые бои с назначенным временем (назначенные/идущие/завершённые)
    const matchStatuses: ClanMatchStatus[] = ['accepted', 'awaiting_confirm', 'disputed', 'completed'];
    const matches = await this.matchRepo.find({
      where: [
        { clanAId: clanId, status: In(matchStatuses) },
        { clanBId: clanId, status: In(matchStatuses) },
      ],
      order: { scheduledAt: 'ASC' },
    });
    const oppIds = new Set<number>();
    matches.forEach((m) => oppIds.add(m.clanAId === clanId ? m.clanBId : m.clanAId));
    const opps = oppIds.size ? await this.clanRepo.findBy({ id: In([...oppIds]) }) : [];
    const oppMap = new Map(opps.map((c) => [c.id, c]));

    const eventItems = events.map((e) => ({
      kind: 'event' as const,
      id: e.id, type: e.type, title: e.title, description: e.description,
      startsAt: e.startsAt, endsAt: e.endsAt, createdBy: e.createdBy,
      opponentTag: e.opponentTag, lobbyHost: e.lobbyHost, opponentExtId: e.opponentExtId,
      format: e.format, maps: e.maps,
    }));

    const matchItems = matches
      .filter((m) => m.scheduledAt) // только с временем — попадают в календарь
      .map((m) => {
        const oppId = m.clanAId === clanId ? m.clanBId : m.clanAId;
        const opp = oppMap.get(oppId);
        return {
          kind: 'match' as const,
          id: m.id, matchId: m.id, type: 'clan_battle',
          title: opp ? `Бой vs [${opp.tag}]` : 'Клановый бой',
          opponentTag: opp?.tag ?? null, opponentName: opp?.name ?? null,
          map: m.map, status: m.status,
          startsAt: m.scheduledAt as Date, endsAt: null,
        };
      });

    return [...eventItems, ...matchItems].sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }

  private cleanMaps(maps?: string[]): string[] {
    if (!Array.isArray(maps)) return [];
    // 'LOBBY' — спец-значение «в лобби» (вместо выбора карты) для турниров
    return maps.filter((m) => m === 'LOBBY' || VALID_MAPS.includes(m)).slice(0, 5);
  }

  async createEvent(actorId: number, clanId: number, dto: any) {
    await this.requireRole(clanId, actorId, ['leader', 'officer']);
    const title = (dto.title || '').trim();
    if (title.length < 2 || title.length > 100) throw new BadRequestException('Название события: от 2 до 100 символов');
    if (!dto.startsAt) throw new BadRequestException('Укажите дату и время');
    const startsAt = new Date(dto.startsAt);
    if (isNaN(startsAt.getTime())) throw new BadRequestException('Некорректная дата');
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    const ev = await this.eventRepo.save(this.eventRepo.create({
      clanId, title,
      description: dto.description?.trim() || null,
      type: dto.type || 'custom',
      startsAt, endsAt,
      opponentTag: dto.opponentTag?.trim() || null,
      lobbyHost: dto.lobbyHost === 'us' || dto.lobbyHost === 'them' ? dto.lobbyHost : null,
      opponentExtId: dto.opponentExtId?.toString().trim() || null,
      format: ['bo1', 'bo3', 'bo5'].includes(dto.format) ? dto.format : null,
      maps: this.cleanMaps(dto.maps),
      createdBy: actorId,
    }));
    this.emitClan(clanId, 'calendar');
    return ev;
  }

  async updateEvent(actorId: number, eventId: number, dto: any) {
    const ev = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!ev) throw new NotFoundException('Событие не найдено');
    await this.requireRole(ev.clanId, actorId, ['leader', 'officer']);
    if (dto.title !== undefined) {
      const t = dto.title.trim();
      if (t.length < 2 || t.length > 100) throw new BadRequestException('Название события: от 2 до 100 символов');
      ev.title = t;
    }
    if (dto.description !== undefined) ev.description = dto.description?.trim() || null;
    if (dto.type !== undefined) ev.type = dto.type;
    if (dto.startsAt !== undefined) {
      const d = new Date(dto.startsAt);
      if (isNaN(d.getTime())) throw new BadRequestException('Некорректная дата');
      ev.startsAt = d;
    }
    if (dto.endsAt !== undefined) ev.endsAt = dto.endsAt ? new Date(dto.endsAt) : null;
    if (dto.opponentTag !== undefined) ev.opponentTag = dto.opponentTag?.trim() || null;
    if (dto.lobbyHost !== undefined) ev.lobbyHost = dto.lobbyHost === 'us' || dto.lobbyHost === 'them' ? dto.lobbyHost : null;
    if (dto.opponentExtId !== undefined) ev.opponentExtId = dto.opponentExtId?.toString().trim() || null;
    if (dto.format !== undefined) ev.format = ['bo1', 'bo3', 'bo5'].includes(dto.format) ? dto.format : null;
    if (dto.maps !== undefined) ev.maps = this.cleanMaps(dto.maps);
    await this.eventRepo.save(ev);
    this.emitClan(ev.clanId, 'calendar');
    return ev;
  }

  async deleteEvent(actorId: number, eventId: number) {
    const ev = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!ev) throw new NotFoundException('Событие не найдено');
    await this.requireRole(ev.clanId, actorId, ['leader', 'officer']);
    await this.eventRepo.delete({ id: eventId });
    this.emitClan(ev.clanId, 'calendar');
    return { ok: true };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  БИРЖА ПРАКОВ (scrims) — не влияют на рейтинг
  // ════════════════════════════════════════════════════════════════════════════

  private async listingDto(l: ClanScrimListing, clanMap?: Map<number, Clan>, responseCounts?: Map<number, number>) {
    const clan = clanMap ? clanMap.get(l.clanId) : await this.clanRepo.findOne({ where: { id: l.clanId } });
    const decided = clan ? clan.wins + clan.losses : 0;
    return {
      id: l.id, status: l.status, tier: l.tier, server: l.server,
      scheduledAt: l.scheduledAt, maps: l.maps ?? [], note: l.note,
      matchId: l.matchId, createdAt: l.createdAt,
      responseCount: responseCounts?.get(l.id) ?? 0,
      clan: clan ? {
        id: clan.id, tag: clan.tag, name: clan.name, avatarUrl: clan.avatarUrl,
        rating: clan.rating, region: clan.region, language: clan.language,
        winRate: decided > 0 ? Math.round((clan.wins / decided) * 1000) / 10 : 0,
      } : null,
    };
  }

  // Доступ к уровням поиска: main — все, semi — топ-25, pro — топ-10
  private TIER_LIMIT: Record<string, number> = { main: Infinity, semi: 25, pro: 10 };
  private async tierAllowed(clanId: number, tier: 'main' | 'semi' | 'pro'): Promise<boolean> {
    const limit = this.TIER_LIMIT[tier] ?? Infinity;
    if (limit === Infinity) return true;
    const clan = await this.clanRepo.findOne({ where: { id: clanId } });
    if (!clan) return false;
    return (await this.position(clan)) <= limit;
  }
  private normTier(t?: string): 'main' | 'semi' | 'pro' {
    return t === 'pro' ? 'pro' : t === 'semi' ? 'semi' : 'main';
  }

  // Создать заявку(и). Мультитайминги размножаются: одна заявка на каждый тайминг.
  async createListing(actorId: number, dto: { maps?: string[]; times?: string[]; scheduledAt?: string; note?: string; tier?: string; server?: string }) {
    const clanId = await this.myClanIdOrThrow(actorId);
    await this.requireRole(clanId, actorId, ['leader', 'officer']);
    const tier = this.normTier(dto.tier);
    if (!(await this.tierAllowed(clanId, tier))) {
      throw new ForbiddenException(tier === 'pro' ? 'PRO-поиск доступен только топ-10 кланам' : 'SEMI-PRO доступен только топ-25 кланам');
    }
    const maps = (dto.maps ?? []).filter((m) => VALID_MAPS.includes(m)).slice(0, 7);
    if ((dto.note ?? '').length > 300) throw new BadRequestException('Описание до 300 символов');

    // Обязательные поля заявки на прак: карта, сервер, дата + тайминг
    if (!maps.length) throw new BadRequestException('Выберите хотя бы одну карту');
    if (!dto.server) throw new BadRequestException('Укажите сервер');

    // тайминги: массив ISO — обязателен хотя бы один (с датой)
    let times: (string | null)[] = (Array.isArray(dto.times) ? dto.times.filter(Boolean) : (dto.scheduledAt ? [dto.scheduledAt] : []));
    if (!times.length) throw new BadRequestException('Укажите дату и хотя бы один тайминг');
    times = times.slice(0, 8);

    const openCount = await this.scrimRepo.count({ where: { clanId, status: 'open' } });
    if (openCount + times.length > 20) throw new BadRequestException('Слишком много открытых заявок (максимум 20)');

    const created: ClanScrimListing[] = [];
    for (const t of times) {
      const l = await this.scrimRepo.save(this.scrimRepo.create({
        clanId, createdBy: actorId, tier,
        server: dto.server || null,
        maps,
        scheduledAt: t ? new Date(t) : null,
        note: dto.note?.trim() || null,
      }));
      created.push(l);
    }
    this.emitExchange('new_listing'); this.emitClan(clanId, 'listing');
    return Promise.all(created.map((l) => this.listingDto(l)));
  }

  // Поиск: открытые заявки других кланов на выбранном уровне
  async exchange(actorId: number, opts: { region?: string; tier?: string }) {
    const myClan = await this.memberOf(actorId);
    const myClanId = myClan?.clanId ?? -1;
    const tier = this.normTier(opts.tier);
    if (myClanId > 0 && !(await this.tierAllowed(myClanId, tier))) {
      throw new ForbiddenException(tier === 'pro' ? 'PRO-поиск доступен только топ-10 кланам' : 'SEMI-PRO доступен только топ-25 кланам');
    }
    const where: any = { status: 'open' as ScrimListingStatus, tier };
    let listings = await this.scrimRepo.find({ where, order: { scheduledAt: 'ASC', createdAt: 'DESC' }, take: 200 });
    listings = listings.filter((l) => l.clanId !== myClanId);
    const ids = [...new Set(listings.map((l) => l.clanId))];
    const clans = ids.length ? await this.clanRepo.findBy({ id: In(ids) }) : [];
    let clanMap = new Map(clans.map((c) => [c.id, c]));
    if (opts.region) listings = listings.filter((l) => clanMap.get(l.clanId)?.region === opts.region);
    return Promise.all(listings.map((l) => this.listingDto(l, clanMap)));
  }

  // Свои заявки (с числом откликов)
  async myListings(actorId: number) {
    const clanId = await this.myClanIdOrThrow(actorId);
    const listings = await this.scrimRepo.find({ where: { clanId }, order: { scheduledAt: 'ASC', createdAt: 'DESC' }, take: 80 });
    const clan = await this.clanRepo.findOne({ where: { id: clanId } });
    const clanMap = clan ? new Map([[clan.id, clan]]) : undefined;
    // число pending-откликов по каждой заявке
    const counts = new Map<number, number>();
    if (listings.length) {
      const rows = await this.responseRepo.find({ where: { listingId: In(listings.map((l) => l.id)), status: 'pending' } });
      rows.forEach((r) => counts.set(r.listingId, (counts.get(r.listingId) ?? 0) + 1));
    }
    return Promise.all(listings.map((l) => this.listingDto(l, clanMap, counts)));
  }

  // Отмена заявки = удаление (вместе с откликами)
  async cancelListing(actorId: number, listingId: number) {
    const l = await this.scrimRepo.findOne({ where: { id: listingId } });
    if (!l) throw new NotFoundException('Заявка не найдена');
    await this.requireRole(l.clanId, actorId, ['leader', 'officer']);
    await this.responseRepo.delete({ listingId: l.id });
    await this.scrimRepo.delete({ id: l.id });
    this.emitExchange('listing_cancelled'); this.emitClan(l.clanId, 'listing');
    return { ok: true };
  }

  // Откликнуться: предложить сыграть на выбранной карте (создаётся отклик, НЕ матч)
  async respondListing(actorId: number, listingId: number, map?: string) {
    const myClanId = await this.myClanIdOrThrow(actorId);
    await this.requireRole(myClanId, actorId, ['leader', 'officer']);
    const l = await this.scrimRepo.findOne({ where: { id: listingId } });
    if (!l || l.status !== 'open') throw new NotFoundException('Заявка не найдена или уже занята');
    if (l.clanId === myClanId) throw new BadRequestException('Это заявка вашего клана');

    const listingMaps = l.maps ?? [];
    let chosen: string | null = null;
    if (listingMaps.length > 1) {
      if (!map || !listingMaps.includes(map)) throw new BadRequestException('Выберите одну из предложенных карт');
      chosen = map;
    } else {
      chosen = listingMaps[0] ?? null;
    }

    // нет ли уже отклика от нашего клана
    const existing = await this.responseRepo.findOne({ where: { listingId, responderClanId: myClanId, status: 'pending' } });
    if (existing) { existing.map = chosen; await this.responseRepo.save(existing); }
    else {
      await this.responseRepo.save(this.responseRepo.create({ listingId, responderClanId: myClanId, createdBy: actorId, map: chosen }));
    }

    const me = await this.clanRepo.findOne({ where: { id: myClanId } });
    await this.notifyStaff(l.clanId, 'scrim_response', 'Новый отклик на прак', `Клан [${me?.tag}] предлагает сыграть${chosen ? ` на ${this.mapLabel(chosen)}` : ''}`, { listingId });
    this.emitClan(l.clanId, 'scrim_response');
    return { ok: true };
  }

  private mapLabel(m: string) { return m.charAt(0) + m.slice(1).toLowerCase(); }

  // Входящие отклики на заявки моего клана (раздел «Отклики»)
  async myResponses(actorId: number) {
    const clanId = await this.myClanIdOrThrow(actorId);
    const myListings = await this.scrimRepo.find({ where: { clanId, status: 'open' } });
    if (!myListings.length) return [];
    const listingMap = new Map(myListings.map((l) => [l.id, l]));
    const responses = await this.responseRepo.find({ where: { listingId: In(myListings.map((l) => l.id)), status: 'pending' }, order: { createdAt: 'DESC' } });
    const respClanIds = [...new Set(responses.map((r) => r.responderClanId))];
    const clans = respClanIds.length ? await this.clanRepo.findBy({ id: In(respClanIds) }) : [];
    const cMap = new Map(clans.map((c) => [c.id, c]));
    return responses.map((r) => {
      const l = listingMap.get(r.listingId)!;
      const c = cMap.get(r.responderClanId);
      const decided = c ? c.wins + c.losses : 0;
      return {
        id: r.id, listingId: r.listingId, map: r.map, createdAt: r.createdAt,
        scheduledAt: l.scheduledAt, server: l.server, tier: l.tier,
        clan: c ? { id: c.id, tag: c.tag, name: c.name, avatarUrl: c.avatarUrl, rating: c.rating, region: c.region, winRate: decided > 0 ? Math.round((c.wins / decided) * 1000) / 10 : 0 } : null,
      };
    });
  }

  // Подтвердить отклик → создаётся прак (заносится в расписание), прочие отклики отклоняются
  async acceptResponse(actorId: number, responseId: number) {
    const resp = await this.responseRepo.findOne({ where: { id: responseId } });
    if (!resp || resp.status !== 'pending') throw new NotFoundException('Отклик не найден');
    const l = await this.scrimRepo.findOne({ where: { id: resp.listingId } });
    if (!l || l.status !== 'open') throw new BadRequestException('Заявка уже неактуальна');
    await this.requireRole(l.clanId, actorId, ['leader', 'officer']);

    const match = await this.matchRepo.save(this.matchRepo.create({
      mode: 'scrim',
      clanAId: l.clanId, clanBId: resp.responderClanId,
      status: 'accepted',
      map: resp.map || (l.maps?.[0] ?? null),
      scheduledAt: l.scheduledAt || null,
      createdBy: actorId,
      season: await this.currentSeasonNumber(),
    }));

    resp.status = 'accepted';
    await this.responseRepo.save(resp);
    l.status = 'matched';
    l.matchedClanId = resp.responderClanId;
    l.matchId = match.id;
    await this.scrimRepo.save(l);
    // отклоняем все остальные отклики на эту заявку
    await this.responseRepo.update({ listingId: l.id, status: 'pending' }, { status: 'rejected' });

    const owner = await this.clanRepo.findOne({ where: { id: l.clanId } });
    await this.notifyStaff(resp.responderClanId, 'scrim_matched', 'Прак подтверждён', `Клан [${owner?.tag}] принял ваш отклик. Прак добавлен в расписание.`, { matchId: match.id });
    this.emitExchange('listing_matched');
    this.emitClan(l.clanId, 'scrim_matched'); this.emitClan(resp.responderClanId, 'scrim_matched');
    return this.matchDto(match);
  }

  async rejectResponse(actorId: number, responseId: number) {
    const resp = await this.responseRepo.findOne({ where: { id: responseId } });
    if (!resp || resp.status !== 'pending') throw new NotFoundException('Отклик не найден');
    const l = await this.scrimRepo.findOne({ where: { id: resp.listingId } });
    if (!l) throw new NotFoundException('Заявка не найдена');
    await this.requireRole(l.clanId, actorId, ['leader', 'officer']);
    resp.status = 'rejected';
    await this.responseRepo.save(resp);
    this.emitClan(l.clanId, 'scrim_response');
    return { ok: true };
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  СЕЗОНЫ
  // ════════════════════════════════════════════════════════════════════════════

  async getCurrentSeason(): Promise<ClanSeason> {
    let s = await this.seasonRepo.findOne({ where: { status: 'active' } });
    if (!s) {
      const number = 1;
      s = await this.seasonRepo.save(this.seasonRepo.create({ number, name: `Сезон ${number}`, status: 'active', startedAt: new Date() }));
    }
    return s;
  }

  private async currentSeasonNumber(): Promise<number> {
    return (await this.getCurrentSeason()).number;
  }

  async listSeasons() {
    return this.seasonRepo.find({ order: { number: 'DESC' } });
  }

  // Текущий сезонный лидерборд (по seasonRating)
  async seasonLeaderboard() {
    const season = await this.getCurrentSeason();
    const clans = await this.clanRepo.find({ order: { seasonRating: 'DESC', id: 'ASC' }, take: 100 });
    const list = await this.mapList(clans);
    return {
      season: { number: season.number, name: season.name, startedAt: season.startedAt },
      clans: list.map((c, i) => {
        const clan = clans.find((x) => x.id === c.id)!;
        return { ...c, rank: i + 1, seasonRating: clan.seasonRating };
      }),
    };
  }

  // История сезонов для конкретного клана
  async seasonHistory(clanId: number) {
    return this.seasonResultRepo.find({ where: { clanId }, order: { seasonNumber: 'DESC' } });
  }

  // Итоговые таблицы прошедшего сезона
  async seasonResults(seasonNumber: number) {
    return this.seasonResultRepo.find({ where: { seasonNumber }, order: { finalRank: 'ASC' } });
  }

  // Завершить сезон и начать новый (только админ). Архивирует итоги и сбрасывает seasonRating.
  async endSeason() {
    const season = await this.getCurrentSeason();
    const clans = await this.clanRepo.find({ order: { seasonRating: 'DESC', id: 'ASC' } });

    // Архивируем итоги (только кланы, сыгравшие хотя бы один матч в сезоне или с ненулевым рейтингом)
    let rank = 0;
    for (const c of clans) {
      rank += 1;
      await this.seasonResultRepo.save(this.seasonResultRepo.create({
        seasonId: season.id, seasonNumber: season.number, clanId: c.id,
        tag: c.tag, name: c.name, avatarUrl: c.avatarUrl,
        finalRank: rank, seasonRating: c.seasonRating, wins: c.wins, losses: c.losses,
      }));
    }

    // Закрываем сезон
    season.status = 'ended';
    season.endedAt = new Date();
    await this.seasonRepo.save(season);

    // Сбрасываем сезонный рейтинг (общий rating не трогаем)
    await this.clanRepo.createQueryBuilder().update(Clan).set({ seasonRating: 1000 }).execute();

    // Новый сезон
    const nextNumber = season.number + 1;
    const next = await this.seasonRepo.save(this.seasonRepo.create({
      number: nextNumber, name: `Сезон ${nextNumber}`, status: 'active', startedAt: new Date(),
    }));

    // Уведомляем главу каждого клана о топ-3 по итогам
    const top3 = clans.slice(0, 3);
    for (const c of clans) {
      const place = top3.findIndex((t) => t.id === c.id);
      const body = place >= 0
        ? `Ваш клан занял ${place + 1} место в Сезоне ${season.number}! Рейтинг сброшен — вперёд за новыми победами.`
        : `Сезон ${season.number} завершён. Сезонный рейтинг сброшен. Удачи в Сезоне ${nextNumber}!`;
      await this.notifyStaff(c.id, 'clan_season_end', `Сезон ${season.number} завершён`, body, { seasonNumber: season.number });
    }

    return { ok: true, endedSeason: season.number, newSeason: next.number, archived: clans.length };
  }
}
