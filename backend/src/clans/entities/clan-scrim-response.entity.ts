import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export type ScrimResponseStatus = 'pending' | 'accepted' | 'rejected';

// Отклик на заявку о праке: клан предлагает сыграть на конкретной карте.
// Прак создаётся только после подтверждения отклика автором заявки.
@Entity('clan_scrim_responses')
export class ClanScrimResponse {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'listing_id' })
  listingId: number;

  @Column({ name: 'responder_clan_id' })
  responderClanId: number;

  @Column({ name: 'created_by' })
  createdBy: number;

  // Карта, которую предлагает откликающийся клан (из maps заявки)
  @Column({ nullable: true })
  map: string | null;

  @Column({ default: 'pending' })
  status: ScrimResponseStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
