import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('user_achievements')
@Index(['userId', 'achievementKey'], { unique: false })
export class UserAchievement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  /** Legacy numeric id (kept nullable for back-compat; new rows use achievementKey). */
  @Column({ name: 'achievement_id', nullable: true })
  achievementId: number | null;

  /** Stable string key from the code catalog (ACHIEVEMENTS). */
  @Column({ name: 'achievement_key', nullable: true })
  achievementKey: string | null;

  /** Whether the coin reward has been collected. */
  @Column({ default: false })
  claimed: boolean;

  @CreateDateColumn({ name: 'unlocked_at' })
  unlockedAt: Date;
}
