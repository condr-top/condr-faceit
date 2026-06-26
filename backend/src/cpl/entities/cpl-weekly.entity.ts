import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/** Снимок недельного результата игрока в лиге (после еженедельного пересчёта). */
@Entity('cpl_weekly_results')
@Index(['seasonId', 'league', 'weekStart', 'userId'], { unique: true })
export class CplWeekly {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'season_id' })
  seasonId: number;

  /** 'cpl' | 'cplq' */
  @Column()
  league: string;

  /** Понедельник недели (UTC, дата начала окна). */
  @Column({ name: 'week_start', type: 'date' })
  weekStart: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'weekly_cpr', type: 'float', default: 0 })
  weeklyCpr: number;

  /** Monthly CPR на момент этого недельного пересчёта (для тай-брейков Season Points). */
  @Column({ name: 'monthly_cpr', type: 'float', default: 0 })
  monthlyCpr: number;

  @Column({ name: 'weekly_wr', type: 'float', default: 0 })
  weeklyWr: number;

  @Column({ name: 'weekly_rating', type: 'float', default: 0 })
  weeklyRating: number;

  @Column({ default: 0 })
  wins: number;

  @Column({ default: 0 })
  matches: number;

  @Column({ default: 0 })
  rank: number;

  @Column({ default: 0 })
  points: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
