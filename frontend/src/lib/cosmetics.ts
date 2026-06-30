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

export const getFrame = (key?: string | null): FrameStyle | null => (key ? FRAMES[key] ?? null : null)
export const getTitle = (key?: string | null): TitleStyle | null => (key ? TITLES[key] ?? null : null)
