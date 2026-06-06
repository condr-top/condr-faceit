import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_achievements')
export class UserAchievement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'achievement_id' })
  achievementId: number;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;
}
