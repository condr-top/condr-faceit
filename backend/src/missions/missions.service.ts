import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { Mission, MissionType, MissionDifficulty } from './entities/mission.entity';
import { UserMission } from './entities/user-mission.entity';
import { User } from '../users/entities/user.entity';
import { Notification } from '../notifications/entities/notification.entity';

// ─── Daily mission pool ───────────────────────────────────────────────────────
const DAILY_POOL: Omit<Mission, 'id' | 'createdAt' | 'isActive'>[] = [
  // EASY
  { title: 'Первый шаг',        description: 'Сыграй 1 матч',          missionKey: 'play_matches', goal: 1,  difficulty: MissionDifficulty.EASY,   type: MissionType.DAILY, rewardCoins: 30  },
  { title: 'Убийца',            description: 'Набери 20 убийств',       missionKey: 'get_kills',    goal: 20, difficulty: MissionDifficulty.EASY,   type: MissionType.DAILY, rewardCoins: 40  },
  { title: 'Помощник',          description: 'Набери 5 ассистов',       missionKey: 'get_assists',  goal: 5,  difficulty: MissionDifficulty.EASY,   type: MissionType.DAILY, rewardCoins: 30  },
  { title: 'Первая победа',     description: 'Победи в 1 матче',        missionKey: 'win_matches',  goal: 1,  difficulty: MissionDifficulty.EASY,   type: MissionType.DAILY, rewardCoins: 50  },
  { title: 'Выносливость',      description: 'Доиграй 3 матча до конца',missionKey: 'play_matches', goal: 3,  difficulty: MissionDifficulty.EASY,   type: MissionType.DAILY, rewardCoins: 45  },
  // MEDIUM
  { title: 'На разогреве',      description: 'Сыграй 3 матча',          missionKey: 'play_matches', goal: 3,  difficulty: MissionDifficulty.MEDIUM,  type: MissionType.DAILY, rewardCoins: 75 },
  { title: 'Жнец',              description: 'Набери 40 убийств',       missionKey: 'get_kills',    goal: 40, difficulty: MissionDifficulty.MEDIUM,  type: MissionType.DAILY, rewardCoins: 80 },
  { title: 'Поддержка команды', description: 'Набери 10 ассистов',      missionKey: 'get_assists',  goal: 10, difficulty: MissionDifficulty.MEDIUM,  type: MissionType.DAILY, rewardCoins: 60 },
  { title: 'Победитель',        description: 'Победи в 2 матчах',       missionKey: 'win_matches',  goal: 2,  difficulty: MissionDifficulty.MEDIUM,  type: MissionType.DAILY, rewardCoins: 100 },
  { title: 'Лучший игрок',      description: 'Стань MVP 1 раз',         missionKey: 'become_mvp',   goal: 1,  difficulty: MissionDifficulty.MEDIUM,  type: MissionType.DAILY, rewardCoins: 90 },
  // HARD
  { title: 'Ветеран',           description: 'Сыграй 5 матчей',         missionKey: 'play_matches', goal: 5,  difficulty: MissionDifficulty.HARD,    type: MissionType.DAILY, rewardCoins: 150 },
  { title: 'Машина смерти',     description: 'Набери 60 убийств',       missionKey: 'get_kills',    goal: 60, difficulty: MissionDifficulty.HARD,    type: MissionType.DAILY, rewardCoins: 160 },
  { title: 'Незаменимый',       description: 'Набери 20 ассистов',      missionKey: 'get_assists',  goal: 20, difficulty: MissionDifficulty.HARD,    type: MissionType.DAILY, rewardCoins: 120 },
  { title: 'Доминация',         description: 'Победи в 3 матчах',       missionKey: 'win_matches',  goal: 3,  difficulty: MissionDifficulty.HARD,    type: MissionType.DAILY, rewardCoins: 200 },
  { title: 'Звезда матча',      description: 'Стань MVP 2 раза',        missionKey: 'become_mvp',   goal: 2,  difficulty: MissionDifficulty.HARD,    type: MissionType.DAILY, rewardCoins: 180 },
  { title: 'Неудержимый',       description: 'Победи 2 матча подряд',   missionKey: 'win_streak',   goal: 2,  difficulty: MissionDifficulty.HARD,    type: MissionType.DAILY, rewardCoins: 200 },
  { title: 'Легенда дня',       description: 'Стань MVP 3 раза',        missionKey: 'become_mvp',   goal: 3,  difficulty: MissionDifficulty.HARD,    type: MissionType.DAILY, rewardCoins: 250 },
];

const DAILY_BONUS_COINS = 100;

const STREAK_REWARDS: Record<number, { coins: number; label: string }> = {
  3:  { coins: 150,  label: '3 дня подряд' },
  7:  { coins: 500,  label: '7 дней подряд' },
  14: { coins: 1000, label: '14 дней подряд' },
  30: { coins: 3000, label: '30 дней подряд' },
};

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function nextMidnightUTC(): Date {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

// ─────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MissionsService implements OnModuleInit {
  constructor(
    @InjectRepository(Mission)     private missionRepo:     Repository<Mission>,
    @InjectRepository(UserMission) private userMissionRepo: Repository<UserMission>,
    @InjectRepository(User)        private userRepo:        Repository<User>,
    @InjectRepository(Notification) private notifRepo:      Repository<Notification>,
  ) {}

  // ── Seed daily pool on startup ──────────────────────────────────────────────
  async onModuleInit() {
    const existing = await this.missionRepo.count({ where: { type: MissionType.DAILY } });
    if (existing === 0) {
      for (const m of DAILY_POOL) {
        await this.missionRepo.save(this.missionRepo.create({ ...m, isActive: true }));
      }
    }
  }

  // ── Get / lazily assign today's 3 daily missions ───────────────────────────
  async getUserDailyMissions(userId: number) {
    const now  = new Date();
    const active = await this.userMissionRepo.find({
      where: { userId, expiresAt: MoreThan(now) },
    });

    if (active.length < 3) {
      await this.assignDailyMissions(userId);
      return this.buildMissionResponse(userId);
    }

    return this.buildMissionResponse(userId);
  }

  private async buildMissionResponse(userId: number) {
    const now    = new Date();
    const active = await this.userMissionRepo.find({
      where: { userId, expiresAt: MoreThan(now) },
    });

    const missionIds = active.map(um => um.missionId);
    const missions   = missionIds.length
      ? await this.missionRepo.findBy({ id: In(missionIds) })
      : [];

    const user = await this.userRepo.findOne({ where: { id: userId } });
    const today = todayUTC();
    const allCompleted  = active.length === 3 && active.every(um => um.isCompleted);
    const bonusClaimed  = user?.missionStreakLastDate === today;
    const expiresAt     = active[0]?.expiresAt ?? nextMidnightUTC();
    const msLeft        = expiresAt.getTime() - Date.now();

    return {
      missions: active.map(um => {
        const m = missions.find(m => m.id === um.missionId);
        return {
          userMissionId: um.id,
          missionId: m?.id,
          title:       m?.title       ?? '',
          description: m?.description ?? '',
          difficulty:  m?.difficulty  ?? 'easy',
          goal:        m?.goal        ?? 1,
          rewardCoins: m?.rewardCoins ?? 0,
          progress:    um.progress,
          isCompleted: um.isCompleted,
          isClaimed:   um.isClaimed,
        };
      }),
      allCompleted,
      bonusClaimed,
      bonusCoins:    DAILY_BONUS_COINS,
      missionStreak: user?.missionStreak ?? 0,
      msUntilReset:  Math.max(0, msLeft),
    };
  }

  private async assignDailyMissions(userId: number) {
    // Remove expired (or any old) daily user missions
    await this.userMissionRepo
      .createQueryBuilder()
      .delete()
      .from(UserMission)
      .where('user_id = :userId', { userId })
      .execute();

    const pool = await this.missionRepo.find({
      where: { type: MissionType.DAILY, isActive: true },
    });

    const byDiff = (d: MissionDifficulty) => pool.filter(m => m.difficulty === d);
    const pick   = (arr: Mission[]) => arr[Math.floor(Math.random() * arr.length)];

    const easy   = byDiff(MissionDifficulty.EASY);
    const medium = byDiff(MissionDifficulty.MEDIUM);
    const hard   = byDiff(MissionDifficulty.HARD);

    const selected = [pick(easy), pick(medium), pick(hard)].filter(Boolean);
    const expires  = nextMidnightUTC();

    for (const m of selected) {
      await this.userMissionRepo.save(
        this.userMissionRepo.create({
          userId,
          missionId: m.id,
          progress:    0,
          isCompleted: false,
          isClaimed:   false,
          expiresAt:   expires,
        }),
      );
    }
  }

  // ── Claim individual mission reward ────────────────────────────────────────
  async claimReward(userId: number, userMissionId: number) {
    const um = await this.userMissionRepo.findOne({
      where: { id: userMissionId, userId },
    });
    if (!um || !um.isCompleted || um.isClaimed) throw new Error('Cannot claim');

    const m = await this.missionRepo.findOne({ where: { id: um.missionId } });
    if (!m) throw new Error('Mission not found');

    um.isClaimed = true;
    await this.userMissionRepo.save(um);

    const user = await this.userRepo.findOne({ where: { id: userId } });
    user.coins += m.rewardCoins;
    await this.userRepo.save(user);

    return { coins: m.rewardCoins };
  }

  // ── Claim daily bonus (all 3 done) ─────────────────────────────────────────
  async claimDailyBonus(userId: number) {
    const now    = new Date();
    const active = await this.userMissionRepo.find({
      where: { userId, expiresAt: MoreThan(now) },
    });

    if (active.length !== 3 || !active.every(um => um.isCompleted)) {
      throw new Error('Не все задания выполнены');
    }

    const user  = await this.userRepo.findOne({ where: { id: userId } });
    const today = todayUTC();

    if (user.missionStreakLastDate === today) {
      throw new Error('Бонус уже получен сегодня');
    }

    // Calculate streak
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().slice(0, 10);

    if (user.missionStreakLastDate === yDate) {
      user.missionStreak += 1;
    } else {
      user.missionStreak = 1;
    }
    user.missionStreakLastDate = today;

    user.coins += DAILY_BONUS_COINS;

    // Streak milestone reward
    const streakReward = STREAK_REWARDS[user.missionStreak];
    if (streakReward) {
      user.coins += streakReward.coins;
    }

    await this.userRepo.save(user);

    // Notification
    await this.notifRepo.save(this.notifRepo.create({
      userId,
      type:  'mission_bonus',
      title: 'Все задания выполнены!',
      body:  streakReward
        ? `Бонус получен! ${streakReward.label} — +${DAILY_BONUS_COINS + streakReward.coins} монет`
        : `Ежедневный бонус: +${DAILY_BONUS_COINS} монет. Стрик: ${user.missionStreak} дней`,
      meta: { streak: user.missionStreak },
    }));

    return {
      coins:          DAILY_BONUS_COINS + (streakReward?.coins ?? 0),
      missionStreak:  user.missionStreak,
      streakReward:   streakReward ?? null,
    };
  }

  // ── Update progress (called after match completion) ─────────────────────────
  async updateDailyProgress(userId: number, key: string, increment: number) {
    if (increment <= 0) return;
    const now    = new Date();
    const active = await this.userMissionRepo.find({
      where: { userId, expiresAt: MoreThan(now), isCompleted: false },
    });
    if (!active.length) return;

    const missionIds = active.map(um => um.missionId);
    const missions   = await this.missionRepo.findBy({ id: In(missionIds) });

    for (const um of active) {
      const m = missions.find(m => m.id === um.missionId);
      if (!m || m.missionKey !== key) continue;

      um.progress = Math.min(um.progress + increment, m.goal);
      if (um.progress >= m.goal) um.isCompleted = true;
      await this.userMissionRepo.save(um);
    }
  }

  // ── Legacy: keep old getUserMissions for any remaining callers ─────────────
  async getUserMissions(userId: number) {
    return this.getUserDailyMissions(userId);
  }

  async claimRewardLegacy(userId: number, missionId: number) {
    // Support old API: missionId may be a userMissionId
    return this.claimReward(userId, missionId);
  }
}
