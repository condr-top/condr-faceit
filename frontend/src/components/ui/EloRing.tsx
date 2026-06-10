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
 * (1.jpg … 10.jpg + challenger.jpg). The new orb design dissolves into
 * black, so instead of a hard frame we feather the image edge with a
 * radial mask — it blends into any dark background. Optional label below.
 */
export function EloRing({ elo, size = 64, isChallenger = false, showLabel = true }: EloRingProps) {
  const rank = isChallenger ? CHALLENGER_RANK : getEloRank(elo)
  const { color, label } = rank
  const img = isChallenger ? '/ranks/challenger.jpg' : `/ranks/${rank.level}.jpg`
  const labelSize = size < 50 ? 8 : 9

  // Плавное растворение края. closest-side обязателен: без него радиус
  // градиента тянется до УГЛА квадрата и маска не доходит до краёв
  // (получается видимый чёрный квадрат на тонированном фоне).
  const feather = 'radial-gradient(circle closest-side, #000 78%, transparent 99%)'

  return (
    <div className="flex flex-col items-center gap-1">
      <img
        src={img}
        alt={label}
        width={size}
        height={size}
        draggable={false}
        style={{
          display: 'block',
          width: size,
          height: size,
          objectFit: 'cover',
          userSelect: 'none',
          WebkitMaskImage: feather,
          maskImage: feather,
          filter: `drop-shadow(0 0 ${Math.round(size * 0.16)}px ${color}45)`,
        }}
      />
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
