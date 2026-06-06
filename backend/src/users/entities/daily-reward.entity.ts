import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('daily_rewards')
export class DailyReward {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'day_streak' })
  dayStreak: number;

  @Column()
  coins: number;

  @Column({ default: 0 })
  xp: number;

  @CreateDateColumn({ name: 'claimed_at' })
  claimedAt: Date;
}
