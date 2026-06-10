'use client'

import { getEloRank, CHALLENGER_RANK } from '@/lib/eloRank'

interface EloRingProps {
  elo: number
  size?: number
  isChallenger?: boolean
  showLabel?: boolean
}

/**
 * Rank emblem. Designed orb images live in /public/ranks
 * (1.jpg … 10.jpg + challenger.jpg) — the image contains the ring,
 * progress arc and level number. Wrapped in a rank-colored gradient
 * ring that masks the cropped image edge. Optional label below.
 */
export function EloRing({ elo, size = 64, isChallenger = false, showLabel = true }: EloRingProps) {
  const rank = isChallenger ? CHALLENGER_RANK : getEloRank(elo)
  const { color, label } = rank
  const img = isChallenger ? '/ranks/challenger.jpg' : `/ranks/${rank.level}.jpg`
  const labelSize = size < 50 ? 8 : 9

  // Кольцо-рамка: толщина масштабируется от размера (мин. 1.5px),
  // тёмный зазор отделяет рамку от орба, скрывая обрезанный край картинки.
  const ringW = Math.max(1.5, Math.round(size * 0.035))
  const gapW = Math.max(1, Math.round(size * 0.03))
  const imgSize = size - (ringW + gapW) * 2

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          // Градиентное кольцо в цвет ранга
          background: `conic-gradient(from 210deg, ${color}, ${color}33 30%, ${color}cc 50%, ${color}22 72%, ${color})`,
          padding: ringW,
          boxShadow: `0 0 ${Math.round(size * 0.22)}px ${color}40, inset 0 0 ${Math.round(size * 0.08)}px rgba(0,0,0,0.6)`,
          flexShrink: 0,
        }}
      >
        {/* Тёмный зазор между рамкой и орбом */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: '#0a0a0e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src={img}
            alt={label}
            width={imgSize}
            height={imgSize}
            draggable={false}
            style={{
              display: 'block',
              width: imgSize,
              height: imgSize,
              borderRadius: '50%',
              objectFit: 'cover',
              userSelect: 'none',
            }}
          />
        </div>
      </div>
      {showLabel && (
        <span
          style={{
            fontSize: labelSize,
            fontWeight: 700,
            color,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            opacity: 0.9,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}
