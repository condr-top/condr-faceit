import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type ScrimListingStatus = 'open' | 'matched' | 'cancelled';

// Объявление на бирже праков: клан ищет соперника на тренировочный матч (прак).
// Праки НЕ влияют на рейтинг клана.
@Entity('clan_scrim_listings')
export class ClanScrimListing {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clan_id' })
  clanId: number;

  @Column({ name: 'created_by' })
  createdBy: number;

  @Column({ default: 'open' })
  status: ScrimListingStatus;

  // Уровень поиска: main — все, semi — топ-25, pro — топ-10
  @Column({ default: 'main' })
  tier: 'main' | 'semi' | 'pro';

  // Желаемое время прака (одна заявка = один тайминг; мультитайминги размножаются)
  @Column({ name: 'scheduled_at', type: 'timestamp', nullable: true })
  scheduledAt: Date | null;

  // Искомые карты (1–7). Откликающийся выбирает одну из них.
  @Column({ type: 'text', array: true, default: [] })
  maps: string[];

  // Легаси-поле (одна карта) — больше не используется напрямую
  @Column({ nullable: true })
  map: string | null;

  // Сервер (необязательно)
  @Column({ nullable: true })
  server: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // Если заявку приняли — какой клан и какой матч создан
  @Column({ name: 'matched_clan_id', type: 'int', nullable: true })
  matchedClanId: number | null;

  @Column({ name: 'match_id', type: 'int', nullable: true })
  matchId: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
