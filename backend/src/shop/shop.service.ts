import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ShopItem } from './entities/shop-item.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class ShopService {
  constructor(
    @InjectRepository(ShopItem) private itemRepo: Repository<ShopItem>,
    @InjectRepository(UserInventory) private inventoryRepo: Repository<UserInventory>,
    @InjectRepository(User) private userRepo: Repository<User>,
  ) {}

  async getItems() {
    return this.itemRepo.find({ where: { isActive: true } });
  }

  async buyWithCoins(userId: number, itemId: number): Promise<any> {
    const item = await this.itemRepo.findOne({ where: { id: itemId, isActive: true } });
    if (!item) throw new NotFoundException('Item not found');
    if (!item.priceCoins) throw new BadRequestException('Item not available for coins');

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (user.coins < item.priceCoins) throw new BadRequestException('Insufficient coins');

    user.coins -= item.priceCoins;
    await this.userRepo.save(user);

    if (item.type === 'premium') {
      const days = parseInt(item.effectValue || '30', 10);
      const premiumUntil = new Date();
      premiumUntil.setDate(premiumUntil.getDate() + days);
      user.premiumUntil = premiumUntil;
      await this.userRepo.save(user);
    }

    if (item.type === 'warn_remove') {
      if ((user.warns ?? 0) === 0) {
        // Refund coins and bail out
        user.coins += item.priceCoins;
        await this.userRepo.save(user);
        throw new BadRequestException('У вас нет активных предупреждений');
      }
      user.warns = Math.max(0, (user.warns ?? 0) - 1);
      // Auto-unban if was banned due to 3 warns
      if (user.isBanned && user.banReason?.includes('предупреждения')) {
        user.isBanned = false;
        user.banReason = null;
      }
      await this.userRepo.save(user);
      // No inventory entry for one-time consumable
      return { ok: true, warns: user.warns, isBanned: user.isBanned };
    }

    const inventory = this.inventoryRepo.create({ userId, itemId });
    return this.inventoryRepo.save(inventory);
  }

  /** Покупка подписки CONDR Premium за фиксированную цену (2990 COIN, +30 дней). */
  async buyPremium(userId: number): Promise<any> {
    const PRICE = 2990;
    const DAYS = 30;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.coins < PRICE) throw new BadRequestException('Недостаточно монет');

    user.coins -= PRICE;
    // Если премиум ещё активен — продлеваем от текущей даты окончания.
    const base = user.premiumUntil && new Date(user.premiumUntil) > new Date() ? new Date(user.premiumUntil) : new Date();
    base.setDate(base.getDate() + DAYS);
    user.premiumUntil = base;
    await this.userRepo.save(user);
    return { ok: true, premiumUntil: user.premiumUntil, coins: user.coins };
  }

  /** Покупка доступа к CPL-Q (CONDR Pro League Qualifications) за 4990 COIN на текущий сезон. */
  async buyCplq(userId: number): Promise<any> {
    const PRICE = 4990;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if (user.cplqAccess) throw new BadRequestException('Доступ к CPL-Q уже есть на этот сезон');
    if (user.coins < PRICE) throw new BadRequestException('Недостаточно монет');
    user.coins -= PRICE;
    user.cplqAccess = true;
    await this.userRepo.save(user);
    return { ok: true, coins: user.coins, cplqAccess: true };
  }

  async getUserInventory(userId: number) {
    const items = await this.inventoryRepo.find({ where: { userId } });
    const itemIds = items.map((i) => i.itemId);
    if (!itemIds.length) return [];

    const shopItems = await this.itemRepo.findBy({ id: In(itemIds) });
    return items.map((inv) => ({
      ...inv,
      item: shopItems.find((i) => i.id === inv.itemId),
    }));
  }
}
