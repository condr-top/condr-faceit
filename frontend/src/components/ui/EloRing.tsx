'use client'

import { getEloRank, CHALLENGER_RANK } from '@/lib/eloRank'

interface EloRingProps {
  elo: number
  size?: number
  isChallenger?: boolean
  showLabel?: boolean
}

/**
 * Rank emblem. Uses the designed orb images in /public/ranks
 * (1.webp … 10.webp + challenger.webp) — the image contains the ring,
 * progress arc and level number. Optional rank label shown below.
 */
export function EloRing({ elo, size = 64, isChallenger = false, showLabel = true }: EloRingProps) {
  const rank = isChallenger ? CHALLENGER_RANK : getEloRank(elo)
  const { color, label } = rank
  const img = isChallenger ? '/ranks/challenger.webp' : `/ranks/${rank.level}.webp`
  const labelSize = size < 50 ? 8 : 9

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
          borderRadius: '50%',
          objectFit: 'cover',
          userSelect: 'none',
          filter: `drop-shadow(0 0 ${Math.round(size * 0.18)}px ${color}55)`,
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
