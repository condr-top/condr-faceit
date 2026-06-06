import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('elo_history')
export class EloHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'elo_before' })
  eloBefore: number;

  @Column({ name: 'elo_after' })
  eloAfter: number;

  @Column({ name: 'elo_change' })
  eloChange: number;

  // 'match' | 'dodge_penalty' | 'leave_penalty' | 'admin' | 'calibration'
  @Column({ default: 'match' })
  reason: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
