import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import axios from 'axios';
import { User } from '../users/entities/user.entity';
import { Match, MatchStatus, MAPS } from '../matches/entities/match.entity';
import { MatchPlayer } from '../matches/entities/match-player.entity';
import { Mission, MissionType } from '../missions/entities/mission.entity';
import { ShopItem } from '../shop/entities/shop-item.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Report, ReportStatus } from '../reports/entities/report.entity';
import { CoinPurchase, PurchaseStatus } from '../coins/entities/coin-purchase.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AppGateway } from '../gateway/app.gateway';
import { MissionsService } from '../missions/missions.service';
import { EloHistory } from '../users/entities/elo-history.entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer) private playerRepo: Repository<MatchPlayer>,
    @InjectRepository(Mission) private missionRepo: Repository<Mission>,
    @InjectRepository(ShopItem) private shopRepo: Repository<ShopItem>,
    @InjectRepository(Tournament) private tournamentRepo: Repository<Tournament>,
    @InjectRepository(Report) private reportRepo: Repository<Report>,
    @InjectRepository(CoinPurchase) private purchaseRepo: Repository<CoinPurchase>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(EloHistory) private eloHistoryRepo: Repository<EloHistory>,
    private gateway: AppGateway,
    private missionsService: MissionsService,
  ) {}

  private async logElo(userId: number, eloBefore: number, eloAfter: number, reason: string) {
    const change = eloAfter - eloBefore;
    if (change === 0) return;
    await this.eloHistoryRepo.save(
      this.eloHistoryRepo.create({ userId, eloBefore, eloAfter, eloChange: change, reason }),
    );
  }

  async getStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [totalUsers, totalMatches, activeMatches, newUsersToday, pendingResults, pendingPurchases, pendingReports] =
      await Promise.all([
        this.userRepo.count(),
        this.matchRepo.count(),
        this.matchRepo.count({ where: { status: 'in_progress' as any } }),
        this.userRepo.createQueryBuilder('u').where('u.created_at >= :today', { today }).getCount(),
        this.matchRepo.count({ where: { status: 'result_pending' as any } }),
        this.purchaseRepo.count({ where: { status: PurchaseStatus.PENDING } }),
        this.reportRepo.count({ where: { status: ReportStatus.PENDING } }),
      ]);

    const topPlayers = await this.userRepo.find({
      order: { elo: 'DESC' },
      take: 5,
      select: ['id', 'gameNickname', 'firstName', 'elo', 'matchesPlayed'],
    });

    return {
      totalUsers,
      totalMatches,
      activeMatches,
      newUsersToday,
      pendingResults,
      pendingPurchases,
      pendingReports,
      topPlayers,
    };
  }

  async listUsers(search?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = search
      ? [
          { username: Like(`%${search}%`) },
          { firstName: Like(`%${search}%`) },
          { gameNickname: Like(`%${search}%`) },
        ]
      : undefined;
    const [users, total] = await this.userRepo.findAndCount({ where, take: limit, skip });
    return { users, total, page, limit };
  }

  async banUser(id: number, reason: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.isBanned = true;
    user.banReason = reason;
    return this.userRepo.save(user);
  }

  async unbanUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.isBanned = false;
    user.banReason = null;
    return this.userRepo.save(user);
  }

  async warnUser(id: number, reason?: string) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.warns = Math.min((user.warns ?? 0) + 1, 3);

    const warnNum = user.warns;
    const isBanTrigger = warnNum >= 3;

    if (isBanTrigger) {
      user.isBanned = true;
      user.banReason = `3 предупреждения${reason ? ': ' + reason : ''}`;
    }

    await this.userRepo.save(user);

    // Notification
    await this.notifRepo.save(
      this.notifRepo.create({
        userId: id,
        type: 'warn',
        title: isBanTrigger
          ? '🔴 Вы заблокированы'
          : `⚠️ Предупреждение ${warnNum}/3`,
        body: isBanTrigger
          ? `Вы получили 3 предупреждения и заблокированы.${reason ? ' Причина: ' + reason : ''}`
          : `Вы получили предупреждение (${warnNum}/3).${reason ? ' Причина: ' + reason : ''} При 3 предупреждениях — бан.`,
        meta: { warnCount: warnNum, reason: reason ?? null },
      }),
    );

    return { warns: user.warns, isBanned: user.isBanned };
  }

  async unwarnUser(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    if ((user.warns ?? 0) === 0) throw new BadRequestException('Нет активных предупреждений');
    user.warns = Math.max(0, (user.warns ?? 0) - 1);

    // Auto-unban if was banned solely due to 3 warns
    if (user.isBanned && user.banReason?.includes('предупреждения')) {
      user.isBanned = false;
      user.banReason = null;
    }

    await this.userRepo.save(user);
    return { warns: user.warns, isBanned: user.isBanned };
  }

  async resetStats(id: number) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();

    user.matchesPlayed = 0;
    user.matchesWon    = 0;
    user.matchesLost   = 0;
    user.killsTotal    = 0;
    user.deathsTotal   = 0;
    user.assistsTotal  = 0;
    user.ratingSum     = 0;
    user.cooldownUntil = null;
    user.leaveCount    = 0;

    await this.userRepo.save(user);
    return { ok: true };
  }

  async setAdmin(id: number, isAdmin: boolean) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.isAdmin = isAdmin;
    return this.userRepo.save(user);
  }

  async adjustCoins(id: number, amount: number) {
    if (!Number.isInteger(amount) || Math.abs(amount) > 1_000_000) throw new BadRequestException('Invalid coin amount');
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.coins = Math.max(0, user.coins + amount);
    return this.userRepo.save(user);
  }

  async adjustElo(id: number, amount: number) {
    if (!Number.isInteger(amount) || Math.abs(amount) > 50_000) throw new BadRequestException('Invalid ELO amount');
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    const before = user.elo;
    user.elo = Math.max(100, Math.min(50_000, user.elo + amount));
    await this.logElo(user.id, before, user.elo, 'admin');
    return this.userRepo.save(user);
  }

  async setElo(id: number, elo: number) {
    if (!Number.isInteger(elo) || elo < 100 || elo > 50_000) throw new BadRequestException('ELO must be between 100 and 50000');
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    const before = user.elo;
    user.elo = elo;
    await this.logElo(user.id, before, user.elo, 'admin');
    return this.userRepo.save(user);
  }

  // ── Matches ──────────────────────────────────────────────────────────────

  async listMatches(page = 1, limit = 20, status?: string) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as any } : undefined;
    const [matches, total] = await this.matchRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });
    return { matches, total, page, limit };
  }

  async cancelMatch(id: number) {
    const match = await this.matchRepo.findOne({ where: { id } });
    if (!match) throw new NotFoundException();

    // If KD was already submitted, reverse all stat changes before cancelling
    if (match.kdSubmitted) {
      await this.reverseKdStats(match);
    }

    match.status = MatchStatus.CANCELLED;
    return this.matchRepo.save(match);
  }

  private async reverseKdStats(match: Match): Promise<void> {
    const allIds = [...new Set([...match.teamAIds, ...match.teamBIds])];

    for (const userId of allIds) {
      const player = await this.playerRepo.findOne({ where: { matchId: match.id, userId } });
      if (!player) continue;

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) continue;

      const isTeamA = match.teamAIds.includes(userId);
      const won     = (isTeamA && match.winnerTeam === 'A') || (!isTeamA && match.winnerTeam === 'B');
      const isDraw  = match.winnerTeam === 'draw';

      // Reverse per-match stat totals
      user.killsTotal   = Math.max(0, user.killsTotal   - player.kills);
      user.deathsTotal  = Math.max(0, user.deathsTotal  - player.deaths);
      user.assistsTotal = Math.max(0, user.assistsTotal - player.assists);
      user.ratingSum    = Math.max(0, Math.round((user.ratingSum - player.ratingMatch) * 100) / 100);

      // Reverse match counters
      user.matchesPlayed = Math.max(0, user.matchesPlayed - 1);
      if (won)           user.matchesWon  = Math.max(0, user.matchesWon  - 1);
      else if (!isDraw)  user.matchesLost = Math.max(0, user.matchesLost - 1);

      // Reverse ELO, coins, XP
      user.elo    = Math.max(100, user.elo   - player.eloChange);
      user.coins  = Math.max(0,   user.coins - player.coinsEarned);
      user.xp     = Math.max(0,   user.xp    - player.xpEarned);
      user.level  = Math.floor(Math.sqrt(user.xp / 100)) + 1;

      await this.userRepo.save(user);

      // Reset the player record stats so history stays clean
      player.kills       = 0; player.deaths      = 0; player.assists    = 0;
      player.kdMatch     = 0; player.kprMatch    = 0; player.aprMatch   = 0;
      player.srMatch     = 0; player.ratingMatch = 0;
      player.eloChange   = 0; player.eloAfter    = 0;
      player.coinsEarned = 0; player.xpEarned    = 0;
      await this.playerRepo.save(player);
    }

    match.kdSubmitted = false;
  }

  async getPendingResults(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [matches, total] = await this.matchRepo.findAndCount({
      where: { status: MatchStatus.RESULT_PENDING },
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    // Enrich with player nicknames
    const enriched = await Promise.all(
      matches.map(async (m) => {
        const allIds = [...new Set([...m.teamAIds, ...m.teamBIds])];
        const users = await this.userRepo.findBy({ id: In(allIds) });
        const nameMap = Object.fromEntries(users.map((u) => [u.id, u.gameNickname || u.firstName]));
        return {
          ...m,
          teamANames: m.teamAIds.map((id) => nameMap[id] || `#${id}`),
          teamBNames: m.teamBIds.map((id) => nameMap[id] || `#${id}`),
        };
      }),
    );

    return { matches: enriched, total, page, limit };
  }

  async confirmMatchResult(matchId: number, winner: 'A' | 'B' | 'draw') {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');

    match.winnerTeam = winner;
    match.status = MatchStatus.COMPLETED;
    match.endedAt = new Date();

    // ELO / coins / XP / matchesPlayed are applied only after moderator submits KD
    return this.matchRepo.save(match);
  }

  // ── CONDR ELO System ──────────────────────────────────────────────────────

  /**
   * Returns the ELO change for one player under the CONDR ELO rules.
   *
   * Calibration (first 10 matches): Win +80 / Loss -40 / Draw 0
   * Standard: base ±25 adjusted by average team ELO difference
   *   0–99   → balanced:  ±25 / ±25
   *   100–199 → Fav +22/-28,  Dog +28/-22
   *   200–299 → Fav +18/-32,  Dog +32/-18
   *   300+   → Fav +15/-35,  Dog +35/-15
   */
  private calcEloChange(
    won: boolean,
    draw: boolean,
    isCalibration: boolean,
    avgEloMyTeam: number,
    avgEloOpponent: number,
  ): number {
    if (draw) return 0;

    if (isCalibration) {
      return won ? 80 : -40;
    }

    const diff = Math.abs(avgEloMyTeam - avgEloOpponent);
    const isFavorite = avgEloMyTeam >= avgEloOpponent;

    if (diff < 100) {
      return won ? 25 : -25;
    } else if (diff < 200) {
      return won
        ? isFavorite ? 22 : 28
        : isFavorite ? -28 : -22;
    } else if (diff < 300) {
      return won
        ? isFavorite ? 18 : 32
        : isFavorite ? -32 : -18;
    } else {
      return won
        ? isFavorite ? 15 : 35
        : isFavorite ? -35 : -15;
    }
  }

  private async applyEloChanges(match: Match, winner: 'A' | 'B' | 'draw'): Promise<void> {
    const allIds = [...match.teamAIds, ...match.teamBIds];
    const users = await this.userRepo.findBy({ id: In(allIds) });

    const avgEloA = match.teamAElo;
    const avgEloB = match.teamBElo;

    for (const user of users) {
      const isTeamA = match.teamAIds.includes(user.id);
      const won = (isTeamA && winner === 'A') || (!isTeamA && winner === 'B');
      const draw = winner === 'draw';

      // Calibration = this is one of the player's first 10 matches
      const isCalibration = user.matchesPlayed < 10;

      const avgEloMyTeam = isTeamA ? avgEloA : avgEloB;
      const avgEloOpponent = isTeamA ? avgEloB : avgEloA;

      const change = this.calcEloChange(won, draw, isCalibration, avgEloMyTeam, avgEloOpponent);

      const player = await this.playerRepo.findOne({
        where: { matchId: match.id, userId: user.id },
      });

      const coinsEarned = won ? 50 : draw ? 30 : 20;
      const xpEarned = won ? 200 : draw ? 120 : 80;

      let newElo = user.elo + change;
      if (isCalibration) {
        // Hard clamp during calibration
        newElo = Math.max(600, Math.min(1800, newElo));
      } else {
        newElo = Math.max(100, newElo);
      }

      const eloBefore = user.elo;
      user.elo = newElo;
      await this.logElo(user.id, eloBefore, newElo, isCalibration ? 'calibration' : 'match');
      user.matchesPlayed += 1;
      if (won) {
        user.matchesWon += 1;
        user.winStreak = (user.winStreak ?? 0) + 1;
      } else if (!draw) {
        user.matchesLost += 1;
        user.winStreak = 0;
      }
      user.coins += coinsEarned;
      user.xp += xpEarned;
      user.level = Math.floor(Math.sqrt(user.xp / 100)) + 1;
      await this.userRepo.save(user);

      if (player) {
        player.eloAfter = user.elo;
        player.eloChange = change;
        player.coinsEarned = coinsEarned;
        player.xpEarned = xpEarned;
        await this.playerRepo.save(player);
      }

      // ── Mission progress ──────────────────────────────────────────────────
      await this.missionsService.updateDailyProgress(user.id, 'play_matches', 1);
      if (won) {
        await this.missionsService.updateDailyProgress(user.id, 'win_matches', 1);
        if (user.winStreak >= 2) {
          await this.missionsService.updateDailyProgress(user.id, 'win_streak', user.winStreak >= 2 ? 1 : 0);
        }
      }
      if (player?.kills)   await this.missionsService.updateDailyProgress(user.id, 'get_kills',   player.kills);
      if (player?.assists) await this.missionsService.updateDailyProgress(user.id, 'get_assists', player.assists);
    }

    // MVP per team — player with highest ratingMatch
    const allPlayers = await this.playerRepo.find({ where: { matchId: match.id } });
    for (const teamIds of [match.teamAIds, match.teamBIds]) {
      const teamPlayers = allPlayers.filter(p => teamIds.includes(p.userId));
      if (!teamPlayers.length) continue;
      const mvp = teamPlayers.reduce((a, b) => (b.ratingMatch ?? 0) > (a.ratingMatch ?? 0) ? b : a);
      if (mvp) await this.missionsService.updateDailyProgress(mvp.userId, 'become_mvp', 1);
    }
  }

  /** Apply dodge penalty: -10 ELO, 5-minute cooldown. */
  async applyDodgePenalty(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;
    const before = user.elo;
    user.elo = Math.max(100, user.elo - 10);
    await this.logElo(userId, before, user.elo, 'dodge_penalty');
    const until = new Date();
    until.setMinutes(until.getMinutes() + 5);
    user.cooldownUntil = until;
    await this.userRepo.save(user);

    await this.notifRepo.save(
      this.notifRepo.create({
        userId,
        type: 'penalty',
        title: '⏱️ Штраф: пропуск ready check',
        body: 'Вы не приняли ready check. -10 ELO, кулдаун 5 минут.',
        meta: { type: 'dodge', eloPenalty: -10 },
      }),
    );
  }

  /** Apply leave/AFK penalty with escalating cooldowns. */
  async applyLeavePenalty(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    user.leaveCount = (user.leaveCount ?? 0) + 1;
    const before = user.elo;
    user.elo = Math.max(100, user.elo - 35);
    await this.logElo(userId, before, user.elo, 'leave_penalty');

    const until = new Date();
    switch (user.leaveCount) {
      case 1:  until.setMinutes(until.getMinutes() + 30); break;
      case 2:  until.setHours(until.getHours() + 2); break;
      case 3:  until.setHours(until.getHours() + 24); break;
      default: until.setHours(until.getHours() + 48); break;
    }
    user.cooldownUntil = until;
    await this.userRepo.save(user);

    const cooldownText =
      user.leaveCount === 1 ? '30 минут' :
      user.leaveCount === 2 ? '2 часа' :
      user.leaveCount === 3 ? '24 часа' : '48 часов';

    await this.notifRepo.save(
      this.notifRepo.create({
        userId,
        type: 'penalty',
        title: '🚪 Штраф: покидание матча',
        body: `-35 ELO. Кулдаун: ${cooldownText}. Всего выходов: ${user.leaveCount}.`,
        meta: { type: 'leave', leaveCount: user.leaveCount, eloPenalty: -35 },
      }),
    );
  }

  // ── Reports ───────────────────────────────────────────────────────────────

  async listReports(status?: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as ReportStatus } : {};
    const [reports, total] = await this.reportRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    // Enrich with usernames
    const allIds = [...new Set(reports.flatMap((r) => [r.reporterId, r.reportedId]))];
    const users = allIds.length ? await this.userRepo.findBy({ id: In(allIds) }) : [];
    const nameMap = Object.fromEntries(users.map((u) => [u.id, u.gameNickname || u.firstName || u.username]));

    const enriched = reports.map((r) => ({
      ...r,
      reporterName: nameMap[r.reporterId] || `#${r.reporterId}`,
      reportedName: nameMap[r.reportedId] || `#${r.reportedId}`,
    }));

    return { reports: enriched, total, page, limit };
  }

  async updateReportStatus(id: number, status: ReportStatus) {
    const report = await this.reportRepo.findOne({ where: { id } });
    if (!report) throw new NotFoundException();
    report.status = status;
    return this.reportRepo.save(report);
  }

  // ── Coin Purchases ────────────────────────────────────────────────────────

  async listPurchases(status?: string, page = 1, limit = 30) {
    const skip = (page - 1) * limit;
    const where = status ? { status: status as PurchaseStatus } : {};
    const [purchases, total] = await this.purchaseRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip,
    });

    const userIds = [...new Set(purchases.map((p) => p.userId))];
    const users = userIds.length ? await this.userRepo.findBy({ id: In(userIds) }) : [];
    const nameMap = Object.fromEntries(users.map((u) => [u.id, u.gameNickname || u.firstName || u.username]));

    const enriched = purchases.map((p) => ({
      ...p,
      userName: nameMap[p.userId] || `#${p.userId}`,
    }));

    return { purchases: enriched, total, page, limit };
  }

  async confirmPurchase(purchaseId: number) {
    const purchase = await this.purchaseRepo.findOne({ where: { id: purchaseId } });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.status !== PurchaseStatus.PENDING)
      throw new NotFoundException(`Заявка уже обработана (статус: ${purchase.status})`);

    purchase.status = PurchaseStatus.CONFIRMED;
    await this.purchaseRepo.save(purchase);

    const user = await this.userRepo.findOne({ where: { id: purchase.userId } });
    if (user) {
      user.coins += purchase.coins;
      await this.userRepo.save(user);

      // Notify user in-app
      await this.notifRepo.save(
        this.notifRepo.create({
          userId: user.id,
          type: 'purchase_confirmed',
          title: '🪙 Платёж подтверждён',
          body: `+${purchase.coins} монет зачислено на ваш счёт`,
          meta: { redirect: '/shop' },
        }),
      );
    }

    // Edit Telegram admin message
    await this.editTelegramPurchaseMessage(purchase, '✅ Подтверждено');

    return { ok: true };
  }

  async rejectPurchase(purchaseId: number) {
    const purchase = await this.purchaseRepo.findOne({ where: { id: purchaseId } });
    if (!purchase) throw new NotFoundException('Purchase not found');
    if (purchase.status !== PurchaseStatus.PENDING)
      throw new NotFoundException(`Заявка уже обработана (статус: ${purchase.status})`);

    purchase.status = PurchaseStatus.REJECTED;
    await this.purchaseRepo.save(purchase);

    // Edit Telegram admin message
    await this.editTelegramPurchaseMessage(purchase, '❌ Отклонено');

    return { ok: true };
  }

  private async editTelegramPurchaseMessage(purchase: CoinPurchase, note: string) {
    const botToken = process.env.BOT_TOKEN;
    const chatId = process.env.ADMIN_CHAT_ID;
    if (!botToken || !chatId || !purchase.telegramMessageId) return;
    try {
      await axios.post(`https://api.telegram.org/bot${botToken}/editMessageReplyMarkup`, {
        chat_id: chatId,
        message_id: purchase.telegramMessageId,
        reply_markup: { inline_keyboard: [[{ text: note, callback_data: 'done' }]] },
      });
    } catch {}
  }

  // ── Test match (2v2, multi-admin) ────────────────────────────────────────

  // In-memory: track the current open test lobby
  private activeTestMatchId: number | null = null;

  async createTestMatch2v2(adminId: number): Promise<Match> {
    const admin = await this.userRepo.findOne({ where: { id: adminId } });
    if (!admin) throw new NotFoundException('Admin user not found');

    // Fill all 4 slots with creator as placeholders
    const match = this.matchRepo.create({
      status: MatchStatus.READY_CHECK,
      teamAIds: [adminId, adminId],
      teamBIds: [adminId, adminId],
      teamAElo: admin.elo,
      teamBElo: admin.elo,
      hostId: adminId,
      availableMaps: [...MAPS],
      readyPlayers: [],
      readyCheckExpires: new Date(Date.now() + 300_000), // 5 min to let others join
    });

    const saved = await this.matchRepo.save(match);
    this.activeTestMatchId = saved.id;

    this.gateway.emitMatchFound([adminId], saved.id);
    return saved;
  }

  async joinTestMatch(adminId: number): Promise<Match> {
    if (!this.activeTestMatchId) {
      throw new NotFoundException('Нет активного тест-лобби');
    }

    const match = await this.matchRepo.findOne({ where: { id: this.activeTestMatchId } });
    if (!match || match.status !== MatchStatus.READY_CHECK) {
      this.activeTestMatchId = null;
      throw new NotFoundException('Тест-лобби уже недоступно');
    }

    const allIds = [...match.teamAIds, ...match.teamBIds];

    // Already in the match — just redirect
    if (allIds.includes(adminId) && new Set(allIds).size > 1) {
      this.gateway.emitMatchFound([adminId], match.id);
      return match;
    }

    const hostId = match.hostId;

    // Replace a placeholder slot (= hostId used more than once).
    // Fill teamB slots first, keeping the host anchored in teamA[0].
    const tryReplace = (ids: number[]): number[] | null => {
      // Find last index of a duplicate hostId
      const count = ids.filter((id) => id === hostId).length;
      if (count > 1) {
        const idx = ids.lastIndexOf(hostId);
        const updated = [...ids];
        updated[idx] = adminId;
        return updated;
      }
      return null;
    };

    const newB = tryReplace(match.teamBIds);
    if (newB) {
      match.teamBIds = newB;
    } else {
      const newA = tryReplace(match.teamAIds);
      if (newA) {
        match.teamAIds = newA;
      } else {
        throw new NotFoundException('Тест-лобби уже заполнено');
      }
    }

    const saved = await this.matchRepo.save(match);
    this.gateway.emitMatchFound([adminId], saved.id);
    return saved;
  }

  async getActiveTestMatch(): Promise<{
    matchId: number;
    players: { id: number; name: string }[];
    slots: number;
    filled: number;
  } | null> {
    if (!this.activeTestMatchId) return null;

    const match = await this.matchRepo.findOne({ where: { id: this.activeTestMatchId } });
    if (!match || match.status !== MatchStatus.READY_CHECK) {
      this.activeTestMatchId = null;
      return null;
    }

    const allIds = [...match.teamAIds, ...match.teamBIds];
    const uniqueIds = [...new Set(allIds)];
    const users = uniqueIds.length ? await this.userRepo.findBy({ id: In(uniqueIds) }) : [];
    const nameMap = Object.fromEntries(users.map((u) => [u.id, u.gameNickname || u.firstName]));

    // Count real (non-placeholder) slots: total slots minus duplicate hostId count
    const hostId = match.hostId;
    const placeholders = allIds.filter((id) => id === hostId).length - 1; // one real, rest placeholders
    const filled = allIds.length - placeholders;

    return {
      matchId: match.id,
      players: uniqueIds.map((id) => ({ id, name: nameMap[id] || `#${id}` })),
      slots: allIds.length,
      filled,
    };
  }

  /** Called when test match is no longer needed (e.g. moved past ready_check) */
  clearActiveTestMatch() {
    this.activeTestMatchId = null;
  }

  // ── Moderator management ─────────────────────────────────────────────────

  async setModerator(id: number, value: boolean) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.isModerator = value;
    return this.userRepo.save(user);
  }

  // ── KD Confirmation ───────────────────────────────────────────────────────

  async getMatchesForKd(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [matches, total] = await this.matchRepo.findAndCount({
      where: [
        { status: MatchStatus.RESULT_PENDING, kdSubmitted: false },
        { status: MatchStatus.COMPLETED, kdSubmitted: false },
      ],
      order: { updatedAt: 'DESC' },
      take: limit,
      skip,
    });

    const enriched = await Promise.all(
      matches.map(async (m) => {
        const allIds = [...m.teamAIds, ...m.teamBIds];
        const users = allIds.length
          ? await this.userRepo.findBy({ id: In(allIds) })
          : [];
        const nameMap = Object.fromEntries(
          users.map((u) => [u.id, { name: u.gameNickname || u.firstName, gameId: u.gameId }])
        );
        return {
          ...m,
          players: allIds.map((uid) => ({
            userId: uid,
            name: nameMap[uid]?.name || `#${uid}`,
            gameId: nameMap[uid]?.gameId || '',
            team: m.teamAIds.includes(uid) ? 'A' : 'B',
          })),
        };
      }),
    );

    return { matches: enriched, total };
  }

  async submitKd(
    matchId: number,
    entries: { userId: number; kills: number; deaths: number; assists: number }[],
    totalRounds?: number,
  ) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    if (match.kdSubmitted) throw new BadRequestException('KD уже подтверждён для этого матча');

    const rounds = (totalRounds != null && !isNaN(totalRounds) && totalRounds > 0)
      ? totalRounds
      : (match.totalRounds ?? 0);

    if (totalRounds != null && !isNaN(totalRounds)) {
      match.totalRounds = totalRounds;
    }

    for (const entry of entries) {
      // ── Per-match stat formulas ─────────────────────────────────────────
      const k = entry.kills;
      const d = entry.deaths;
      const a = entry.assists;
      const r = rounds;

      const kdMatch   = d === 0 ? k : Math.round((k / d) * 100) / 100;
      const kprMatch  = r > 0 ? Math.round((k / r) * 1000) / 1000 : 0;
      const aprMatch  = r > 0 ? Math.round((a / r) * 1000) / 1000 : 0;
      const srMatch   = r > 0 ? Math.round(((r - d) / r) * 1000) / 1000 : 0;
      const ratingMatch = Math.round(
        ((kprMatch + srMatch + aprMatch) / 3 + kdMatch - kdMatch / 3.3) * 100,
      ) / 100;

      // ── Update match_player record ──────────────────────────────────────
      let player = await this.playerRepo.findOne({ where: { matchId, userId: entry.userId } });
      if (!player) {
        player = this.playerRepo.create({
          matchId,
          userId: entry.userId,
          team: match.teamAIds.includes(entry.userId) ? 'A' : 'B',
        });
      }
      player.kills      = k;
      player.deaths     = d;
      player.assists    = a;
      player.kdMatch    = kdMatch;
      player.kprMatch   = kprMatch;
      player.aprMatch   = aprMatch;
      player.srMatch    = srMatch;
      player.ratingMatch = ratingMatch;
      await this.playerRepo.save(player);

      // ── Update user running totals ──────────────────────────────────────
      const user = await this.userRepo.findOne({ where: { id: entry.userId } });
      if (user) {
        user.killsTotal   += k;
        user.deathsTotal  += d;
        user.assistsTotal += a;
        user.ratingSum    = Math.round((user.ratingSum + ratingMatch) * 100) / 100;
        await this.userRepo.save(user);
      }
    }

    match.kdSubmitted = true;
    await this.matchRepo.save(match);

    // Apply ELO / coins / XP / match record updates now that KD is confirmed
    if (match.winnerTeam) {
      await this.applyEloChanges(match, match.winnerTeam as 'A' | 'B' | 'draw');
    }

    return match;
  }

  /** Reset kdSubmitted so moderator can re-submit for a match (e.g. to fix wrong stats) */
  async resetKd(matchId: number) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    match.kdSubmitted = false;
    return this.matchRepo.save(match);
  }

  // ── Content creation ──────────────────────────────────────────────────────

  async createMission(data: Partial<Mission>) {
    return this.missionRepo.save(this.missionRepo.create(data));
  }

  async createShopItem(data: Partial<ShopItem>) {
    return this.shopRepo.save(this.shopRepo.create(data));
  }

  async createTournament(data: Partial<Tournament>) {
    return this.tournamentRepo.save(this.tournamentRepo.create(data));
  }

}
