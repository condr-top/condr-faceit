import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
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
import { DiscordService } from '../discord/discord.service';
import { MissionsService } from '../missions/missions.service';
import { EloHistory } from '../users/entities/elo-history.entity';
import { AppMeta } from './entities/app-meta.entity';

@Injectable()
export class AdminService implements OnModuleInit {
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
    @InjectRepository(AppMeta) private appMetaRepo: Repository<AppMeta>,
    private gateway: AppGateway,
    private missionsService: MissionsService,
    private discordService: DiscordService,
  ) {}

  async onModuleInit() {
    // Одноразовый глобальный сброс статистики и истории матчей (по запросу владельца)
    try {
      await this.runOneTimeGlobalReset();
    } catch (e) {
      console.error('[globalReset] failed:', e);
    }
    // Одноразовая отмена зависших активных матчей (по запросу владельца)
    try {
      await this.cancelActiveMatchesOnce();
    } catch (e) {
      console.error('[cancelActiveMatches] failed:', e);
    }
    // Разовая правка счёта матча #197 (победа N1ckz 13:12)
    try {
      await this.fixMatch197Once();
    } catch (e) {
      console.error('[fixMatch197] failed:', e);
    }
    // Разовый откат удвоенного ELO/коинов у матча #200
    try {
      await this.fixMatch200DoubleEloOnce();
    } catch (e) {
      console.error('[fixMatch200] failed:', e);
    }
    // Лечащий пересчёт агрегатов при старте
    try {
      await this.recalcAllStatTotals();
    } catch (e) {
      console.error('[recalcAllStatTotals] failed:', e);
    }
  }

  /**
   * Одноразово (защита флагом в app_meta) обнуляет статистику ВСЕХ игроков и
   * удаляет всю историю матчей + динамику ELO. Кланы и монеты не трогаются.
   */
  private async runOneTimeGlobalReset(): Promise<void> {
    const FLAG = 'global_reset_2026_06_14';
    const done = await this.appMetaRepo.findOne({ where: { key: FLAG } });
    if (done) return;

    // 1. Обнуляем статистику и ELO у всех пользователей
    await this.userRepo.createQueryBuilder().update(User).set({
      elo: 1000,
      matchesPlayed: 0, matchesWon: 0, matchesLost: 0,
      killsTotal: 0, deathsTotal: 0, assistsTotal: 0,
      ratingSum: 0, winStreak: 0, leaveCount: 0, cooldownUntil: null,
    }).execute();

    // 2. Удаляем историю матчей и динамику ELO (кланы не трогаем)
    await this.matchRepo.query('DELETE FROM match_players');
    await this.matchRepo.query('DELETE FROM matches');
    await this.matchRepo.query('DELETE FROM elo_history');

    await this.appMetaRepo.save(this.appMetaRepo.create({ key: FLAG, value: new Date().toISOString() }));
    console.log('[globalReset] выполнен: статистика и история матчей обнулены для всех');
  }

  /** Разовая правка матча #197: засчитать победу N1ckz со счётом 13:12. */
  private async fixMatch197Once(): Promise<void> {
    const FLAG = 'fix_match_197';
    const done = await this.appMetaRepo.findOne({ where: { key: FLAG } });
    if (done) return;

    const match = await this.matchRepo.findOne({ where: { id: 197 } });
    if (match) {
      // Находим, в какой команде капитан N1ckz
      const caps = await this.userRepo.findBy({ id: In([match.captainAId, match.captainBId].filter(Boolean) as number[]) });
      const n1ckz = caps.find((u) => (u.gameNickname || '').toLowerCase() === 'n1ckz');
      const n1ckzIsA = n1ckz ? n1ckz.id === match.captainAId : true; // по умолчанию A
      // Победившая команда (N1ckz) — 13, соперник — 12
      match.scoreA = n1ckzIsA ? 13 : 12;
      match.scoreB = n1ckzIsA ? 12 : 13;
      match.winnerTeam = n1ckzIsA ? 'A' : 'B';
      match.isDisputed = false;
      match.status = MatchStatus.COMPLETED;
      if (!match.endedAt) match.endedAt = new Date();
      await this.matchRepo.save(match);
      this.gateway.emitToMatch(197, 'match_updated', match);
      console.log(`[fixMatch197] счёт исправлен: A=${match.scoreA} B=${match.scoreB} winner=${match.winnerTeam}`);
    }
    await this.appMetaRepo.save(this.appMetaRepo.create({ key: FLAG, value: new Date().toISOString() }));
  }

  /**
   * Разовый откат лишнего (удвоенного) начисления ELO/коинов по матчу #200.
   * Из-за старого resetKd (без отката) KD ввели дважды → ELO применилось 2 раза.
   * Реверсим ОДНУ лишнюю порцию (player.eloChange / coinsEarned).
   */
  private async fixMatch200DoubleEloOnce(): Promise<void> {
    const FLAG = 'fix_match_200_double_elo';
    const done = await this.appMetaRepo.findOne({ where: { key: FLAG } });
    if (done) return;

    const match = await this.matchRepo.findOne({ where: { id: 200 } });
    if (match && match.kdSubmitted) {
      const allIds = [...new Set([...match.teamAIds, ...match.teamBIds])].filter(Boolean);
      for (const uid of allIds) {
        const player = await this.playerRepo.findOne({ where: { matchId: 200, userId: uid } });
        const user = await this.userRepo.findOne({ where: { id: uid } });
        if (!player || !user) continue;
        user.elo = Math.max(100, user.elo - player.eloChange);     // убираем лишнюю порцию ELO
        user.coins = Math.max(0, user.coins - player.coinsEarned); // и лишние коины
        await this.userRepo.save(user);
      }
      console.log('[fixMatch200] удвоенное ELO/коины откатаны');
    }
    await this.appMetaRepo.save(this.appMetaRepo.create({ key: FLAG, value: new Date().toISOString() }));
  }

  /** Одноразово отменяет все активные (незавершённые) матчи и чистит их голосовые комнаты. */
  private async cancelActiveMatchesOnce(): Promise<void> {
    const FLAG = 'cancel_active_2026_06_14';
    const done = await this.appMetaRepo.findOne({ where: { key: FLAG } });
    if (done) return;

    const active = await this.matchRepo.find({
      where: [
        { status: MatchStatus.READY_CHECK }, { status: MatchStatus.MAP_VETO },
        { status: MatchStatus.IN_PROGRESS }, { status: MatchStatus.RESULT_PENDING },
      ],
    });
    for (const m of active) {
      m.status = MatchStatus.CANCELLED;
      m.endedAt = new Date();
      await this.matchRepo.save(m);
      this.discordService.deleteMatchVoiceRooms(m.voiceChannelTId, m.voiceChannelCTId).catch(() => {});
    }
    await this.appMetaRepo.save(this.appMetaRepo.create({ key: FLAG, value: new Date().toISOString() }));
    console.log(`[cancelActiveMatches] отменено активных матчей: ${active.length}`);
  }

  /**
   * Источник правды — ЗАВЕРШЁННЫЕ матчи игрока (как в истории матчей).
   * Пересчитывает matchesPlayed/Won/Lost и kills/deaths/assists/ratingSum
   * строго по completed-матчам, дедуп легаси-дублей строк (по каждому полю
   * берём значение с наибольшим модулем в рамках одного матча).
   * Идемпотентно. ELO/coins НЕ трогаем.
   */
  private async recalcUserStatTotals(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return;

    const rows = await this.playerRepo.find({ where: { userId } });
    const matchIds = [...new Set(rows.map((r) => r.matchId))];
    const matches = matchIds.length
      ? await this.matchRepo.findBy({ id: In(matchIds) })
      : [];
    const mMap = new Map<number, Match>();
    for (const m of matches) {
      // Клановые матчи и праки НЕ учитываются в личной статистике/ELO игрока
      if (m.status === MatchStatus.COMPLETED && !m.isClanMatch && !m.league) mMap.set(m.id, m);
    }

    const byMatch = new Map<number, MatchPlayer[]>();
    for (const r of rows) {
      if (!mMap.has(r.matchId)) continue; // только завершённые матчи
      const arr = byMatch.get(r.matchId) ?? [];
      arr.push(r);
      byMatch.set(r.matchId, arr);
    }
    const pick = (arr: MatchPlayer[], f: keyof MatchPlayer): number =>
      arr.reduce((acc, r) => (Math.abs(Number(r[f] ?? 0)) > Math.abs(acc) ? Number(r[f] ?? 0) : acc), 0);

    let kills = 0, deaths = 0, assists = 0, ratingSum = 0;
    let played = 0, won = 0, lost = 0;
    for (const [mid, arr] of byMatch) {
      const m = mMap.get(mid)!;
      played += 1;
      kills += pick(arr, 'kills');
      deaths += pick(arr, 'deaths');
      assists += pick(arr, 'assists');
      ratingSum += pick(arr, 'ratingMatch');
      const isTeamA = m.teamAIds.includes(userId);
      if (m.winnerTeam === 'draw') {
        /* ничья — без W/L */
      } else if ((isTeamA && m.winnerTeam === 'A') || (!isTeamA && m.winnerTeam === 'B')) {
        won += 1;
      } else if (m.winnerTeam === 'A' || m.winnerTeam === 'B') {
        lost += 1;
      }
    }

    user.killsTotal = kills;
    user.deathsTotal = deaths;
    user.assistsTotal = assists;
    user.ratingSum = Math.round(ratingSum * 100) / 100;
    user.matchesPlayed = played;
    user.matchesWon = won;
    user.matchesLost = lost;
    await this.userRepo.save(user);
  }

  /** Пересчитать тоталы у всех игроков, у кого есть match_player строки. */
  async recalcAllStatTotals(): Promise<number> {
    const userIds: number[] = (
      await this.playerRepo
        .createQueryBuilder('mp')
        .select('DISTINCT mp.user_id', 'uid')
        .getRawMany()
    ).map((r) => Number(r.uid));
    for (const uid of userIds) {
      await this.recalcUserStatTotals(uid);
    }
    return userIds.length;
  }

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
    // Полный сброс: ELO к стартовому, серия и динамика ELO обнуляются
    user.elo           = 1000;
    user.winStreak     = 0;

    await this.userRepo.save(user);
    // Чистим историю ELO (график динамики)
    await this.eloHistoryRepo.delete({ userId: id });
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
    await this.matchRepo.save(match);

    // Удаляем голосовые комнаты матча
    this.discordService.deleteMatchVoiceRooms(match.voiceChannelTId, match.voiceChannelCTId).catch(() => {});

    // Матч теперь CANCELLED — пересчитываем агрегаты участников (он исключится)
    const affected = [...new Set([...match.teamAIds, ...match.teamBIds])].filter(Boolean);
    for (const uid of affected) await this.recalcUserStatTotals(uid);
    return match;
  }

  private async reverseKdStats(match: Match): Promise<void> {
    const allIds = [...new Set([...match.teamAIds, ...match.teamBIds])];

    for (const userId of allIds) {
      const player = await this.playerRepo.findOne({ where: { matchId: match.id, userId } });
      if (!player) continue;

      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) continue;

      // Reverse ELO, coins (счётчики матчей/стата пересчитываются отдельно
      // через recalcUserStatTotals после смены статуса матча на CANCELLED).
      user.elo    = Math.max(100, user.elo   - player.eloChange);
      user.coins  = Math.max(0,   user.coins - player.coinsEarned);

      await this.userRepo.save(user);

      // Reset the player record stats so history stays clean
      player.kills       = 0; player.deaths      = 0; player.assists    = 0;
      player.kdMatch     = 0; player.kprMatch    = 0; player.aprMatch   = 0;
      player.srMatch     = 0; player.ratingMatch = 0;
      player.eloChange   = 0; player.eloAfter    = 0;
      player.coinsEarned = 0;
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

    // Проставляем счёт, чтобы в истории не было 0:0.
    // Берём счёт капитана выбранной командой-победителем; если его нет —
    // используем любой заявленный счёт, согласованный с выбранным победителем.
    if ((match.scoreA == null || match.scoreB == null || (match.scoreA === 0 && match.scoreB === 0)) && winner !== 'draw') {
      const fromCapA = match.scoreAByCapA != null && match.scoreBByCapA != null ? { a: match.scoreAByCapA, b: match.scoreBByCapA } : null;
      const fromCapB = match.scoreAByCapB != null && match.scoreBByCapB != null ? { a: match.scoreAByCapB, b: match.scoreBByCapB } : null;
      const wantsAWin = winner === 'A';
      const ok = (s: { a: number; b: number } | null) => s && (wantsAWin ? s.a > s.b : s.b > s.a);
      const chosen = ok(wantsAWin ? fromCapA : fromCapB) ? (wantsAWin ? fromCapA : fromCapB)
        : ok(fromCapA) ? fromCapA : ok(fromCapB) ? fromCapB : null;
      if (chosen) { match.scoreA = chosen.a; match.scoreB = chosen.b; }
    }
    match.isDisputed = false;

    // ELO / coins applied only after moderator submits KD
    await this.matchRepo.save(match);

    // Удаляем голосовые комнаты матча
    this.discordService.deleteMatchVoiceRooms(match.voiceChannelTId, match.voiceChannelCTId).catch(() => {});

    // Если K/D уже был внесён до подтверждения результата — матч теперь
    // завершён, пересчитываем агрегаты участников.
    if (match.kdSubmitted) {
      const affected = [...new Set([...match.teamAIds, ...match.teamBIds])].filter(Boolean);
      for (const uid of affected) await this.recalcUserStatTotals(uid);
    }
    return match;
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

  /**
   * Процент модификатора по индивидуальному рейтингу за матч (всегда «в плюс» игроку).
   * rating ≤ 1.00 → 0. rating > 1.00 → floor((rating − 1) · 50): 1.20→10, 1.40→20, 1.45→22.
   */
  private ratingModifierPct(rating: number): number {
    if (!rating || rating <= 1.0) return 0;
    return Math.max(0, Math.floor((rating - 1) * 50));
  }

  /** Коэффициент организованности команды = (размер наибольшего отряда − 1) · 5%. Без отряда — 0. */
  private partyOrgCoef(match: Match, team: number[]): number {
    let maxParty = 0;
    for (const g of match.partyGroups ?? []) {
      if (g.length >= 2 && g.every((id) => team.includes(id))) maxParty = Math.max(maxParty, g.length);
    }
    return maxParty >= 2 ? (maxParty - 1) * 5 : 0;
  }

  /**
   * Знаковый вклад модификатора состава команд (компенсация преимущества отрядов).
   * Разница коэффициентов: команда-андердог получает «+разница», организованная — «−разница».
   * Равные коэффициенты → 0.
   */
  private partyModifierPct(match: Match, isTeamA: boolean): number {
    const coefA = this.partyOrgCoef(match, match.teamAIds);
    const coefB = this.partyOrgCoef(match, match.teamBIds);
    const my = isTeamA ? coefA : coefB;
    const opp = isTeamA ? coefB : coefA;
    if (my === opp) return 0;
    const diff = Math.abs(my - opp);
    return my > opp ? -diff : diff;
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

      const baseChange = this.calcEloChange(won, draw, isCalibration, avgEloMyTeam, avgEloOpponent);

      const player = await this.playerRepo.findOne({
        where: { matchId: match.id, userId: user.id },
      });

      // ── Модификаторы (суммируются, применяются после базового изменения) ──
      // goodPct > 0 — выгоднее игроку (больше за победу / меньше за поражение).
      //  1) личный рейтинг за матч — только вне калибровки;
      //  2) состав команд (компенсация преимущества отрядов) — всегда.
      const ratingPct = isCalibration ? 0 : this.ratingModifierPct(Number(player?.ratingMatch ?? 0));
      const teamPct = this.partyModifierPct(match, isTeamA);
      const goodPct = ratingPct + teamPct;
      const change = draw
        ? 0
        : Math.floor(baseChange * (1 + (baseChange >= 0 ? goodPct : -goodPct) / 100));

      const coinsEarned = won ? 50 : draw ? 30 : 20;

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
      // matchesPlayed/Won/Lost больше НЕ инкрементируем здесь — они
      // пересчитываются из завершённых матчей в recalcUserStatTotals (вызов
      // ниже в submitKd). Тут поддерживаем только winStreak (это серия).
      if (won) {
        user.winStreak = (user.winStreak ?? 0) + 1;
      } else if (!draw) {
        user.winStreak = 0;
      }
      user.coins += coinsEarned;
      await this.userRepo.save(user);

      if (player) {
        player.eloAfter = user.elo;
        player.eloChange = change;
        player.coinsEarned = coinsEarned;
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

  async setVerified(id: number, value: boolean) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.isVerified = value;
    return this.userRepo.save(user);
  }

  async setDmHost(id: number, value: boolean) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.isDmHost = value;
    return this.userRepo.save(user);
  }

  async setCplAccess(id: number, value: boolean) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.cplAccess = value;
    return this.userRepo.save(user);
  }

  async setCplqAccess(id: number, value: boolean) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundException();
    user.cplqAccess = value;
    if (!value) user.cplqDanger = false;
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
    }

    match.kdSubmitted = true;
    await this.matchRepo.save(match);

    // Apply ELO / coins / win-streak now that KD is confirmed.
    // Лиговые матчи (CPL/CPL-Q) не трогают личный ELO/стату — они идут в CPR.
    if (match.winnerTeam && !match.league) {
      await this.applyEloChanges(match, match.winnerTeam as 'A' | 'B' | 'draw');
    }

    // Пересчитываем агрегаты (matchesPlayed/Won/Lost/kills/ratingSum) из
    // источника правды — завершённых матчей. Идемпотентно: повторный ввод K/D
    // больше не раздувает рейтинг.
    const affected = [...new Set([...match.teamAIds, ...match.teamBIds])].filter(Boolean);
    for (const uid of affected) await this.recalcUserStatTotals(uid);

    return match;
  }

  /** Reset kdSubmitted so moderator can re-submit for a match (e.g. to fix wrong stats) */
  async resetKd(matchId: number) {
    const match = await this.matchRepo.findOne({ where: { id: matchId } });
    if (!match) throw new NotFoundException('Match not found');
    // ВАЖНО: при сбросе откатываем уже начисленные ELO/коины, иначе повторный
    // ввод KD начислит ELO второй раз (баг с удвоением ±MMR).
    if (match.kdSubmitted) {
      await this.reverseKdStats(match); // откат ELO/коинов + обнуление player-стату + kdSubmitted=false
    } else {
      match.kdSubmitted = false;
    }
    await this.matchRepo.save(match);
    // Пересчитываем агрегаты участников из источника правды
    const affected = [...new Set([...match.teamAIds, ...match.teamBIds])].filter(Boolean);
    for (const uid of affected) await this.recalcUserStatTotals(uid);
    return match;
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
