// Экономика CONDR CASE / WHEEL / SLOTS. Цены и веса — единственный источник правды.
// Призы: монеты, косметика (ключи из shop/cosmetics), премиум на N дней.
// Дизайн: для нового игрока возврат ~80-85% (косметика — главный апсайд),
// для владельца всей косметики дубликат конвертируется в монеты → дом в плюсе.

export type PrizeKind = 'coins' | 'frame' | 'background' | 'patch' | 'title' | 'premium';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export interface Prize {
  id: string;
  kind: PrizeKind;
  label: string;
  rarity: Rarity;
  weight: number;
  amount?: number; // для coins
  key?: string;    // для косметики
  days?: number;   // для premium
}

// Конвертация дубликата косметики в монеты (если предмет уже есть)
export const DUPLICATE_COINS: Record<Rarity, number> = {
  common: 150, uncommon: 300, rare: 500, epic: 900, legendary: 1500, mythic: 2500,
};

export const CASE = {
  id: 'case',
  name: 'CONDR CASE',
  cost: 850,
  prizes: [
    { id: 'c100',  kind: 'coins', amount: 100,  label: '100 монет',  rarity: 'common',    weight: 280 },
    { id: 'c250',  kind: 'coins', amount: 250,  label: '250 монет',  rarity: 'common',    weight: 230 },
    { id: 'c500',  kind: 'coins', amount: 500,  label: '500 монет',  rarity: 'uncommon',  weight: 170 },
    { id: 'f_flame',   kind: 'frame',      key: 'flame',   label: 'Рамка «Огненная»',  rarity: 'rare', weight: 45 },
    { id: 'b_sunset',  kind: 'background', key: 'sunset',  label: 'Фон «Закат»',        rarity: 'rare', weight: 45 },
    { id: 'p_hexes',   kind: 'patch',      key: 'hexes',   label: 'Нашивка «Гексы»',    rarity: 'rare', weight: 40 },
    { id: 'c1500', kind: 'coins', amount: 1500, label: '1 500 монет', rarity: 'epic',     weight: 80 },
    { id: 't_pro',     kind: 'title',      key: 'pro',     label: 'Титул «Про-игрок»',  rarity: 'epic', weight: 30 },
    { id: 'f_champion',kind: 'frame',      key: 'champion',label: 'Рамка «Чемпион»',    rarity: 'legendary', weight: 18 },
    { id: 'prem7',     kind: 'premium',    days: 7,        label: 'Premium 7 дней',     rarity: 'legendary', weight: 22 },
    { id: 'c5000', kind: 'coins', amount: 5000, label: '5 000 монет', rarity: 'mythic',   weight: 12 },
    { id: 'prem30',    kind: 'premium',    days: 30,       label: 'Premium 30 дней',    rarity: 'mythic', weight: 5 },
  ] as Prize[],
};

export const WHEEL = {
  id: 'wheel',
  name: 'CONDR WHEEL',
  cost: 400,
  // Порядок сегментов = порядок на колесе (визуально равные сектора, веса разные)
  segments: [
    { id: 'w50',   kind: 'coins', amount: 50,   label: '50',          rarity: 'common',    weight: 220 },
    { id: 'w500',  kind: 'coins', amount: 500,  label: '500',         rarity: 'uncommon',  weight: 80 },
    { id: 'w100',  kind: 'coins', amount: 100,  label: '100',         rarity: 'common',    weight: 200 },
    { id: 'w_cos', kind: 'patch', key: 'royal', label: 'Нашивка',      rarity: 'rare',      weight: 50 },
    { id: 'w150',  kind: 'coins', amount: 150,  label: '150',         rarity: 'common',    weight: 160 },
    { id: 'w1500', kind: 'coins', amount: 1500, label: '1500',        rarity: 'epic',      weight: 10 },
    { id: 'w200',  kind: 'coins', amount: 200,  label: '200',         rarity: 'uncommon',  weight: 120 },
    { id: 'w_prem',kind: 'premium', days: 3,    label: 'Premium 3д',   rarity: 'legendary', weight: 20 },
    { id: 'w300',  kind: 'coins', amount: 300,  label: '300',         rarity: 'uncommon',  weight: 100 },
    { id: 'w_frame',kind: 'frame',key: 'frost', label: 'Рамка',        rarity: 'rare',      weight: 40 },
  ] as Prize[],
};

// Слоты: 3 барабана, символы с весами. Выигрыш — за 3 одинаковых (и пара монет).
export interface SlotSymbol { id: string; label: string; weight: number; rarity: Rarity; prize: Prize | null }
export const SLOTS = {
  id: 'slots',
  name: 'CONDR SLOTS',
  cost: 250,
  symbols: [
    { id: 'coin',    label: 'coin',    weight: 360, rarity: 'common',
      prize: { id: 's_coin', kind: 'coins', amount: 200, label: '200 монет', rarity: 'common', weight: 0 } },
    { id: 'star',    label: 'star',    weight: 260, rarity: 'uncommon',
      prize: { id: 's_star', kind: 'coins', amount: 600, label: '600 монет', rarity: 'uncommon', weight: 0 } },
    { id: 'seven',   label: 'seven',   weight: 150, rarity: 'rare',
      prize: { id: 's_seven', kind: 'coins', amount: 1500, label: '1 500 монет', rarity: 'rare', weight: 0 } },
    { id: 'diamond', label: 'diamond', weight: 70,  rarity: 'epic',
      prize: { id: 's_diamond', kind: 'patch', key: 'inferno', label: 'Нашивка «Инферно»', rarity: 'epic', weight: 0 } },
    { id: 'crown',   label: 'crown',   weight: 30,  rarity: 'legendary',
      prize: { id: 's_crown', kind: 'premium', days: 7, label: 'Premium 7 дней', rarity: 'legendary', weight: 0 } },
    { id: 'condr',   label: 'condr',   weight: 10,  rarity: 'mythic',
      prize: { id: 's_condr', kind: 'coins', amount: 10000, label: 'ДЖЕКПОТ 10 000', rarity: 'mythic', weight: 0 } },
  ] as SlotSymbol[],
  // Мелкий приз за 2 одинаковых coin/star
  pairPrize: { id: 's_pair', kind: 'coins', amount: 100, label: '100 монет', rarity: 'common', weight: 0 } as Prize,
};

export function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, x) => s + x.weight, 0);
  let r = Math.random() * total;
  for (const it of items) { r -= it.weight; if (r < 0) return it; }
  return items[items.length - 1];
}
