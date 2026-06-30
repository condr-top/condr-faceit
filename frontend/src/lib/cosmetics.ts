// Визуал косметики CONDR Faceit. Ключи синхронизированы с backend/src/shop/cosmetics.ts

export interface FrameStyle {
  name: string
  gradient: string      // градиент кольца-рамки
  glow: string          // цвет свечения
  animated?: boolean    // вращающееся кольцо (conic)
}

export const FRAMES: Record<string, FrameStyle> = {
  gold:     { name: 'Золотая',  gradient: 'linear-gradient(135deg, #FDE68A, #EAB308 55%, #B45309)', glow: 'rgba(234,179,8,0.65)' },
  flame:    { name: 'Огненная', gradient: 'linear-gradient(135deg, #FCA5A5, #EF4444 50%, #7F1D1D)', glow: 'rgba(239,68,68,0.65)' },
  frost:    { name: 'Ледяная',  gradient: 'linear-gradient(135deg, #CFFAFE, #22D3EE 55%, #0E7490)', glow: 'rgba(34,211,238,0.6)' },
  neon:     { name: 'Неон',     gradient: 'linear-gradient(135deg, #F5D0FE, #A855F7 55%, #6D28D9)', glow: 'rgba(168,85,247,0.65)' },
  elite:    { name: 'Элита',    gradient: 'linear-gradient(135deg, #FFFFFF, #CBD5E1 50%, #475569)', glow: 'rgba(226,232,240,0.55)' },
  champion: { name: 'Чемпион',  gradient: 'conic-gradient(#EAB308, #E8092E, #F59E0B, #E8092E, #EAB308)', glow: 'rgba(232,9,46,0.6)', animated: true },
}

export interface TitleStyle { name: string; color: string; bg: string }

export const TITLES: Record<string, TitleStyle> = {
  donater:   { name: 'Донатер',   color: '#A855F7', bg: 'rgba(168,85,247,0.16)' },
  qualman:   { name: 'Квалмен',   color: '#3B82F6', bg: 'rgba(59,130,246,0.16)' },
  pro:       { name: 'Про-игрок', color: '#E8092E', bg: 'rgba(232,9,46,0.16)' },
  veteran:   { name: 'Ветеран',   color: '#22C55E', bg: 'rgba(34,197,94,0.16)' },
  nightmare: { name: 'Кошмар',    color: '#F97316', bg: 'rgba(249,115,22,0.16)' },
  legend:    { name: 'Легенда',   color: '#EAB308', bg: 'rgba(234,179,8,0.16)' },
}

// ── Фоны профиля (на плитке аватар+ранг) ──
export interface BgStyle { name: string; css: string; animated?: boolean; tint: string }
export const BACKGROUNDS: Record<string, BgStyle> = {
  crimson:  { name: 'Багровый', tint: 'rgba(232,9,46,0.5)',  css: 'radial-gradient(120% 140% at 0% 0%, #4a0511, transparent 60%), radial-gradient(120% 140% at 100% 100%, #2a0309, transparent 55%), linear-gradient(135deg, #1a0306, #0b0709)' },
  carbon:   { name: 'Карбон',   tint: 'rgba(120,130,150,0.35)', css: 'repeating-linear-gradient(135deg, #14151b 0 8px, #0f1015 8px 16px), linear-gradient(135deg, #16171d, #0b0c10)' },
  sunset:   { name: 'Закат',    tint: 'rgba(249,115,22,0.45)', css: 'linear-gradient(135deg, #4a1d05, #7a1230 55%, #2a0a3a)' },
  aurora:   { name: 'Аврора',   tint: 'rgba(34,211,238,0.4)',  css: 'radial-gradient(120% 130% at 0% 0%, #0e3a4a, transparent 55%), radial-gradient(120% 130% at 100% 0%, #3a1466, transparent 55%), linear-gradient(135deg, #0a1622, #0b0c10)' },
  gold:     { name: 'Золото',   tint: 'rgba(234,179,8,0.5)',   css: 'radial-gradient(120% 140% at 0% 0%, #4a3805, transparent 60%), linear-gradient(135deg, #2a2008, #100c05)' },
  champion: { name: 'Чемпион',  tint: 'rgba(232,9,46,0.55)', animated: true, css: 'linear-gradient(135deg, #3a0710, #4a3805 50%, #3a0710)' },
}

// ── Нашивки (фон плитки игрока в матче / статистике) ──
export interface PatchStyle { name: string; css: string; accent: string }
export const PATCHES: Record<string, PatchStyle> = {
  stripes_red: { name: 'Алые полосы', accent: '#E8092E', css: 'repeating-linear-gradient(115deg, rgba(232,9,46,0.22) 0 14px, transparent 14px 34px), linear-gradient(90deg, rgba(232,9,46,0.18), transparent 70%)' },
  hexes:       { name: 'Гексы',        accent: '#3B82F6', css: 'radial-gradient(circle at 20% 50%, rgba(59,130,246,0.22), transparent 45%), repeating-linear-gradient(60deg, rgba(59,130,246,0.10) 0 2px, transparent 2px 16px)' },
  flare:       { name: 'Вспышка',      accent: '#F59E0B', css: 'radial-gradient(circle at 12% 50%, rgba(245,158,11,0.35), transparent 55%)' },
  circuit:     { name: 'Схема',        accent: '#22D3EE', css: 'repeating-linear-gradient(90deg, rgba(34,211,238,0.10) 0 1px, transparent 1px 22px), repeating-linear-gradient(0deg, rgba(34,211,238,0.10) 0 1px, transparent 1px 22px), linear-gradient(90deg, rgba(34,211,238,0.14), transparent 60%)' },
  royal:       { name: 'Королевская',  accent: '#A855F7', css: 'radial-gradient(circle at 15% 50%, rgba(168,85,247,0.3), transparent 55%), repeating-linear-gradient(45deg, rgba(168,85,247,0.10) 0 6px, transparent 6px 18px)' },
  inferno:     { name: 'Инферно',      accent: '#EF4444', css: 'radial-gradient(ellipse at 0% 100%, rgba(239,68,68,0.4), transparent 50%), radial-gradient(ellipse at 30% 0%, rgba(249,115,22,0.25), transparent 45%)' },
}

export const getFrame = (key?: string | null): FrameStyle | null => (key ? FRAMES[key] ?? null : null)
export const getTitle = (key?: string | null): TitleStyle | null => (key ? TITLES[key] ?? null : null)
export const getBackground = (key?: string | null): BgStyle | null => (key ? BACKGROUNDS[key] ?? null : null)
export const getPatch = (key?: string | null): PatchStyle | null => (key ? PATCHES[key] ?? null : null)
