import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from '../users/entities/user.entity';

interface TelegramInitData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async validateTelegramInitData(initData: string): Promise<User> {
    const params = new URLSearchParams(initData);
    const hash = params.get('hash');
    if (!hash) throw new UnauthorizedException('No hash provided');

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join('\n');

    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN || '')
      .digest();

    const computedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    if (computedHash !== hash) {
      throw new UnauthorizedException('Invalid init data signature');
    }

    const authDate = parseInt(params.get('auth_date') || '0', 10);
    if (Date.now() / 1000 - authDate > 86400) {
      throw new UnauthorizedException('Init data expired');
    }

    const userJson = params.get('user');
    if (!userJson) throw new UnauthorizedException('No user data');

    const tgUser: TelegramInitData = JSON.parse(userJson);
    return this.upsertUser(tgUser);
  }

  private async upsertUser(tgUser: any): Promise<User> {
    let user = await this.userRepo.findOne({ where: { telegramId: tgUser.id } });

    if (!user) {
      user = this.userRepo.create({
        telegramId: tgUser.id,
        username: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        avatarUrl: tgUser.photo_url || null,
        elo: 1000,
        coins: 0,
        isAdmin: false,
        isBanned: false,
      });
    } else {
      user.username = tgUser.username || user.username;
      user.firstName = tgUser.first_name;
      user.lastName = tgUser.last_name || user.lastName;
      // Only update avatar from Telegram if user hasn't uploaded a custom one.
      // Custom avatars are stored at /uploads/... — Telegram URLs are external https links.
      const hasCustomAvatar = user.avatarUrl?.startsWith('/uploads/')
      if (tgUser.photo_url && !hasCustomAvatar) {
        user.avatarUrl = tgUser.photo_url;
      }
    }

    return this.userRepo.save(user);
  }

  async login(user: User): Promise<{ access_token: string; user: Partial<User> }> {
    const payload = { sub: user.id, telegramId: user.telegramId, isAdmin: user.isAdmin };
    return {
      access_token: this.jwtService.sign(payload),
      user: this.sanitizeUser(user),
    };
  }

  async loginDev(telegramId: number): Promise<{ access_token: string; user: Partial<User> }> {
    let user = await this.userRepo.findOne({ where: { telegramId } });
    if (!user) {
      user = this.userRepo.create({
        telegramId,
        username: `dev_${telegramId}`,
        firstName: 'Dev',
        elo: 1000,
        coins: 500,
        isAdmin: (process.env.ADMIN_TELEGRAM_IDS || '').split(',').map(Number).includes(telegramId),
        isBanned: false,
      });
      user = await this.userRepo.save(user);
    }
    return this.login(user);
  }

  // ── Вход на сайт (web) ───────────────────────────────────────────────────────
  // Эфемерные коды привязки: код → userId. Сгенерирован в вебаппе, погашается на сайте.
  private webPairings = new Map<string, { userId: number; expires: number }>();
  private readonly PAIR_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  /** Сгенерировать одноразовый код привязки для текущего пользователя (вебапп). */
  async createWebPairing(userId: number): Promise<{ code: string; expiresIn: number }> {
    // чистим протухшие
    const now = Date.now();
    for (const [k, v] of this.webPairings) if (v.expires < now) this.webPairings.delete(k);

    let code = '';
    do {
      code = Array.from({ length: 6 }, () => this.PAIR_ALPHABET[Math.floor(Math.random() * this.PAIR_ALPHABET.length)]).join('');
    } while (this.webPairings.has(code));

    this.webPairings.set(code, { userId, expires: now + 5 * 60 * 1000 });
    return { code, expiresIn: 300 };
  }

  /** Погасить код привязки на сайте → выдать JWT того же аккаунта. */
  async redeemWebPairing(rawCode: string) {
    const code = (rawCode || '').toUpperCase().trim();
    const rec = this.webPairings.get(code);
    if (!rec || rec.expires < Date.now()) throw new UnauthorizedException('Код недействителен или истёк');
    this.webPairings.delete(code);
    const user = await this.userRepo.findOne({ where: { id: rec.userId } });
    if (!user) throw new UnauthorizedException('Пользователь не найден');
    return this.login(user);
  }

  /** Вход через Telegram Login Widget (внешний сайт). Подпись HMAC по SHA256(bot_token). */
  async telegramWidgetLogin(data: Record<string, any>) {
    const { hash, ...fields } = data || {};
    if (!hash) throw new UnauthorizedException('Нет подписи');

    const dataCheckString = Object.keys(fields)
      .filter((k) => fields[k] != null)
      .sort()
      .map((k) => `${k}=${fields[k]}`)
      .join('\n');

    const secretKey = crypto.createHash('sha256').update(process.env.BOT_TOKEN || '').digest();
    const computed = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
    if (computed !== hash) throw new UnauthorizedException('Неверная подпись Telegram');

    if (Date.now() / 1000 - Number(fields.auth_date || 0) > 86400) throw new UnauthorizedException('Данные устарели');

    const user = await this.upsertUser({
      id: Number(fields.id),
      first_name: fields.first_name,
      last_name: fields.last_name,
      username: fields.username,
      photo_url: fields.photo_url,
    });
    return this.login(user);
  }

  sanitizeUser(user: User): Partial<User> {
    const { ...safe } = user;
    return safe;
  }
}
