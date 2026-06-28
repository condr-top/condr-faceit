import { User } from '../users/entities/user.entity';

/**
 * Возвращает сумму начисления CONDR COIN с учётом активного Boost 2X.
 * Применяется ТОЛЬКО к заработанным монетам (матчи, миссии, мини-игра, ачивки),
 * НЕ к донату/пополнению. Если буст неактивен — возвращает исходную сумму.
 */
export function withCoinBoost(user: User | null | undefined, amount: number): number {
  if (!user || !user.coinBoostUntil) return amount;
  return new Date(user.coinBoostUntil) > new Date() ? amount * 2 : amount;
}
