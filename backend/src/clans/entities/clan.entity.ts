import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('clans')
export class Clan {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  tag: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ nullable: true })
  region: string | null;

  @Column({ nullable: true })
  language: string | null;

  @Column({ default: 1000 })
  rating: number;

  // Сезонный рейтинг — обнуляется между сезонами (история — отдельная таблица в будущем)
  @Column({ name: 'season_rating', default: 1000 })
  seasonRating: number;

  @Column({ default: 0 })
  wins: number;

  @Column({ default: 0 })
  losses: number;

  @Column({ name: 'leader_id' })
  leaderId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
