import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('achievements')
export class Achievement {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column()
  icon: string;

  @Column({ name: 'achievement_key', unique: true })
  achievementKey: string;

  @Column({ name: 'reward_coins', default: 0 })
  rewardCoins: number;
}
