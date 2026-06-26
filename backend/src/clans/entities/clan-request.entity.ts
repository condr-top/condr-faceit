import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type ClanRequestType = 'request' | 'invite';
export type ClanRequestStatus = 'pending' | 'accepted' | 'rejected';

@Entity('clan_requests')
export class ClanRequest {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clan_id' })
  clanId: number;

  @Column({ name: 'user_id' })
  userId: number;

  // request — заявка игрока на вступление; invite — приглашение от клана
  @Column({ default: 'request' })
  type: ClanRequestType;

  @Column({ default: 'pending' })
  status: ClanRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
