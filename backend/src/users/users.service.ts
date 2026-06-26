import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Or, In } from 'typeorm';
import { User } from './entities/user.entity';
import { Friendship, FriendshipStatus } from './entities/friendship.entity';
import { MatchPlayer } from '../matches/entities/match-player.entity';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { EloHistory } from './entities/elo-history.entity';
import { AppGateway } from '../gateway/app.gateway';
import { InviteService } from '../invite/invite.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Friendship) private friendshipRepo: Repository<Friendship>,
    @InjectRepository(MatchPlayer) private playerRepo: Repository<MatchPlayer>,
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(EloHistory) private eloHistoryRepo: Repository<EloHistory>,
    private gateway: AppGateway,
    private inviteService: InviteService,
  ) {}

  /** Шаг 1 регистрации: ввод пригласительного кода. Списывает код (один код = один человек). */
  async redeemInvite(userId: number, code: string): Promise<{ ok: true }> {
    const user = await this.findById(userId);
    if (user.isRegistered || user.inviteRedeemed) return { ok: true }; // гейт уже пройден
    await this.inviteService.redeem(code, userId); // бросит ошибку, если код неверный/использован
    user.inviteRedeemed = true;
    await this.userRepo.save(user);
    return { ok: true };
  }

  /** Добавляет к списку игроков флаг online (есть активный сокет). */
  private withOnline<T extends { id: number }>(users: T[]): (T & { online: boolean })[] {
    return users.map((u) => ({ ...u, online: this.gateway.isUserOnline(u.id) }));
  }

  /** Call this after every elo change before saving the user */
  async logEloChange(userId: number, eloBefore: number, eloAfter: number, reason: string) {
    const change = eloAfter - eloBefore;
    if (change === 0) return;
    await this.eloHistoryRepo.save(
      this.eloHistoryRepo.create({ userId, eloBefore, eloAfter, eloChange: change, reason }),
    );
  }

  async findById(id: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async findByTelegramId(telegramId: number): Promise<User | null> {
    return this.userRepo.findOne({ where: { telegramId } });
  }

  async addCoins(userId: number, amount: number): Promise<User> {
    const user = await this.findById(userId);
    user.coins += amount;
    return this.userRepo.save(user);
  }

  async spendCoins(userId: number, amount: number): Promise<User> {
    const user = await this.findById(userId);
    if (user.coins < amount) {
      throw new Error('Insufficient coins');
    }
    user.coins -= amount;
    return this.userRepo.save(user);
  }

  async updateAvatar(userId: number, avatarUrl: string): Promise<{ avatarUrl: string }> {
    const user = await this.findById(userId);
    user.avatarUrl = avatarUrl;
    await this.userRepo.save(user);
    return { avatarUrl };
  }

  async register(userId: number, gameNickname: string, gameId: string, deviceSerial: string, region?: string): Promise<User> {
    const user = await this.findById(userId);

    // Once registered, serial and gameId are locked — only admins can change them
    if (user.isRegistered) {
      // Allow updating nickname only; serial and gameId stay as-is
      user.gameNickname = gameNickname.trim();
    } else {
      // Закрытый тест: регистрация только после ввода пригласительного кода
      if (!user.inviteRedeemed) {
        throw new BadRequestException('Сначала введите пригласительный код');
      }
      if (!region?.trim()) {
        throw new BadRequestException('Выберите регион');
      }
      user.gameNickname = gameNickname.trim();
      user.gameId = gameId.trim();
      user.deviceSerial = deviceSerial.trim();
      user.region = region.trim();
      user.regionUpdatedAt = new Date();
      user.isRegistered = true;
    }

    return this.userRepo.save(user);
  }

  async changeNickname(userId: number, newNickname: string): Promise<User> {
    const user = await this.findById(userId);
    if (!user.isRegistered) throw new Error('Not registered');

    const FREE_CHANGES = 1;
    if (user.nicknameChangesUsed >= FREE_CHANGES) {
      const CHANGE_COST = 500;
      if (user.coins < CHANGE_COST) {
        throw new Error(`Недостаточно монет. Смена ника стоит ${CHANGE_COST} монет.`);
      }
      user.coins -= CHANGE_COST;
    }

    user.gameNickname = newNickname.trim();
    user.nicknameChangesUsed += 1;
    return this.userRepo.save(user);
  }

  async getBatch(ids: number[]): Promise<{ id: number; gameNickname: string; gameId: string; avatarUrl: string; elo: number; isVerified: boolean }[]> {
    if (!ids.length) return [];
    const users = await this.userRepo.findBy({ id: In(ids) });
    return users.map((u) => ({
      id: u.id,
      gameNickname: u.gameNickname || u.firstName || `Игрок`,
      gameId: u.gameId || '',
      avatarUrl: u.avatarUrl || '',
      elo: u.elo ?? 1000,
      isVerified: u.isVerified ?? false,
    }));
  }

  async searchByGameId(query: string): Promise<User[]> {
    if (!query || query.trim().length < 2) return [];
    return this.userRepo
      .createQueryBuilder('u')
      .where('LOWER(u.game_id) LIKE LOWER(:q)', { q: `%${query.trim()}%` })
      .orWhere('LOWER(u.game_nickname) LIKE LOWER(:q)', { q: `%${query.trim()}%` })
      .andWhere('u.is_registered = true')
      .limit(20)
      .getMany();
  }

  async sendFriendRequest(userId: number, targetId: number): Promise<Friendship> {
    if (userId === targetId) throw new BadRequestException('Cannot add yourself');
    const existing = await this.friendshipRepo.findOne({
      where: [
        { userId, friendId: targetId },
        { userId: targetId, friendId: userId },
      ],
    });
    if (existing) throw new BadRequestException('Request already exists');
    return this.friendshipRepo.save(this.friendshipRepo.create({ userId, friendId: targetId }));
  }

  async acceptFriendRequest(userId: number, fromId: number): Promise<Friendship> {
    const req = await this.friendshipRepo.findOne({
      where: { userId: fromId, friendId: userId, status: FriendshipStatus.PENDING },
    });
    if (!req) throw new NotFoundException('Friend request not found');
    req.status = FriendshipStatus.ACCEPTED;
    return this.friendshipRepo.save(req);
  }

  async removeFriend(userId: number, targetId: number): Promise<void> {
    await this.friendshipRepo.delete({ userId, friendId: targetId });
    await this.friendshipRepo.delete({ userId: targetId, friendId: userId });
  }

  async getFriends(userId: number) {
    const rows = await this.friendshipRepo.find({
      where: [
        { userId, status: FriendshipStatus.ACCEPTED },
        { friendId: userId, status: FriendshipStatus.ACCEPTED },
      ],
    });
    const friendIds = rows.map((r) => (r.userId === userId ? r.friendId : r.userId));
    if (!friendIds.length) return [];
    return this.withOnline(await this.userRepo.findBy({ id: In(friendIds) }));
  }

  async getFriendRequests(userId: number) {
    const rows = await this.friendshipRepo.find({
      where: { friendId: userId, status: FriendshipStatus.PENDING },
    });
    if (!rows.length) return [];
    const fromIds = rows.map((r) => r.userId);
    return this.withOnline(await this.userRepo.findBy({ id: In(fromIds) }));
  }

  async getFriendshipStatus(userId: number, targetId: number): Promise<string> {
    const row = await this.friendshipRepo.findOne({
      where: [
        { userId, friendId: targetId },
        { userId: targetId, friendId: userId },
      ],
    });
    if (!row) return 'none';
    if (row.status === FriendshipStatus.ACCEPTED) return 'friends';
    if (row.userId === userId) return 'pending_sent';
    return 'pending_received';
  }

  async getPublicProfile(targetId: number, viewerId?: number) {
    const user = await this.findById(targetId);
    const friendStatus = viewerId ? await this.getFriendshipStatus(viewerId, targetId) : 'none';
    return {
      id: user.id,
      gameNickname: user.gameNickname,
      gameId: user.gameId,
      firstName: user.firstName,
      // Hide username if privacy setting is on (unless viewing own profile)
      username: user.hideUsername && viewerId !== targetId ? null : user.username,
      avatarUrl: user.avatarUrl,
      elo: user.elo,
      matchesPlayed: user.matchesPlayed,
      matchesWon: user.matchesWon,
      matchesLost: user.matchesLost,
      kdr: user.kdr,
      winRate: user.winRate,
      avgKills: user.avgKills,
      ratingOverall: user.ratingOverall,
      isPremium: user.isPremium,
      isVerified: user.isVerified,
      isAdmin: user.isAdmin,
      warns: user.warns ?? 0,
      region: user.region ?? null,
      friendStatus,
    };
  }

  async getProfile(userId: number) {
    const user = await this.findById(userId);
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      displayName: user.displayName,
      elo: user.elo,
      coins: user.coins,
      matchesPlayed: user.matchesPlayed,
      matchesWon: user.matchesWon,
      matchesLost: user.matchesLost,
      kdr: user.kdr,
      winRate: user.winRate,
      killsTotal: user.killsTotal,
      deathsTotal: user.deathsTotal,
      assistsTotal: user.assistsTotal,
      ratingSum: user.ratingSum,
      avgKills: user.avgKills,
      ratingOverall: user.ratingOverall,
      isPremium: user.isPremium,
      premiumUntil: user.premiumUntil,
      isAdmin: user.isAdmin,
      isModerator: user.isModerator,
      isVerified: user.isVerified,
      isDmHost: user.isDmHost ?? false,
      cplAccess: user.cplAccess ?? false,
      cplqAccess: user.cplqAccess ?? false,
      cplqDanger: user.cplqDanger ?? false,
      isRegistered: user.isRegistered,
      inviteRedeemed: user.inviteRedeemed ?? false,
      gameNickname: user.gameNickname,
      gameId: user.gameId,
      nicknameChangesUsed: user.nicknameChangesUsed,
      freeNicknameChangeAvailable: user.nicknameChangesUsed < 1,
      warns: user.warns ?? 0,
      cooldownUntil: user.cooldownUntil ?? null,
      isBanned: user.isBanned ?? false,
      banReason: user.banReason ?? null,
      hideUsername: user.hideUsername ?? false,
      region: user.region ?? null,
      regionUpdatedAt: user.regionUpdatedAt ?? null,
      discordUsername: user.discordUsername ?? null,
      miniGamePlaysToday: (() => {
        const today = new Date().toISOString().slice(0, 10);
        return user.miniGameLastDate === today ? (user.miniGamePlaysToday ?? 0) : 0;
      })(),
    };
  }

  async setDiscordUsername(userId: number, discordUsername: string | null) {
    const user = await this.findById(userId);
    user.discordUsername = discordUsername ? discordUsername.trim().toLowerCase().replace(/^@/, '') : null;
    await this.userRepo.save(user);
    return { ok: true, discordUsername: user.discordUsername };
  }

  async updateRegion(userId: number, region: string | null) {
    const user = await this.findById(userId);
    const COOLDOWN_DAYS = 7;

    if (region && user.regionUpdatedAt) {
      const daysSince = (Date.now() - new Date(user.regionUpdatedAt).getTime()) / 86_400_000;
      if (daysSince < COOLDOWN_DAYS) {
        const daysLeft = Math.ceil(COOLDOWN_DAYS - daysSince);
        throw new Error(`Регион можно менять раз в 7 дней. Осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`);
      }
    }

    user.region = region ?? null;
    if (region) user.regionUpdatedAt = new Date();
    await this.userRepo.save(user);
    return { ok: true };
  }

  async updatePrivacy(userId: number, hideUsername: boolean) {
    const user = await this.findById(userId);
    user.hideUsername = hideUsername;
    await this.userRepo.save(user);
    return { ok: true };
  }

  async claimMiniGameReward(userId: number): Promise<{ coins: number; playsToday: number; nextDifficulty: number }> {
    const MAX_PLAYS = 10;
    const COINS_PER_WIN = 10;

    const user = await this.findById(userId);
    const today = new Date().toISOString().slice(0, 10);

    // Reset counter if new day
    if (user.miniGameLastDate !== today) {
      user.miniGamePlaysToday = 0;
      user.miniGameLastDate = today;
    }

    if (user.miniGamePlaysToday >= MAX_PLAYS) {
      throw new Error(`Лимит на сегодня исчерпан (${MAX_PLAYS} игр в день)`);
    }

    user.miniGamePlaysToday += 1;
    user.coins += COINS_PER_WIN;
    await this.userRepo.save(user);

    // Next difficulty = play count (0-indexed), capped at 9
    const nextDifficulty = Math.min(user.miniGamePlaysToday, MAX_PLAYS - 1);

    return { coins: COINS_PER_WIN, playsToday: user.miniGamePlaysToday, nextDifficulty };
  }

  async getEloHistory(userId: number) {
    const rows = await this.eloHistoryRepo.find({
      where: { userId },
      order: { createdAt: 'ASC' },
      take: 30,
    });

    if (rows.length === 0) return { points: [], wins: 0, losses: 0, eloChange: 0 };

    const points = rows.map(r => ({
      elo:    r.eloAfter,
      change: r.eloChange,
      won:    r.eloChange > 0,
      reason: r.reason,
      date:   r.createdAt,
    }));

    const wins   = points.filter(p => p.won).length;
    const losses = points.filter(p => !p.won).length;
    const eloChange = rows[rows.length - 1].eloAfter - rows[0].eloBefore;

    return { points, wins, losses, eloChange };
  }

  async getUserRank(userId: number): Promise<number> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return 0;
    const above = await this.userRepo
      .createQueryBuilder('u')
      .where('u.elo > :elo', { elo: user.elo })
      .andWhere('u.is_banned = false')
      .getCount();
    return above + 1;
  }
}
