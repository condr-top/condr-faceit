import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('support_messages')
export class SupportMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column('text')
  text: string;

  @Column({ name: 'is_from_admin', default: false })
  isFromAdmin: boolean;

  @Column({ name: 'admin_id', nullable: true })
  adminId: number | null;

  @Column({ name: 'read_by_admin', default: false })
  readByAdmin: boolean;

  @Column({ name: 'read_by_user', default: false })
  readByUser: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
