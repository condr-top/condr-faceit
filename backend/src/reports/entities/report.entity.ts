import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ReportStatus {
  PENDING = 'pending',
  REVIEWED = 'reviewed',
  DISMISSED = 'dismissed',
}

@Entity('reports')
export class Report {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'reporter_id' })
  reporterId: number;

  @Column({ name: 'reported_id' })
  reportedId: number;

  @Column()
  reason: string;

  @Column({ nullable: true })
  description: string;

  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.PENDING })
  status: ReportStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
