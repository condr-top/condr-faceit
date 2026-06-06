import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('tournament_participants')
export class TournamentParticipant {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'tournament_id' })
  tournamentId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ default: 'registered' })
  status: string;

  @CreateDateColumn({ name: 'registered_at' })
  registeredAt: Date;
}
