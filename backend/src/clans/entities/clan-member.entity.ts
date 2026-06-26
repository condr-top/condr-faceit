import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type ClanRole = 'leader' | 'officer' | 'member';

@Entity('clan_members')
export class ClanMember {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clan_id' })
  clanId: number;

  // Один пользователь — только в одном клане
  @Column({ name: 'user_id', unique: true })
  userId: number;

  @Column({ default: 'member' })
  role: ClanRole;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
