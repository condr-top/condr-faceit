import { Entity, PrimaryColumn, Column } from 'typeorm';

// Простое key/value хранилище системных флагов (например, одноразовые миграции).
@Entity('app_meta')
export class AppMeta {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'text', nullable: true })
  value: string | null;
}
