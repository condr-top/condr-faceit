import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id' })
  userId: number;

  // Ключ темы (payment / account / match / report / bug / other)
  @Column()
  category: string;

  @Column()
  subject: string;

  @Column({ default: 'open' }) // 'open' | 'closed'
  status: string;

  @Column({ name: 'closed_by', type: 'int', nullable: true })
  closedBy: number | null;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
