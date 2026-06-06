import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum PurchaseStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REJECTED = 'rejected',
}

@Entity('coin_purchases')
export class CoinPurchase {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @Column()
  rubles: number;

  @Column()
  coins: number;

  @Column({ name: 'payer_name' })
  payerName: string;

  @Column()
  bank: string;

  @Column({ type: 'enum', enum: PurchaseStatus, default: PurchaseStatus.PENDING })
  status: PurchaseStatus;

  @Column({ name: 'telegram_message_id', nullable: true })
  telegramMessageId: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
