import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/** Публичное PRO DM-лобби, созданное игроком с ролью DM Хост. */
@Entity('dm_pro_lobbies')
export class DmProLobby {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'host_id' })
  hostId: number;

  @Column()
  map: string;

  /** 'pistols' | 'akr' | 'snipers' | 'all' */
  @Column()
  weapons: string;

  /** 'hs' | 'none' */
  @Column({ default: 'none' })
  condition: string;

  @Column()
  link: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
