import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum MissionType {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  SEASONAL = 'seasonal',
}

export enum MissionDifficulty {
  EASY   = 'easy',
  MEDIUM = 'medium',
  HARD   = 'hard',
}

@Entity('missions')
export class Mission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column()
  description: string;

  @Column({ type: 'enum', enum: MissionType })
  type: MissionType;

  @Column({ type: 'enum', enum: MissionDifficulty, default: MissionDifficulty.EASY })
  difficulty: MissionDifficulty;

  @Column()
  goal: number;

  @Column({ name: 'reward_coins', default: 0 })
  rewardCoins: number;

  @Column({ name: 'mission_key' })
  missionKey: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
