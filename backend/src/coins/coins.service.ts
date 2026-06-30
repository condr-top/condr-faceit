import { Injectable, BadRequestException, NotFoundException, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { tgPost, tgGet } from '../common/telegram';
import { CoinPurchase, PurchaseStatus } from './entities/coin-purchase.entity';
import { User } from '../users/entities/user.entity';
import { ReportsService } from '../reports/reports.service';
import { MatchesService } from '../matches/matches.service';

@Injectable()
export class CoinsService implements OnApplicationBootstrap {
  private readonly RATE = 10; // 1 ruble = 10 coins
  private readonly logger = new Logger(CoinsService.name);

  constructor(
    @InjectRepository(CoinPurchase) private purchaseRepo: Repository<CoinPurchase>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private reportsService: ReportsService,
    private matchesService: MatchesService,
  ) {}

  async onApplicationBootstrap() {
    const publicUrl = process.env.PUBLIC_URL;
    const botToken = process.env.BOT_TOKEN;
    if (!publicUrl || !botToken) return;

    const webhookUrl = `${publicUrl}/api/coins/webhook`;
    try {
      // Check current webhook
      const info = await tgGet('getWebhookInfo');
      const current = info.data?.result?.url || '';

      if (current !== webhookUrl) {
        const res = await tgPost('setWebhook', { url: webhookUrl });
        if (res.data?.ok) {
          this.logger.log(`Webhook registered: ${webhookUrl}`);
        } else {
          this.logger.warn(`Webhook registration failed: ${JSON.stringify(res.data)}`);
        }
      } else {
        this.logger.log(`Webhook already set: ${webhookUrl}`);
      }
    } catch (e: any) {
      this.logger.warn(`Could not auto-register webhook: ${e.message}`);
    }
  }

  async createPurchase(userId: number, rubles: number, payerName: string, bank: string) {
    if (rubles < 10) throw new BadRequestException('Минимальная сумма — 10 рублей');
    if (rubles > 10000) throw new BadRequestException('Максимальная сумма — 10 000 рублей');

    const coins = rubles * this.RATE;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const purchase = this.purchaseRepo.create({
      userId,
      rubles,
      coins,
      payerName,
      bank,
      status: PurchaseStatus.PENDING,
    });
    await this.purchaseRepo.save(purchase);

    // Уведомление в админ-чат — В ФОНЕ, не блокируем ответ (иначе при недоступном
    // Telegram запрос висит и на клиенте «вечная загрузка»).
    this.sendAdminNotification(purchase, user)
      .then(async (msgId) => {
        if (msgId) {
          purchase.telegramMessageId = msgId;
          await this.purchaseRepo.save(purchase);
        }
      })
      .catch((e) => this.logger.warn(`purchase notify failed: ${e?.message}`));

    return { purchaseId: purchase.id, coins, rubles };
  }

  private async sendAdminNotification(purchase: CoinPurchase, user: User): Promise<number | null> {
    const botToken = process.env.BOT_TOKEN;
    const chatId = process.env.ADMIN_CHAT_ID;
    if (!botToken || !chatId) return null;

    const nickname = user.gameNickname || user.username || user.firstName;
    const text =
      `💰 <b>Запрос на покупку коинов</b>\n\n` +
      `👤 Игрок: <b>${nickname}</b>\n` +
      `💳 Плательщик: <b>${purchase.payerName}</b>\n` +
      `🏦 Банк: <b>${purchase.bank}</b>\n` +
      `💵 Сумма: <b>${purchase.rubles} ₽</b>\n` +
      `🪙 Коины: <b>+${purchase.coins}</b>\n` +
      `🆔 ID заявки: <code>${purchase.id}</code>`;

    try {
      const topicId = process.env.TOPIC_PURCHASES ? parseInt(process.env.TOPIC_PURCHASES) : undefined;
      const res = await tgPost('sendMessage', {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        ...(topicId ? { message_thread_id: topicId } : {}),
        reply_markup: {
          inline_keyboard: [[
            { text: '✅ Подтвердить', callback_data: `confirm_coins_${purchase.id}` },
            { text: '❌ Отклонить', callback_data: `reject_coins_${purchase.id}` },
          ]],
        },
      });
      return res.data?.result?.message_id || null;
    } catch (e: any) {
      this.logger.warn(`TG purchase sendMessage failed: ${e?.response?.data?.description || e?.message}`);
      return null;
    }
  }

  async confirmPurchase(purchaseId: number): Promise<void> {
    const purchase = await this.purchaseRepo.findOne({ where: { id: purchaseId } });
    if (!purchase || purchase.status !== PurchaseStatus.PENDING) return;

    purchase.status = PurchaseStatus.CONFIRMED;
    await this.purchaseRepo.save(purchase);

    const user = await this.userRepo.findOne({ where: { id: purchase.userId } });
    if (user) {
      user.coins += purchase.coins;
      await this.userRepo.save(user);
    }

    // Edit admin message
    await this.editAdminMessage(purchase, '✅ Оплата подтверждена');
  }

  async rejectPurchase(purchaseId: number): Promise<void> {
    const purchase = await this.purchaseRepo.findOne({ where: { id: purchaseId } });
    if (!purchase || purchase.status !== PurchaseStatus.PENDING) return;

    purchase.status = PurchaseStatus.REJECTED;
    await this.purchaseRepo.save(purchase);

    await this.editAdminMessage(purchase, '❌ Отклонено');
  }

  private async editAdminMessage(purchase: CoinPurchase, note: string) {
    const botToken = process.env.BOT_TOKEN;
    const chatId = process.env.ADMIN_CHAT_ID;
    if (!botToken || !chatId || !purchase.telegramMessageId) return;

    try {
      await tgPost('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: purchase.telegramMessageId,
        reply_markup: { inline_keyboard: [[{ text: note, callback_data: 'done' }]] },
      });
    } catch (e: any) {
      this.logger.warn(`TG editMessage failed: ${e?.response?.data?.description || e?.message}`);
    }
  }

  async handleWebhook(body: any): Promise<void> {
    // /start — приветствие с визуалом и кнопкой запуска WebApp
    const msg = body?.message;
    if (typeof msg?.text === 'string' && msg.text.trim().startsWith('/start')) {
      await this.sendWelcome(msg.chat?.id, msg.chat?.type)
        .catch((e) => this.logger.warn(`welcome failed: ${e?.response?.data?.description || e?.message}`));
      return;
    }

    const cb = body?.callback_query;
    if (!cb) return;

    const data: string = cb.data || '';
    if (data.startsWith('confirm_coins_')) {
      const id = parseInt(data.replace('confirm_coins_', ''));
      await this.confirmPurchase(id);
    } else if (data.startsWith('reject_coins_')) {
      const id = parseInt(data.replace('reject_coins_', ''));
      await this.rejectPurchase(id);
    } else if (data.startsWith('report_')) {
      await this.reportsService.handleWebhookCallback(data);
    } else if (data.startsWith('result_')) {
      // result_A_123 / result_B_123 / result_draw_123
      const parts = data.split('_');
      const winner = parts[1] as 'A' | 'B' | 'draw';
      const matchId = parseInt(parts[2]);
      if (matchId && winner) {
        await this.matchesService.confirmResult(matchId, 0, winner);
      }
    }

    // Answer callback query
    try {
      await tgPost('answerCallbackQuery', { callback_query_id: cb.id, text: 'Готово' });
    } catch {}
  }

  /** Приветственное сообщение при /start: баннер + гайд + кнопка запуска Mini App. */
  private async sendWelcome(chatId: number | undefined, chatType?: string): Promise<void> {
    if (!chatId) return;
    const appUrl = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
    const photo = `${appUrl}/welcome.png`;

    const caption =
      `<b>CONDR FACEIT</b> ⚔️\n` +
      `Соревновательный матчмейкинг Standoff 2.\n\n` +
      `Чтобы начать — нажми <b>«Открыть CONDR»</b> ниже и пройди быструю регистрацию (игровой ник и Game ID).`;

    // web_app-кнопка работает только в личке; в группах — обычная ссылка.
    const button = chatType === 'private' && appUrl
      ? { text: '🎮 Открыть CONDR', web_app: { url: appUrl } }
      : { text: '🎮 Открыть CONDR', url: appUrl };
    const reply_markup = { inline_keyboard: [[button]] };

    try {
      await tgPost('sendPhoto', { chat_id: chatId, photo, caption, parse_mode: 'HTML', reply_markup });
    } catch (e: any) {
      // Если Telegram не смог загрузить картинку — шлём текстом с той же кнопкой.
      this.logger.warn(`welcome sendPhoto failed, fallback to text: ${e?.response?.data?.description || e?.message}`);
      await tgPost('sendMessage', { chat_id: chatId, text: caption, parse_mode: 'HTML', reply_markup });
    }
  }

  async getPurchaseStatus(purchaseId: number, userId: number) {
    const purchase = await this.purchaseRepo.findOne({
      where: { id: purchaseId, userId },
    });
    if (!purchase) throw new NotFoundException();
    return { status: purchase.status, coins: purchase.coins };
  }

  async setupWebhook(webhookUrl: string): Promise<any> {
    const res = await tgPost('setWebhook', { url: `${webhookUrl}/api/coins/webhook` });
    return res.data;
  }
}
