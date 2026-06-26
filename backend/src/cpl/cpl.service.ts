import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { Season } from './entities/season.entity';
import { CplWeekly } from './entities/cpl-weekly.entity';
import { CplStanding } from './entities/cpl-standing.entity';
import { User } from '../users/entities/user.entity';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { MatchPlayer } from '../matches/entities/match-player.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { computeCpr, weeklyPointsForRank, WEEKLY_MIN_MATCHES } from './cpr';

type League = 'cpl' | 'cplq';

interface Agg { played: number; wins: number; losses: number; ratingSum: number; ratingCount: number; lastMatchAt: number }
interface PlayerWindow { userId: number; matches: number; wins: number; winRatePct: number; avgRating: number; cpr: number; lastMatchAt: number }

// ── date helpers (UTC) ──
const startOfWeekUTC = (d: Date) => { const x = new Date(d); const day = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - day); x.setUTCHours(0, 0, 0, 0); return x; };
const startOfMonthUTC = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
const ymd = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class CplService {
  constructor(
    @InjectRepository(Season) private seasonRepo: Repository<Season>,
    @InjectRepository(CplWeekly) private weeklyRepo: Repository<CplWeekly>,
    @InjectRepository(CplStanding) private standingRepo: Repository<CplStanding>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(MatchPlayer) private playerRepo: Repository<MatchPlayer>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  // ── Season management ───────────────────────────────────────────────────────
  async getActiveSeason(): Promise<Season | null> {
    return this.seasonRepo.findOne({ where: { isActive: true }, order: { number: 'DESC' } });
  }

  async startSeason() {
    const prev = await this.getActiveSeason();
    if (prev) { prev.isActive = false; prev.endsAt = new Date(); await this.seasonRepo.save(prev); }
    const last = await this.seasonRepo.findOne({ where: {}, order: { number: 'DESC' } });
    const now = new Date();
    const ends = new Date(now); ends.setUTCMonth(ends.getUTCMonth() + 1);
    return this.seasonRepo.save(this.seasonRepo.create({ number: (last?.number ?? 0) + 1, startsAt: now, endsAt: ends, isActive: true }));
  }

  async stopSeason() {
    const s = await this.getActiveSeason();
    if (!s) throw new BadRequestException('Нет активного сезона');
    s.isActive = false; s.endsAt = new Date();
    return this.seasonRepo.save(s);
  }

  // ── Aggregate league matches in a window → per-user stats → CPR ─────────────
  private async aggregate(league: League, from: Date, to: Date): Promise<Map<number, PlayerWindow>> {
    const matches = await this.matchRepo.find({
      where: { league, status: MatchStatus.COMPLETED, endedAt: Between(from, to) },
    });
    const acc = new Map<number, Agg>();
    const ensure = (id: number) => { if (!acc.has(id)) acc.set(id, { played: 0, wins: 0, losses: 0, ratingSum: 0, ratingCount: 0, lastMatchAt: 0 }); return acc.get(id)!; };

    for (const m of matches) {
      const ids = [...new Set([...m.teamAIds, ...m.teamBIds])];
      const at = m.endedAt ? new Date(m.endedAt).getTime() : 0;
      for (const uid of ids) {
        const a = ensure(uid);
        a.played += 1;
        a.lastMatchAt = Math.max(a.lastMatchAt, at); // когда «достигнут» CPR (последний матч окна)
        const isA = m.teamAIds.includes(uid);
        if (m.winnerTeam === 'A' || m.winnerTeam === 'B') {
          if ((isA && m.winnerTeam === 'A') || (!isA && m.winnerTeam === 'B')) a.wins += 1; else a.losses += 1;
        }
      }
    }

    // per-match ratings
    const matchIds = matches.map((m) => m.id);
    const kdMap = new Map(matches.map((m) => [m.id, m.kdSubmitted]));
    if (matchIds.length) {
      const players = await this.playerRepo.find({ where: { matchId: In(matchIds) } });
      for (const p of players) {
        if (!kdMap.get(p.matchId)) continue;
        const r = Number(p.ratingMatch ?? 0);
        if (r > 0) { const a = ensure(p.userId); a.ratingSum += r; a.ratingCount += 1; }
      }
    }

    const out = new Map<number, PlayerWindow>();
    for (const [uid, a] of acc) {
      const decided = a.wins + a.losses;
      const winRatePct = decided > 0 ? (a.wins / decided) * 100 : 0;
      const avgRating = a.ratingCount > 0 ? a.ratingSum / a.ratingCount : 0;
      const { cpr } = computeCpr({ winRatePct, avgRating, matches: a.played });
      out.set(uid, { userId: uid, matches: a.played, wins: a.wins, winRatePct, avgRating, cpr, lastMatchAt: a.lastMatchAt });
    }
    return out;
  }

  private async leagueMembers(league: League): Promise<User[]> {
    return this.userRepo.find({ where: league === 'cpl' ? { cplAccess: true } : { cplqAccess: true } });
  }

  // ── Weekly recalculation (cron + manual) ─────────────────────────────────────
  @Cron('0 0 3 * * 1') // каждый понедельник 03:00 UTC
  async weeklyCron() { try { await this.runWeeklyRecalc(false); } catch (e) { /* silent */ } }

  async runWeeklyRecalc(useCurrentWeek = false) {
    const season = await this.getActiveSeason();
    if (!season) return { ok: false, reason: 'no_active_season' };
    const now = new Date();
    const weekStart = useCurrentWeek ? startOfWeekUTC(now) : new Date(startOfWeekUTC(now).getTime() - 7 * 86400000);
    const weekEnd = useCurrentWeek ? now : startOfWeekUTC(now);
    const monthStart = startOfMonthUTC(now);

    for (const league of ['cplq', 'cpl'] as League[]) {
      const monthly = await this.aggregate(league, monthStart, now);
      await this.recalcLeagueWeek(season, league, weekStart, weekEnd, monthly);
    }
    // Danger Zone + Elimination — только CPL-Q, по Monthly CPR
    await this.recalcDangerAndElimination(monthStart, now);

    return { ok: true, season: season.number, weekStart: ymd(weekStart) };
  }

  private async recalcLeagueWeek(season: Season, league: League, weekStart: Date, weekEnd: Date, monthly: Map<number, PlayerWindow>) {
    const stats = await this.aggregate(league, weekStart, weekEnd);
    const members = await this.leagueMembers(league);
    const memberIds = new Set(members.map((m) => m.id));

    // только участники лиги с >= 10 матчей за неделю
    const eligible = [...stats.values()].filter((s) => memberIds.has(s.userId) && s.matches >= WEEKLY_MIN_MATCHES);
    // п.6: Weekly CPR → WR → Avg Rating → побед → матчей → более раннее достижение CPR
    eligible.sort((a, b) =>
      b.cpr - a.cpr || b.winRatePct - a.winRatePct || b.avgRating - a.avgRating || b.wins - a.wins || b.matches - a.matches || (a.lastMatchAt - b.lastMatchAt),
    );

    const wk = ymd(weekStart);
    for (let i = 0; i < eligible.length; i++) {
      const s = eligible[i];
      const rank = i + 1;
      const points = weeklyPointsForRank(rank);

      let row = await this.weeklyRepo.findOne({ where: { seasonId: season.id, league, weekStart: wk, userId: s.userId } });
      const prevPoints = row?.points ?? 0;
      if (!row) row = this.weeklyRepo.create({ seasonId: season.id, league, weekStart: wk, userId: s.userId });
      row.weeklyCpr = s.cpr; row.weeklyWr = Math.round(s.winRatePct * 10) / 10; row.weeklyRating = Math.round(s.avgRating * 100) / 100;
      row.monthlyCpr = Math.round((monthly.get(s.userId)?.cpr ?? 0) * 100) / 100;
      row.wins = s.wins; row.matches = s.matches; row.rank = rank; row.points = points;
      await this.weeklyRepo.save(row);

      // Season Points = сумма недельных; обновляем дельтой (идемпотентно при пересчёте недели)
      if (points - prevPoints !== 0) {
        let st = await this.standingRepo.findOne({ where: { seasonId: season.id, league, userId: s.userId } });
        if (!st) st = this.standingRepo.create({ seasonId: season.id, league, userId: s.userId, seasonPoints: 0 });
        st.seasonPoints = Math.max(0, st.seasonPoints + (points - prevPoints));
        await this.standingRepo.save(st);
      }

      if (points > 0) {
        this.notifRepo.save(this.notifRepo.create({
          userId: s.userId, type: 'cpl_points', title: 'Очки недели начислены',
          body: `${league.toUpperCase()} · место #${rank} · +${points} Season Points`,
          meta: { league, rank, points },
        })).catch(() => {});
      }
    }
  }

  // Danger Zone (нижние 10%) и Weekly Elimination (нижние 5%) для CPL-Q по Monthly CPR.
  private async recalcDangerAndElimination(monthStart: Date, now: Date) {
    const members = await this.leagueMembers('cplq');
    if (members.length === 0) return;
    const monthly = await this.aggregate('cplq', monthStart, now);

    // п.11 тай-брейк #5: Weekly CPR последней недели — берём свежайший недельный снимок по игроку
    const weeklyRows = await this.weeklyRepo.find({ where: { league: 'cplq', userId: In(members.map((m) => m.id)) }, order: { weekStart: 'DESC' } });
    const lastWeeklyCpr = new Map<number, number>();
    for (const w of weeklyRows) if (!lastWeeklyCpr.has(w.userId)) lastWeeklyCpr.set(w.userId, w.weeklyCpr);

    const rows = members.map((m) => {
      const s = monthly.get(m.id);
      return {
        userId: m.id,
        cpr: s?.cpr ?? 0,
        wr: s?.winRatePct ?? 0,
        rating: s?.avgRating ?? 0,
        wins: s?.wins ?? 0,
        matches: s?.matches ?? 0,
        lastWeekly: lastWeeklyCpr.get(m.id) ?? 0,
        lastMatchAt: s?.lastMatchAt ?? 0,
      };
    });
    // worst-first (п.11): ниже Monthly CPR → ниже WR → ниже rating → меньше побед → меньше матчей
    //   → ниже Weekly CPR последней недели → более позднее достижение Monthly CPR (хуже = вылетает первым)
    rows.sort((a, b) =>
      a.cpr - b.cpr || a.wr - b.wr || a.rating - b.rating || a.wins - b.wins || a.matches - b.matches
      || a.lastWeekly - b.lastWeekly || (b.lastMatchAt - a.lastMatchAt),
    );

    const eliminateCount = Math.floor(rows.length * 0.05);
    const dangerCount = Math.floor(rows.length * 0.10);
    const eliminate = rows.slice(0, eliminateCount).map((r) => r.userId);
    const danger = rows.slice(0, dangerCount).map((r) => r.userId);
    const eliminateSet = new Set(eliminate);
    const dangerSet = new Set(danger);

    for (const m of members) {
      if (eliminateSet.has(m.id)) {
        m.cplqAccess = false; m.cplqDanger = false;
        await this.userRepo.save(m);
        this.notifRepo.save(this.notifRepo.create({
          userId: m.id, type: 'cpl_eliminated', title: 'Вылет из CPL-Q',
          body: 'По итогам недели вы покинули CONDR Pro League Qualifications. Удачи в следующем заходе!',
          meta: {},
        })).catch(() => {});
      } else {
        const inDanger = dangerSet.has(m.id);
        if (m.cplqDanger !== inDanger) {
          m.cplqDanger = inDanger;
          await this.userRepo.save(m);
          if (inDanger) {
            this.notifRepo.save(this.notifRepo.create({
              userId: m.id, type: 'cpl_danger', title: '⚠️ Danger Zone (CPL-Q)',
              body: 'Вы в зоне риска вылета. Сыграйте активнее и улучшите результаты на этой неделе.',
              meta: {},
            })).catch(() => {});
          }
        }
      }
    }
  }

  // ── Public reads (CPR никогда не отдаём) ─────────────────────────────────────
  private async briefs(ids: number[]) {
    const us = ids.length ? await this.userRepo.findBy({ id: In(ids) }) : [];
    const map = new Map(us.map((u) => [u.id, u]));
    return (id: number) => { const u = map.get(id); return { id, nickname: u?.gameNickname || u?.firstName || `#${id}`, avatarUrl: u?.avatarUrl ?? null, isVerified: u?.isVerified ?? false }; };
  }

  /** Тай-брейк данные по сезону из недельных снимков (п.13). */
  private async tieBreakData(seasonId: number, league: League) {
    const weeks = await this.weeklyRepo.find({ where: { seasonId, league } });
    const m = new Map<number, { weeklyWins: number; top3: number; avgMonthly: number; bestWeekly: number; lastMonthly: number; lastWeek: string; firstPointsWeek: string }>();
    for (const w of weeks) {
      if (!m.has(w.userId)) m.set(w.userId, { weeklyWins: 0, top3: 0, avgMonthly: 0, bestWeekly: 0, lastMonthly: 0, lastWeek: '', firstPointsWeek: '9999' });
      const d = m.get(w.userId)!;
      if (w.rank === 1) d.weeklyWins += 1;
      if (w.rank <= 3) d.top3 += 1;
      d.bestWeekly = Math.max(d.bestWeekly, w.weeklyCpr);
      if (w.weekStart > d.lastWeek) { d.lastWeek = w.weekStart; d.lastMonthly = w.monthlyCpr; }
      if (w.points > 0 && w.weekStart < d.firstPointsWeek) d.firstPointsWeek = w.weekStart;
    }
    // avgMonthly = среднее monthlyCpr по неделям
    const sums = new Map<number, { s: number; n: number }>();
    for (const w of weeks) { const a = sums.get(w.userId) ?? { s: 0, n: 0 }; a.s += w.monthlyCpr; a.n += 1; sums.set(w.userId, a); }
    for (const [uid, a] of sums) { const d = m.get(uid); if (d) d.avgMonthly = a.n ? a.s / a.n : 0; }
    return m;
  }

  async seasonLeaderboard(league: League) {
    const season = await this.getActiveSeason();
    if (!season) return { season: null, league, rows: [] };
    const standings = await this.standingRepo.find({ where: { seasonId: season.id, league } });
    const tb = await this.tieBreakData(season.id, league);
    const def = { weeklyWins: 0, top3: 0, avgMonthly: 0, bestWeekly: 0, lastMonthly: 0, lastWeek: '', firstPointsWeek: '9999' };
    standings.sort((a, b) => {
      const ta = tb.get(a.userId) ?? def, tbb = tb.get(b.userId) ?? def;
      return b.seasonPoints - a.seasonPoints
        || tbb.weeklyWins - ta.weeklyWins
        || tbb.top3 - ta.top3
        || tbb.avgMonthly - ta.avgMonthly
        || tbb.bestWeekly - ta.bestWeekly
        || tbb.lastMonthly - ta.lastMonthly
        || (ta.firstPointsWeek < tbb.firstPointsWeek ? -1 : ta.firstPointsWeek > tbb.firstPointsWeek ? 1 : 0);
    });
    const brief = await this.briefs(standings.map((s) => s.userId));
    return {
      season: { number: season.number, startsAt: season.startsAt, endsAt: season.endsAt },
      league,
      rows: standings.map((s, i) => ({ rank: i + 1, points: s.seasonPoints, user: brief(s.userId) })),
    };
  }

  /** Статистика игрока в лиге за ТЕКУЩИЙ сезон (для профиля). CPR не отдаётся. */
  async playerLeagueStats(userId: number, league: League) {
    const season = await this.getActiveSeason();
    if (!season) return { season: null, league, hasAccess: false, matches: 0, wins: 0, losses: 0, winRate: 0, avgRating: 0, seasonPoints: 0, rank: null, total: 0 };
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const hasAccess = league === 'cpl' ? !!user?.cplAccess : !!user?.cplqAccess;
    const agg = await this.aggregate(league, season.startsAt, new Date());
    const s = agg.get(userId);
    const standings = await this.standingRepo.find({ where: { seasonId: season.id, league }, order: { seasonPoints: 'DESC' } });
    const idx = standings.findIndex((x) => x.userId === userId);
    const losses = s ? Math.max(0, s.matches - s.wins) : 0;
    return {
      season: { number: season.number, endsAt: season.endsAt },
      league, hasAccess,
      matches: s?.matches ?? 0,
      wins: s?.wins ?? 0,
      losses,
      winRate: s ? Math.round(s.winRatePct * 10) / 10 : 0,
      avgRating: s ? Math.round(s.avgRating * 100) / 100 : 0,
      seasonPoints: idx >= 0 ? standings[idx].seasonPoints : 0,
      rank: idx >= 0 ? idx + 1 : null,
      total: standings.length,
    };
  }

  async myStatus(userId: number) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const season = await this.getActiveSeason();
    const out: any = {
      season: season ? { number: season.number, endsAt: season.endsAt } : null,
      cplAccess: !!user?.cplAccess,
      cplqAccess: !!user?.cplqAccess,
      cplqDanger: !!user?.cplqDanger,
      leagues: {},
    };
    if (!season) return out;
    for (const league of ['cpl', 'cplq'] as League[]) {
      const has = league === 'cpl' ? user?.cplAccess : user?.cplqAccess;
      if (!has) continue;
      const all = await this.standingRepo.find({ where: { seasonId: season.id, league }, order: { seasonPoints: 'DESC' } });
      const idx = all.findIndex((s) => s.userId === userId);
      out.leagues[league] = { points: idx >= 0 ? all[idx].seasonPoints : 0, rank: idx >= 0 ? idx + 1 : null, total: all.length };
    }
    return out;
  }
}
