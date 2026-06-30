import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { CASE, WHEEL, SLOTS, Prize, pickWeighted, DUPLICATE_COINS } from './games.config';

@Injectable()
export class GamesService {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  /** Публичный конфиг для фронта (без раскрытия точных шансов). */
  getConfig() {
    const strip = (p: Prize) => ({ id: p.id, kind: p.kind, label: p.label, rarity: p.rarity, amount: p.amount, key: p.key, days: p.days });
    return {
      case: { name: CASE.name, cost: CASE.cost, prizes: CASE.prizes.map(strip) },
      wheel: { name: WHEEL.name, cost: WHEEL.cost, segments: WHEEL.segments.map(strip) },
      slots: {
        name: SLOTS.name, cost: SLOTS.cost,
        symbols: SLOTS.symbols.map((s) => ({ id: s.id, label: s.label, rarity: s.rarity })),
      },
    };
  }

  private ownedField(kind: string): 'ownedFrames' | 'ownedBackgrounds' | 'ownedPatches' | null {
    if (kind === 'frame') return 'ownedFrames';
    if (kind === 'background') return 'ownedBackgrounds';
    if (kind === 'patch') return 'ownedPatches';
    return null;
  }

  /** Начисляет приз игроку. Возвращает что реально зачислено (с конвертацией дублей). */
  private grant(user: User, prize: Prize | null): any {
    if (!prize) return null;
    if (prize.kind === 'coins') {
      user.coins += prize.amount || 0;
      return { kind: 'coins', amount: prize.amount, label: prize.label, rarity: prize.rarity };
    }
    if (prize.kind === 'premium') {
      const base = user.premiumUntil && new Date(user.premiumUntil) > new Date() ? new Date(user.premiumUntil) : new Date();
      base.setDate(base.getDate() + (prize.days || 0));
      user.premiumUntil = base;
      return { kind: 'premium', days: prize.days, label: prize.label, rarity: prize.rarity };
    }
    if (prize.kind === 'title') {
      if (user.title === prize.key) {
        const c = DUPLICATE_COINS[prize.rarity]; user.coins += c;
        return { kind: 'coins', amount: c, label: `Дубликат → ${c} монет`, rarity: prize.rarity, converted: true };
      }
      user.title = prize.key!;
      return { kind: 'title', key: prize.key, label: prize.label, rarity: prize.rarity };
    }
    // frame / background / patch
    const field = this.ownedField(prize.kind)!;
    const owned = (user[field] as string[]) ?? [];
    if (owned.includes(prize.key!)) {
      const c = DUPLICATE_COINS[prize.rarity]; user.coins += c;
      return { kind: 'coins', amount: c, label: `Дубликат → ${c} монет`, rarity: prize.rarity, converted: true };
    }
    (user[field] as string[]) = [...owned, prize.key!];
    return { kind: prize.kind, key: prize.key, label: prize.label, rarity: prize.rarity };
  }

  async play(userId: number, game: 'case' | 'wheel' | 'slots'): Promise<any> {
    const cfg = game === 'case' ? CASE : game === 'wheel' ? WHEEL : SLOTS;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    if ((user.coins ?? 0) < cfg.cost) throw new BadRequestException('Недостаточно монет');
    user.coins -= cfg.cost;

    if (game === 'case') {
      const prize = pickWeighted(CASE.prizes);
      const winIndex = CASE.prizes.findIndex((p) => p.id === prize.id);
      const granted = this.grant(user, prize);
      await this.userRepo.save(user);
      return { game, winIndex, prize: strip(prize), granted, coins: user.coins };
    }

    if (game === 'wheel') {
      const seg = pickWeighted(WHEEL.segments);
      const winIndex = WHEEL.segments.findIndex((p) => p.id === seg.id);
      const granted = this.grant(user, seg);
      await this.userRepo.save(user);
      return { game, winIndex, prize: strip(seg), granted, coins: user.coins };
    }

    // slots — 3 независимых барабана
    const reels = [pickWeighted(SLOTS.symbols), pickWeighted(SLOTS.symbols), pickWeighted(SLOTS.symbols)];
    let prize: Prize | null = null;
    if (reels[0].id === reels[1].id && reels[1].id === reels[2].id) {
      prize = reels[0].prize;
    } else {
      // пара coin/star → мелкий приз
      const ids = reels.map((r) => r.id);
      const hasPair = ['coin', 'star'].some((s) => ids.filter((x) => x === s).length >= 2);
      if (hasPair) prize = SLOTS.pairPrize;
    }
    const granted = this.grant(user, prize);
    await this.userRepo.save(user);
    return { game, symbols: reels.map((r) => r.id), prize: prize ? strip(prize) : null, granted, coins: user.coins };
  }
}

function strip(p: Prize) {
  return { id: p.id, kind: p.kind, label: p.label, rarity: p.rarity, amount: p.amount, key: p.key, days: p.days };
}
