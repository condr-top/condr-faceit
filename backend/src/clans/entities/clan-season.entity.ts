import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type SeasonStatus = 'active' | 'ended';

// Сезон кланового рейтинга. Между сезонами seasonRating сбрасывается,
// итоги архивируются в clan_season_results (бессрочно).
@Entity('clan_seasons')
export class ClanSeason {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  number: number;

  @Column()
  name: string;

  @Column({ default: 'active' })
  status: SeasonStatus;

  @Column({ name: 'started_at', type: 'timestamp' })
  startedAt: Date;

  @Column({ name: 'ended_at', type: 'timestamp', nullable: true })
  endedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
