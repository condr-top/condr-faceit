import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_inventory')
export class UserInventory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column({ name: 'item_id' })
  itemId: number;

  @Column({ name: 'expires_at', nullable: true, type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'purchased_at' })
  purchasedAt: Date;
}
