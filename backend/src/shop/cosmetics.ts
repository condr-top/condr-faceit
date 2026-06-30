// Каталог косметики CONDR Faceit. Цены — в CONDR COIN. Визуал рамок/титулов
// описан на фронте (lib/cosmetics.ts) по тем же ключам.

export interface FrameDef { key: string; name: string; price: number }
export interface TitleDef { key: string; name: string; price: number }

export const FRAMES: FrameDef[] = [
  { key: 'gold',     name: 'Золотая',  price: 1500 },
  { key: 'flame',    name: 'Огненная', price: 2000 },
  { key: 'frost',    name: 'Ледяная',  price: 2000 },
  { key: 'neon',     name: 'Неон',     price: 2500 },
  { key: 'elite',    name: 'Элита',    price: 1800 },
  { key: 'champion', name: 'Чемпион',  price: 4000 },
];

export const TITLES: TitleDef[] = [
  { key: 'donater',   name: 'Донатер',   price: 1000 },
  { key: 'qualman',   name: 'Квалмен',   price: 1500 },
  { key: 'pro',       name: 'Про-игрок', price: 2000 },
  { key: 'veteran',   name: 'Ветеран',   price: 1500 },
  { key: 'nightmare', name: 'Кошмар',    price: 3000 },
  { key: 'legend',    name: 'Легенда',   price: 5000 },
];

export interface BgDef { key: string; name: string; price: number }
export interface PatchDef { key: string; name: string; price: number }

// Фоны профиля (видны на плитке аватар+ранг)
export const BACKGROUNDS: BgDef[] = [
  { key: 'crimson',  name: 'Багровый',  price: 1500 },
  { key: 'carbon',   name: 'Карбон',    price: 1200 },
  { key: 'sunset',   name: 'Закат',     price: 2000 },
  { key: 'aurora',   name: 'Аврора',    price: 2500 },
  { key: 'gold',     name: 'Золото',    price: 3000 },
  { key: 'champion', name: 'Чемпион',   price: 4500 },
];

// Нашивки — фон плитки игрока на странице матча и в статистике
export const PATCHES: PatchDef[] = [
  { key: 'stripes_red', name: 'Алые полосы',  price: 1500 },
  { key: 'hexes',       name: 'Гексы',         price: 1800 },
  { key: 'flare',       name: 'Вспышка',       price: 2000 },
  { key: 'circuit',     name: 'Схема',         price: 2200 },
  { key: 'royal',       name: 'Королевская',   price: 2800 },
  { key: 'inferno',     name: 'Инферно',       price: 3500 },
];

export const FRAME_KEYS = FRAMES.map((f) => f.key);
export const TITLE_KEYS = TITLES.map((t) => t.key);
export const BG_KEYS = BACKGROUNDS.map((b) => b.key);
export const PATCH_KEYS = PATCHES.map((p) => p.key);
