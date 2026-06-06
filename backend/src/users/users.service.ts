import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Or, In } from 'typeorm';
import { User } from './entities/user.entity';
import { DailyReward } from './entities/daily-reward.entity';
import { Friendship, FriendshipStatus } from './entities/friendship.entity';
import { MatchPlayer } from '../matches/entities/match-player.entity';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { EloHistory } from './entities/elo-history.entity';

const DAILY_REWARDS = [
  { coins: 50, xp: 100 },
  { coins: 75, xp: 150 },
  { coins: 100, xp: 200 },
  { coins: 125, xp: 250 },
  { coins: 150, xp: 300 },
  { coins: 200, xp: 400 },
  { coins: 300, xp: 500 },
];

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(DailyReward) private rewardRepo: Repository<DailyReward>,
    @InjectRepository(Friendship) private friendshipRepo: Repository<Friendship>,
    @InjectRepository(MatchPlayer) private playerRepo: Repository<MatchPlayer>,
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(EloHistory) private eloHistoryRepo: Repository<EloHistory>,
  ) {}

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

  async claimDailyReward(userId: number): Promise<{ coins: number; xp: number; streak: number; alreadyClaimed: boolean }> {
    const user = await this.findById(userId);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (user.lastLoginReward) {
      const lastRewardDay = new Date(
        user.lastLoginReward.getFullYear(),
        user.lastLoginReward.getMonth(),
        user.lastLoginReward.getDate(),
      );
      if (lastRewardDay.getTime() === today.getTime()) {
        return { coins: 0, xp: 0, streak: user.loginStreak, alreadyClaimed: true };
      }

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastRewardDay.getTime() < yesterday.getTime()) {
        user.loginStreak = 0;
      }
    }

    user.loginStreak = Math.min(user.loginStreak + 1, 7);
    const reward = DAILY_REWARDS[(user.loginStreak - 1) % 7];

    user.coins += reward.coins;
    user.xp += reward.xp;
    user.lastLoginReward = now;
    await this.userRepo.save(user);

    await this.rewardRepo.save(
      this.rewardRepo.create({
        userId,
        dayStreak: user.loginStreak,
        coins: reward.coins,
        xp: reward.xp,
      }),
    );

    return { coins: reward.coins, xp: reward.xp, streak: user.loginStreak, alreadyClaimed: false };
  }

  async addXp(userId: number, amount: number): Promise<User> {
    const user = await this.findById(userId);
    user.xp += amount;
    user.level = Math.floor(Math.sqrt(user.xp / 100)) + 1;
    return this.userRepo.save(user);
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

  async register(userId: number, gameNickname: string, gameId: string, deviceSerial: string): Promise<User> {
    const user = await this.findById(userId);

    // Once registered, serial and gameId are locked — only admins can change them
    if (user.isRegistered) {
      // Allow updating nickname only; serial and gameId stay as-is
      user.gameNickname = gameNickname.trim();
    } else {
      user.gameNickname = gameNickname.trim();
      user.gameId = gameId.trim();
      user.deviceSerial = deviceSerial.trim();
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

  async getBatch(ids: number[]): Promise<{ id: number; gameNickname: string; gameId: string; avatarUrl: string }[]> {
    if (!ids.length) return [];
    const users = await this.userRepo.findBy({ id: In(ids) });
    return users.map((u) => ({
      id: u.id,
      gameNickname: u.gameNickname || u.firstName || `Игрок`,
      gameId: u.gameId || '',
      avatarUrl: u.avatarUrl || '',
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
    return this.userRepo.findBy({ id: In(friendIds) });
  }

  async getFriendRequests(userId: number) {
    const rows = await this.friendshipRepo.find({
      where: { friendId: userId, status: FriendshipStatus.PENDING },
    });
    if (!rows.length) return [];
    const fromIds = rows.map((r) => r.userId);
    return this.userRepo.findBy({ id: In(fromIds) });
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
      level: user.level,
      matchesPlayed: user.matchesPlayed,
      matchesWon: user.matchesWon,
      matchesLost: user.matchesLost,
      kdr: user.kdr,
      winRate: user.winRate,
      avgKills: user.avgKills,
      ratingOverall: user.ratingOverall,
      isPremium: user.isPremium,
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
      xp: user.xp,
      level: user.level,
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
      loginStreak: user.loginStreak,
      isAdmin: user.isAdmin,
      isModerator: user.isModerator,
      isRegistered: user.isRegistered,
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
