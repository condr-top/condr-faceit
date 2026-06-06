'use client'

import { motion } from 'framer-motion'
import { getEloRank, getRankProgress, CHALLENGER_RANK } from '@/lib/eloRank'

interface EloRingProps {
  elo: number
  size?: number
  isChallenger?: boolean
  showLabel?: boolean
}

export function EloRing({ elo, size = 64, isChallenger = false, showLabel = true }: EloRingProps) {
  const rank = isChallenger ? CHALLENGER_RANK : getEloRank(elo)
  const progress = isChallenger ? 1 : getRankProgress(elo)
  const { color } = rank

  const strokeW = size < 50 ? 3 : 4
  const radius = (size - strokeW * 2) / 2
  const circumference = 2 * Math.PI * radius

  const fontSize = size < 40 ? size * 0.34 : size * 0.31
  const labelSize = size < 50 ? 8 : 9
  const inner = size - (strokeW + 2) * 2

  return (
    <div className="flex flex-col items-center gap-1">
      <div style={{ position: 'relative', width: size, height: size }}>
        {/* Ring SVG */}
        <svg
          width={size} height={size}
          style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeW}
          />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color} strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - progress) }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>

        {/* Center badge */}
        <div
          style={{
            position: 'absolute',
            top: strokeW + 2,
            left: strokeW + 2,
            width: inner,
            height: inner,
            borderRadius: '50%',
            background: isChallenger
              ? `radial-gradient(circle at 40% 35%, ${color}45 0%, ${color}20 55%, rgba(0,0,0,0.75) 100%)`
              : `radial-gradient(circle at 40% 35%, ${color}30 0%, ${color}12 60%, rgba(0,0,0,0.6) 100%)`,
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              fontSize,
              fontWeight: 900,
              color,
              lineHeight: 1,
              letterSpacing: isChallenger ? 0 : '-0.02em',
              textShadow: `0 0 ${isChallenger ? 16 : 10}px ${color}${isChallenger ? 'CC' : '90'}`,
              fontFamily: 'Actay, sans-serif',
              userSelect: 'none',
            }}
          >
            {isChallenger ? '★' : rank.level}
          </span>
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
          {rank.label}
        </span>
      )}
    </div>
  )
}
