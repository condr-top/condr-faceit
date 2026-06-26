import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

// Режим: clan_battle влияет на рейтинг клана; scrim (прак) — нет (следующая фаза).
export type ClanMatchMode = 'clan_battle' | 'scrim';

export type ClanMatchStatus =
  | 'pending'           // вызов отправлен, ждём ответа соперника
  | 'accepted'          // соперник принял, бой назначен / идёт
  | 'awaiting_confirm'  // одна сторона отправила счёт, ждём подтверждения второй
  | 'disputed'          // стороны сообщили разный счёт
  | 'completed'         // счёт подтверждён, рейтинг применён
  | 'rejected'          // соперник отклонил вызов
  | 'cancelled';        // создатель отменил до принятия

@Entity('clan_matches')
export class ClanMatch {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ default: 'clan_battle' })
  mode: ClanMatchMode;

  @Column({ name: 'clan_a_id' })
  clanAId: number; // вызывающий клан

  @Column({ name: 'clan_b_id' })
  clanBId: number; // приглашённый клан

  @Column({ default: 'pending' })
  status: ClanMatchStatus;

  @Column({ nullable: true })
  map: string | null;

  @Column({ name: 'scheduled_at', nullable: true, type: 'timestamp' })
  scheduledAt: Date | null;

  @Column({ name: 'created_by' })
  createdBy: number; // user id

  // Подтверждённый счёт
  @Column({ name: 'score_a', nullable: true, type: 'int' })
  scoreA: number | null;

  @Column({ name: 'score_b', nullable: true, type: 'int' })
  scoreB: number | null;

  // Счёт, заявленный каждой стороной (для сверки)
  @Column({ name: 'report_a_score_a', nullable: true, type: 'int' })
  reportAScoreA: number | null;
  @Column({ name: 'report_a_score_b', nullable: true, type: 'int' })
  reportAScoreB: number | null;
  @Column({ name: 'report_b_score_a', nullable: true, type: 'int' })
  reportBScoreA: number | null;
  @Column({ name: 'report_b_score_b', nullable: true, type: 'int' })
  reportBScoreB: number | null;

  @Column({ name: 'winner_clan_id', nullable: true, type: 'int' })
  winnerClanId: number | null;

  // Ссылка на живой матч прака (Match.id), когда прак стартовал
  @Column({ name: 'match_id', nullable: true, type: 'int' })
  matchId: number | null;

  // Рейтинг до/после и дельта (для отображения в истории)
  @Column({ name: 'clan_a_rating_before', nullable: true, type: 'int' })
  clanARatingBefore: number | null;
  @Column({ name: 'clan_b_rating_before', nullable: true, type: 'int' })
  clanBRatingBefore: number | null;
  @Column({ name: 'rating_delta', nullable: true, type: 'int' })
  ratingDelta: number | null; // абсолютная величина изменения рейтинга

  // Сезон — для будущего архива/сброса
  @Column({ default: 1 })
  season: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'completed_at', nullable: true, type: 'timestamp' })
  completedAt: Date | null;
}
