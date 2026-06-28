import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, DataSource } from 'typeorm';
import { ShopItem } from './entities/shop-item.entity';
import { UserInventory } from './entities/user-inventory.entity';
import { User } from '../users/entities/user.entity';
import { tgPost } from '../common/telegram';

// Цены услуг в CONDR COIN (единственный источник правды — меняй здесь)
export const SERVICE_PRICES = {
  kd_reset: 2500,
  clean_slate: 4000,
  warn_remove: 1500,
  coin_boost: 1500,
  condr_tag: 5000,
};
const BOOST_HOURS = 24;

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);
  constructor(
    @InjectRepository(ShopItem) private itemRepo: Repository<ShopItem>,
    @InjectRepository(UserInventory) private inventoryRepo: Repository<UserInventory>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private dataSource: DataSource,
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

  // ───────────────────────── Услуги магазина ─────────────────────────

  /** Списать цену услуги или бросить ошибку. Возвращает пользователя. */
  private async charge(userId: number, price: number): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if ((user.coins ?? 0) < price) throw new BadRequestException('Недостаточно монет');
    user.coins -= price;
    return user;
  }

  /** Обнуление K/D: сброс боевой статистики и истории матчей обычной лиги. ELO сохраняется. */
  async kdReset(userId: number): Promise<any> {
    const user = await this.charge(userId, SERVICE_PRICES.kd_reset);
    await this.wipeMatchHistory(userId);
    user.killsTotal = 0; user.deathsTotal = 0; user.assistsTotal = 0; user.ratingSum = 0;
    user.matchesPlayed = 0; user.matchesWon = 0; user.matchesLost = 0; user.winStreak = 0;
    await this.userRepo.save(user);
    return { ok: true, coins: user.coins, message: 'Статистика и история матчей обнулены' };
  }

  /** Чистый лист: полный сброс обычной лиги + повторная калибровка (ELO → 1000). */
  async cleanSlate(userId: number): Promise<any> {
    const user = await this.charge(userId, SERVICE_PRICES.clean_slate);
    await this.wipeMatchHistory(userId);
    user.killsTotal = 0; user.deathsTotal = 0; user.assistsTotal = 0; user.ratingSum = 0;
    user.matchesPlayed = 0; user.matchesWon = 0; user.matchesLost = 0; user.winStreak = 0;
    user.elo = 1000;
    await this.userRepo.save(user);
    return { ok: true, coins: user.coins, message: 'Аккаунт сброшен. Первые матчи снова калибровочные' };
  }

  /** Удалить из БД историю матчей и историю ELO игрока (обычная лига). */
  private async wipeMatchHistory(userId: number) {
    try { await this.dataSource.query('DELETE FROM match_players WHERE user_id = $1', [userId]); } catch (e) { this.logger.warn(`wipe match_players: ${e}`); }
    try { await this.dataSource.query('DELETE FROM elo_history WHERE user_id = $1', [userId]); } catch (e) { this.logger.warn(`wipe elo_history: ${e}`); }
  }

  /** Снятие Варна: убрать одно предупреждение (и авто-разбан, если бан был из-за варнов). */
  async warnRemove(userId: number): Promise<any> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if ((user.warns ?? 0) === 0) throw new BadRequestException('У вас нет активных предупреждений');
    if ((user.coins ?? 0) < SERVICE_PRICES.warn_remove) throw new BadRequestException('Недостаточно монет');
    user.coins -= SERVICE_PRICES.warn_remove;
    user.warns = Math.max(0, (user.warns ?? 0) - 1);
    if (user.isBanned && user.banReason?.includes('предупреждения')) {
      user.isBanned = false; user.banReason = null;
    }
    await this.userRepo.save(user);
    return { ok: true, coins: user.coins, warns: user.warns, isBanned: user.isBanned };
  }

  /** Boost 2X к начислению CONDR COIN на 24ч (не распространяется на донат). */
  async buyBoost(userId: number): Promise<any> {
    const user = await this.charge(userId, SERVICE_PRICES.coin_boost);
    // Если буст ещё активен — продлеваем от текущего окончания
    const base = user.coinBoostUntil && new Date(user.coinBoostUntil) > new Date() ? new Date(user.coinBoostUntil) : new Date();
    base.setHours(base.getHours() + BOOST_HOURS);
    user.coinBoostUntil = base;
    await this.userRepo.save(user);
    return { ok: true, coins: user.coins, coinBoostUntil: user.coinBoostUntil };
  }

  /** Внутриигровой тэг [CONDR]: списываем монеты, помечаем заявку, уведомляем админов в Telegram. */
  async buyCondrTag(userId: number): Promise<any> {
    const user = await this.charge(userId, SERVICE_PRICES.condr_tag);
    if (user.condrTagRequested) {
      user.coins += SERVICE_PRICES.condr_tag; // рефанд
      await this.userRepo.save(user);
      throw new BadRequestException('Заявка на тэг [CONDR] уже отправлена');
    }
    user.condrTagRequested = true;
    await this.userRepo.save(user);

    const chatId = process.env.ADMIN_CHAT_ID;
    if (chatId) {
      const text = `🏷 <b>Заявка на тэг [CONDR]</b>\n\nИгрок: <b>${user.gameNickname || user.firstName || 'id ' + user.id}</b>\nGame ID: <code>${user.gameId || '—'}</code>\nUser ID: <code>${user.id}</code>\n\nВыдайте тэг [CONDR] в самой игре.`;
      tgPost('sendMessage', { chat_id: chatId, text, parse_mode: 'HTML' }).catch((e) => this.logger.warn(`condr tag notify: ${e}`));
    }
    return { ok: true, coins: user.coins, message: 'Заявка отправлена. Администратор выдаст тэг [CONDR] в игре' };
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
