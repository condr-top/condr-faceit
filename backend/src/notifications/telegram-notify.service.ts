import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { tgPost } from '../common/telegram';

interface PushButton {
  text: string
  path?: string      // путь в Mini App, например /match/123
  webApp?: boolean   // true → web_app кнопка (открывает Mini App), иначе обычная ссылка
}

/**
 * Доставка важных уведомлений игроку в личный чат Telegram-бота.
 * Учитывает персональные настройки (user.notifPrefs): если prefs[type] === false — не шлём.
 * Никогда не бросает наружу — сетевые ошибки только логируются.
 */
@Injectable()
export class TelegramNotifyService {
  private readonly logger = new Logger(TelegramNotifyService.name);

  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async push(userId: number, type: string, text: string, button?: PushButton): Promise<void> {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user?.telegramId) return;
      if (user.notifPrefs && user.notifPrefs[type] === false) return; // выключено игроком

      const appUrl = (process.env.FRONTEND_URL || process.env.PUBLIC_URL || '').replace(/\/$/, '');
      let reply_markup: any;
      if (button && appUrl) {
        const url = `${appUrl}${button.path || ''}`;
        const btn = button.webApp ? { text: button.text, web_app: { url } } : { text: button.text, url };
        reply_markup = { inline_keyboard: [[btn]] };
      }

      await tgPost('sendMessage', {
        chat_id: user.telegramId,
        text,
        parse_mode: 'HTML',
        ...(reply_markup ? { reply_markup } : {}),
      });
    } catch (e: any) {
      this.logger.warn(`push ${type}→${userId}: ${e?.response?.data?.description || e?.message}`);
    }
  }
}
