import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('shop_items')
export class ShopItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column()
  type: string;

  @Column({ name: 'price_coins', default: 0 })
  priceCoins: number;

  @Column({ name: 'price_stars', default: 0 })
  priceStars: number;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'effect_value', nullable: true })
  effectValue: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
