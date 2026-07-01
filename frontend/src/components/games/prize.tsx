'use client'

import { Icon } from '@/components/ui/Icon'
import { FRAMES, BACKGROUNDS, PATCHES, TITLES } from '@/lib/cosmetics'

export interface GamePrize {
  id?: string
  kind: 'coins' | 'frame' | 'background' | 'patch' | 'title' | 'premium'
  label: string
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic'
  amount?: number
  key?: string
  days?: number
  converted?: boolean
}

export const RARITY: Record<string, { c: string; glow: string; name: string }> = {
  common:    { c: '#9CA3AF', glow: 'rgba(156,163,175,0.5)', name: 'Обычный' },
  uncommon:  { c: '#22C55E', glow: 'rgba(34,197,94,0.5)',   name: 'Необычный' },
  rare:      { c: '#3B82F6', glow: 'rgba(59,130,246,0.55)', name: 'Редкий' },
  epic:      { c: '#A855F7', glow: 'rgba(168,85,247,0.6)',  name: 'Эпический' },
  legendary: { c: '#F59E0B', glow: 'rgba(245,158,11,0.65)', name: 'Легендарный' },
  mythic:    { c: '#E8092E', glow: 'rgba(232,9,46,0.7)',    name: 'Мифический' },
}

/** Визуальная иконка приза (под его тип). */
export function PrizeIcon({ prize, size = 44 }: { prize: GamePrize; size?: number }) {
  const r = size
  if (prize.kind === 'frame') {
    const v = FRAMES[prize.key || '']
    return <span style={{ width: r, height: r, borderRadius: '50%', display: 'inline-block', background: v?.gradient ?? '#444', boxShadow: `0 0 10px ${v?.glow ?? 'transparent'}` }} />
  }
  if (prize.kind === 'background') {
    const v = BACKGROUNDS[prize.key || '']
    return <span style={{ width: r, height: r, borderRadius: 10, display: 'inline-block', background: v?.css ?? '#16171d' }} />
  }
  if (prize.kind === 'patch') {
    const v = PATCHES[prize.key || '']
    return <span style={{ width: r, height: r, borderRadius: 10, display: 'inline-block', background: `${v?.css ?? ''}, linear-gradient(#16171d,#16171d)` }} />
  }
  if (prize.kind === 'title') {
    const v = TITLES[prize.key || '']
    return <span style={{ width: r, height: r, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: v?.bg ?? 'rgba(255,255,255,0.06)', color: v?.color ?? '#fff' }}><Icon name="crown" size={r * 0.5} color={v?.color ?? '#fff'} /></span>
  }
  if (prize.kind === 'premium') {
    return <span style={{ width: r, height: r, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(234,179,8,0.14)' }}><Icon name="crown" size={r * 0.55} color="#EAB308" /></span>
  }
  // coins
  return <span style={{ width: r, height: r, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 35% 30%, #FDE68A, #EAB308 55%, #B45309)', boxShadow: '0 0 10px rgba(234,179,8,0.5)' }}><Icon name="coins" size={r * 0.5} color="#5a3d04" /></span>
}

/** Карточка приза для ленты кейса (вертикальная плитка с цветом редкости). */
export function PrizeCell({ prize, w, h }: { prize: GamePrize; w?: number; h: number }) {
  const rc = RARITY[prize.rarity] || RARITY.common
  const iconSize = Math.min(w ?? h, h) * 0.42
  return (
    <div style={{ width: w ?? '100%', height: h, flexShrink: 0, borderRadius: 12, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, background: `linear-gradient(180deg, ${rc.c}22, #0c0c11 70%)`, border: `1px solid ${rc.c}55`, margin: w ? '0 4px' : 0 }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: rc.c, boxShadow: `0 0 10px ${rc.glow}` }} />
      <PrizeIcon prize={prize} size={iconSize} />
      <div style={{ fontSize: 10, fontWeight: 700, color: '#cbd5e1', textAlign: 'center', padding: '0 6px', lineHeight: 1.2 }}>{prize.label}</div>
    </div>
  )
}
