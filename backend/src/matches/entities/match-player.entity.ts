import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('match_players')
export class MatchPlayer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'match_id' })
  matchId: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  team: string;

  @Column({ default: 0 })
  kills: number;

  @Column({ default: 0 })
  deaths: number;

  @Column({ default: 0 })
  assists: number;

  @Column({ name: 'elo_before', default: 0 })
  eloBefore: number;

  @Column({ name: 'elo_after', default: 0 })
  eloAfter: number;

  @Column({ name: 'elo_change', default: 0 })
  eloChange: number;

  @Column({ name: 'coins_earned', default: 0 })
  coinsEarned: number;

  // Per-match calculated stats (filled after moderator submits KD)
  @Column({ name: 'kd_match', type: 'float', default: 0 })
  kdMatch: number;

  @Column({ name: 'kpr_match', type: 'float', default: 0 })
  kprMatch: number;

  @Column({ name: 'apr_match', type: 'float', default: 0 })
  aprMatch: number;

  @Column({ name: 'sr_match', type: 'float', default: 0 })
  srMatch: number;

  @Column({ name: 'rating_match', type: 'float', default: 0 })
  ratingMatch: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
