import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Achievement } from './entities/achievement.entity';
import { UserAchievement } from './entities/user-achievement.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class AchievementsService {
  constructor(
    @InjectRepository(Achievement) private achievementRepo: Repository<Achievement>,
    @InjectRepository(UserAchievement) private userAchievementRepo: Repository<UserAchievement>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async getUserAchievements(userId: number) {
    const all = await this.achievementRepo.find();
    const unlocked = await this.userAchievementRepo.find({ where: { userId } });
    const unlockedIds = new Set(unlocked.map((ua) => ua.achievementId));

    return all.map((a) => ({
      ...a,
      unlocked: unlockedIds.has(a.id),
      unlockedAt: unlocked.find((ua) => ua.achievementId === a.id)?.unlockedAt || null,
    }));
  }

  async unlock(userId: number, achievementKey: string): Promise<boolean> {
    const achievement = await this.achievementRepo.findOne({ where: { achievementKey } });
    if (!achievement) return false;

    const existing = await this.userAchievementRepo.findOne({
      where: { userId, achievementId: achievement.id },
    });
    if (existing) return false;

    await this.userAchievementRepo.save(
      this.userAchievementRepo.create({ userId, achievementId: achievement.id }),
    );

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user) {
      user.coins += achievement.rewardCoins;
      user.xp += achievement.rewardXp;
      await this.userRepo.save(user);
    }

    return true;
  }
}
