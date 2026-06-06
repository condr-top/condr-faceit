import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  type: string;

  @Column()
  title: string;

  @Column({ nullable: true })
  body: string;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @Column({ name: 'meta', nullable: true, type: 'jsonb' })
  meta: any;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
