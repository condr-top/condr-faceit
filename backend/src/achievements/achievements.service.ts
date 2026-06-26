import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { UserAchievement } from './entities/user-achievement.entity';
import { User } from '../users/entities/user.entity';
import { CoinPurchase, PurchaseStatus } from '../coins/entities/coin-purchase.entity';
import { MatchPlayer } from '../matches/entities/match-player.entity';
import { Match, MatchStatus } from '../matches/entities/match.entity';
import { Notification } from '../notifications/entities/notification.entity';

// ─── Catalog context (everything trackable about a player) ─────────────────────
interface AchCtx {
  user: User;
  donated: number;                 // суммарно куплено CONDR COIN (подтверждённые покупки)
  mapPlayed: Record<string, number>; // сыграно матчей по картам (личные, завершённые)
}

export type AchCategory = 'progress' | 'combat' | 'rank' | 'streak' | 'fun';

interface AchDef {
  key: string;
  title: string;
  description: string;
  icon: string;        // имя иконки на фронте
  color: string;
  category: AchCategory;
  goal: number;
  rewardCoins: number;
  unit?: string;       // 'матчей' / 'побед' / 'убийств' / 'ELO' / 'COIN'
  secret?: boolean;    // скрытая (пасхалка) — описание прячется до анлока
  metric: (c: AchCtx) => number;
}

// ════════════════════════════════════════════════════════════════════════════
//  БАЗОВЫЙ НАБОР ДОСТИЖЕНИЙ  (расширяем вместе позже — просто дополняй массив)
// ════════════════════════════════════════════════════════════════════════════
export const ACHIEVEMENTS: AchDef[] = [
  // ── Прогресс ──
  { key: 'rookie',    title: 'Новобранец',       description: 'Сыграй 10 матчей',                 icon: 'gamepad', color: '#60A5FA', category: 'progress', goal: 10,   rewardCoins: 100,  unit: 'матчей',  metric: c => c.user.matchesPlayed },
  { key: 'addicted',  title: 'Завсегдатай',      description: 'Сыграй 100 матчей',                icon: 'gamepad', color: '#60A5FA', category: 'progress', goal: 100,  rewardCoins: 300,  unit: 'матчей',  metric: c => c.user.matchesPlayed },
  { key: 'nolife',    title: 'Ветеран сервера',  description: 'Сыграй 500 матчей',                icon: 'gamepad', color: '#60A5FA', category: 'progress', goal: 500,  rewardCoins: 1000, unit: 'матчей',  metric: c => c.user.matchesPlayed },

  // ── Бой ──
  { key: 'winner10',  title: 'Победитель',       description: 'Одержи 10 побед',                  icon: 'trophy',  color: '#22C55E', category: 'combat',   goal: 10,   rewardCoins: 150,  unit: 'побед',   metric: c => c.user.matchesWon },
  { key: 'winner100', title: 'Чемпион',          description: 'Одержи 100 побед',                 icon: 'trophy',  color: '#22C55E', category: 'combat',   goal: 100,  rewardCoins: 700,  unit: 'побед',   metric: c => c.user.matchesWon },
  { key: 'frag100',   title: 'Стрелок',          description: 'Набей 100 убийств',                icon: 'target',  color: '#E8092E', category: 'combat',   goal: 100,  rewardCoins: 100,  unit: 'убийств', metric: c => c.user.killsTotal },
  { key: 'frag1000',  title: 'Машина смерти',    description: 'Набей 1000 убийств',               icon: 'skull',   color: '#E8092E', category: 'combat',   goal: 1000, rewardCoins: 600,  unit: 'убийств', metric: c => c.user.killsTotal },

  // ── Стрик ──
  { key: 'streak5',   title: 'Неудержимый',      description: 'Победи в 5 матчах подряд',         icon: 'flame',   color: '#F59E0B', category: 'streak',   goal: 5,    rewardCoins: 300,  unit: 'подряд',  metric: c => c.user.winStreak },

  // ── Ранг ──
  { key: 'elo1500',   title: 'Восходящая звезда',description: 'Достигни 1500 ELO',                icon: 'bolt',    color: '#A855F7', category: 'rank',     goal: 1500, rewardCoins: 400,  unit: 'ELO',     metric: c => c.user.elo },
  { key: 'elo2000',   title: 'Небожитель',       description: 'Достигни 2000 ELO',                icon: 'crown',   color: '#A855F7', category: 'rank',     goal: 2000, rewardCoins: 1000, unit: 'ELO',     metric: c => c.user.elo },

  // ── Карта ──
  { key: 'province25',title: 'Прописка в Провинции', description: 'Сыграй 25 матчей на Province', icon: 'pin',     color: '#0EA5E9', category: 'progress', goal: 25,   rewardCoins: 250,  unit: 'матчей',  metric: c => c.mapPlayed['PROVINCE'] ?? 0 },

  // ── Шуточные ──
  { key: 'gold_balance', title: 'Голда на балике', description: 'Задонать на 10 000 CONDR COIN',  icon: 'coins',   color: '#EAB308', category: 'fun',      goal: 10000, rewardCoins: 500, unit: 'COIN',    metric: c => c.donated },
  { key: 'feeder',    title: 'Кормилец',         description: 'Умри 1000 раз. Бывает.',           icon: 'skull',   color: '#6B7280', category: 'fun',      goal: 1000, rewardCoins: 100,  unit: 'смертей', secret: true, metric: c => c.user.deathsTotal },
];

const PERSONAL_MAPS = ['PRISON', 'SANDSTONE', 'PROVINCE', 'BREEZE', 'HANAMI', 'RUST', 'DUNE'];

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(UserAchievement) private uaRepo: Repository<UserAchievement>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(CoinPurchase) private purchaseRepo: Repository<CoinPurchase>,
    @InjectRepository(MatchPlayer) private playerRepo: Repository<MatchPlayer>,
    @InjectRepository(Match) private matchRepo: Repository<Match>,
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
  ) {}

  // ── Сколько матчей сыграно на каждой карте (личные, завершённые) ──
  private async computeMapPlayed(userId: number): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const m of PERSONAL_MAPS) out[m] = 0;
    const rows = await this.playerRepo.find({ where: { userId } });
    const matchIds = [...new Set(rows.map(r => r.matchId))];
    if (!matchIds.length) return out;
    const matches = await this.matchRepo.findBy({ id: In(matchIds) });
    for (const mt of matches) {
      if (mt.status !== MatchStatus.COMPLETED || mt.isClanMatch) continue;
      const map = (mt.map || '').toUpperCase();
      if (out[map] != null) out[map] += 1;
    }
    return out;
  }

  private async buildCtx(userId: number): Promise<AchCtx | null> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) return null;
    const confirmed = await this.purchaseRepo.find({ where: { userId, status: PurchaseStatus.CONFIRMED } });
    const donated = confirmed.reduce((s, p) => s + (p.coins || 0), 0);
    const mapPlayed = await this.computeMapPlayed(userId);
    return { user, donated, mapPlayed };
  }

  // ── Список достижений игрока с прогрессом + ленивый авто-анлок ──
  async getUserAchievements(userId: number) {
    const ctx = await this.buildCtx(userId);
    if (!ctx) return { achievements: [], unlocked: 0, total: ACHIEVEMENTS.length, claimable: 0 };

    const rows = await this.uaRepo.find({ where: { userId } });
    const rowByKey = new Map(rows.filter(r => r.achievementKey).map(r => [r.achievementKey!, r]));

    const achievements = [];
    for (const a of ACHIEVEMENTS) {
      const raw = a.metric(ctx);
      let row = rowByKey.get(a.key);

      // Первый раз достигли порога — фиксируем анлок навсегда + уведомление
      if (!row && raw >= a.goal) {
        row = await this.uaRepo.save(this.uaRepo.create({ userId, achievementKey: a.key, claimed: false }));
        await this.notifRepo.save(this.notifRepo.create({
          userId, type: 'achievement', title: 'Достижение получено!',
          body: `«${a.title}» — заберите ${a.rewardCoins} монет в разделе Задания`,
          meta: { key: a.key },
        })).catch(() => {});
      }

      const unlocked = !!row;
      achievements.push({
        key: a.key,
        title: a.title,
        description: a.description,
        icon: a.icon,
        color: a.color,
        category: a.category,
        goal: a.goal,
        unit: a.unit ?? '',
        rewardCoins: a.rewardCoins,
        secret: !!a.secret,
        current: unlocked ? a.goal : Math.max(0, Math.min(raw, a.goal)),
        unlocked,
        claimed: row?.claimed ?? false,
        unlockedAt: row?.unlockedAt ?? null,
      });
    }

    const unlockedCount = achievements.filter(a => a.unlocked).length;
    const claimable = achievements.filter(a => a.unlocked && !a.claimed).length;
    return { achievements, unlocked: unlockedCount, total: ACHIEVEMENTS.length, claimable };
  }

  // ── Забрать награду за разблокированное достижение ──
  async claimAchievement(userId: number, key: string) {
    const def = ACHIEVEMENTS.find(a => a.key === key);
    if (!def) throw new Error('Достижение не найдено');

    // На случай, если страницу ещё не открывали — досчитаем и зафиксируем анлок
    await this.getUserAchievements(userId);

    const row = await this.uaRepo.findOne({ where: { userId, achievementKey: key } });
    if (!row) throw new Error('Достижение ещё не разблокировано');
    if (row.claimed) throw new Error('Награда уже получена');

    row.claimed = true;
    await this.uaRepo.save(row);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    user.coins += def.rewardCoins;
    await this.userRepo.save(user);

    return { coins: def.rewardCoins };
  }

  // ── ADMIN ───────────────────────────────────────────────────────────────────
  /** Каталог достижений для админ-панели. */
  getCatalog() {
    return ACHIEVEMENTS.map((a) => ({
      key: a.key, title: a.title, description: a.description,
      icon: a.icon, color: a.color, category: a.category,
      rewardCoins: a.rewardCoins, secret: !!(a as any).secret,
    }));
  }

  /** Выдать достижение игроку вручную (из админки). */
  async grantAchievement(userId: number, key: string) {
    const def = ACHIEVEMENTS.find((a) => a.key === key);
    if (!def) throw new BadRequestException('Достижение не найдено');
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Игрок не найден');

    const existing = await this.uaRepo.findOne({ where: { userId, achievementKey: key } });
    if (existing) return { ok: true, already: true };

    await this.uaRepo.save(this.uaRepo.create({ userId, achievementKey: key, claimed: false }));
    await this.notifRepo.save(this.notifRepo.create({
      userId, type: 'achievement', title: 'Достижение получено!',
      body: def.title, meta: { redirect: '/missions' },
    }));
    return { ok: true };
  }
}
