import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';

// Пригласительный код для закрытого теста. Один код = один минутный слот = один человек.
@Entity('invite_codes')
export class InviteCode {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 5 })
  code: string;

  // floor(Date.now() / 60000) — минутное окно, к которому привязан код. Уникально.
  @Index({ unique: true })
  @Column({ type: 'int', name: 'minute_key' })
  minuteKey: number;

  @Column({ default: false })
  used: boolean;

  @Column({ name: 'used_by_user_id', type: 'int', nullable: true })
  usedByUserId: number | null;

  @Column({ name: 'used_at', type: 'timestamp', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
