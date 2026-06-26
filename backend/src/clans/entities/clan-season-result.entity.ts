import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

// Снимок итогов клана на момент завершения сезона (архив, хранится бессрочно).
@Entity('clan_season_results')
@Index(['seasonId', 'clanId'], { unique: true })
export class ClanSeasonResult {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'season_id' })
  seasonId: number;

  @Column({ name: 'season_number' })
  seasonNumber: number;

  @Column({ name: 'clan_id' })
  clanId: number;

  // Денормализованные данные клана на момент закрытия (клан мог быть распущен позже)
  @Column()
  tag: string;

  @Column()
  name: string;

  @Column({ name: 'avatar_url', nullable: true })
  avatarUrl: string | null;

  @Column({ name: 'final_rank' })
  finalRank: number;

  @Column({ name: 'season_rating' })
  seasonRating: number;

  @Column({ default: 0 })
  wins: number;

  @Column({ default: 0 })
  losses: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
