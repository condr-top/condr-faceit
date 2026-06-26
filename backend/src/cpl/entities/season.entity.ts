import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Сезон CPL/CPL-Q. 1 сезон ≈ 1 месяц, старт/стоп админом. */
@Entity('cpl_seasons')
export class Season {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  number: number;

  @Column({ name: 'starts_at', type: 'timestamp' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamp', nullable: true })
  endsAt: Date | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
