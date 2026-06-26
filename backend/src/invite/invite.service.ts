import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InviteCode } from './entities/invite-code.entity';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'; // цифры + заглавные латинские
const MINUTE = 60_000;

@Injectable()
export class InviteService {
  constructor(
    @InjectRepository(InviteCode) private repo: Repository<InviteCode>,
  ) {}

  private gen(): string {
    let s = '';
    for (let i = 0; i < 5; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    return s;
  }

  private currentMinute(): number {
    return Math.floor(Date.now() / MINUTE);
  }

  /** Активный код текущей минуты (создаётся лениво при первом обращении). */
  async getCurrent(): Promise<InviteCode> {
    const minuteKey = this.currentMinute();
    let row = await this.repo.findOne({ where: { minuteKey } });
    if (row) return row;

    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        return await this.repo.save(this.repo.create({ code: this.gen(), minuteKey, used: false }));
      } catch {
        // гонка по unique(minuteKey) — код этой минуты уже создан другим запросом
        row = await this.repo.findOne({ where: { minuteKey } });
        if (row) return row;
      }
    }
    throw new BadRequestException('Не удалось получить пригласительный код');
  }

  /** Для админ-панели: код + статус + сколько секунд до смены. */
  async getCurrentForAdmin() {
    const row = await this.getCurrent();
    const secondsLeft = 60 - Math.floor((Date.now() % MINUTE) / 1000);
    return { code: row.code, used: row.used, secondsLeft };
  }

  /** Проверка без списания. */
  async isValid(input: string): Promise<boolean> {
    const code = (input || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) return false;
    const cur = await this.getCurrent();
    return cur.code === code && !cur.used;
  }

  /** Атомарно списывает текущий код. Бросает ошибку, если код неверный или уже использован. */
  async redeem(input: string, userId: number): Promise<void> {
    const code = (input || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{5}$/.test(code)) throw new BadRequestException('Неверный пригласительный код');
    const cur = await this.getCurrent();
    if (cur.code !== code) throw new BadRequestException('Неверный пригласительный код');
    // атомарно: успех только если код всё ещё не использован
    const res = await this.repo.update(
      { id: cur.id, used: false },
      { used: true, usedByUserId: userId, usedAt: new Date() },
    );
    if (!res.affected) throw new BadRequestException('Этот код уже использован — дождись следующего');
  }
}
