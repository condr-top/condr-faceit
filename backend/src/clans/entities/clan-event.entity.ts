import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

// Тип ручного события календаря. Клановые бои подмешиваются в календарь
// динамически из clan_matches (по scheduledAt) — их тут не дублируем.
export type ClanEventType = 'tournament' | 'scrim' | 'training' | 'meeting' | 'custom';

@Entity('clan_events')
export class ClanEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'clan_id' })
  clanId: number;

  @Column({ default: 'custom' })
  type: ClanEventType;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'starts_at', type: 'timestamp' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamp', nullable: true })
  endsAt: Date | null;

  // Поля для Турнир / Прак
  @Column({ name: 'opponent_tag', nullable: true })
  opponentTag: string | null;

  // Кто создаёт лобби: 'us' | 'them'
  @Column({ name: 'lobby_host', nullable: true })
  lobbyHost: string | null;

  // ID соперника (если лобби создаём мы)
  @Column({ name: 'opponent_ext_id', nullable: true })
  opponentExtId: string | null;

  // Формат: 'bo1' | 'bo3' | 'bo5'
  @Column({ nullable: true })
  format: string | null;

  // Выбранные карты (1–5)
  @Column({ type: 'text', array: true, default: [] })
  maps: string[];

  @Column({ name: 'created_by' })
  createdBy: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
