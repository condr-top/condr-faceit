import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tournaments')
export class Tournament {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ name: 'max_participants', default: 16 })
  maxParticipants: number;

  @Column({ name: 'entry_fee', default: 0 })
  entryFee: number;

  @Column({ name: 'prize_pool', default: 0 })
  prizePool: number;

  @Column({ default: 'upcoming' })
  status: string;

  @Column({ name: 'starts_at', nullable: true, type: 'timestamp' })
  startsAt: Date;

  @Column({ name: 'bracket_data', nullable: true, type: 'jsonb' })
  bracketData: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
