import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn, Index } from 'typeorm';

/** Сезонная позиция игрока: сумма Weekly Points за сезон (публичный показатель). */
@Entity('cpl_standings')
@Index(['seasonId', 'league', 'userId'], { unique: true })
export class CplStanding {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'season_id' })
  seasonId: number;

  /** 'cpl' | 'cplq' */
  @Column()
  league: string;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'season_points', default: 0 })
  seasonPoints: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
