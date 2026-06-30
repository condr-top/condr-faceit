'use client'

import { getEloRank, CHALLENGER_RANK } from '@/lib/eloRank'

interface EloRingProps {
  elo: number
  size?: number
  isChallenger?: boolean
  showLabel?: boolean
  /** Во время калибровки: жёлтое кольцо со знаком «?» вместо ранга */
  calibrating?: boolean
}

const CALIBRATION_COLOR = '#EAB308'

/**
 * Rank emblem. Designed orb images live in /public/ranks
 * (1.jpg … 10.jpg + challenger.jpg). Orb edge is feathered with a
 * radial mask (blends into the dark core), wrapped in a rank-colored
 * gradient ring frame. Optional label below.
 */
export function EloRing({ elo, size = 64, isChallenger = false, showLabel = true, calibrating = false }: EloRingProps) {
  const rank = isChallenger ? CHALLENGER_RANK : getEloRank(elo)
  // Калибровка = такой же ранг-значок, только своя картинка и жёлтое кольцо
  const color = calibrating ? CALIBRATION_COLOR : rank.color
  const label = calibrating ? 'Калибровка' : rank.label
  // ?v= — cache-bust: у статики max-age 4ч, без смены URL клиенты
  // (Telegram webview) держат старую картинку после обновления набора
  const RANKS_V = 2
  const img = calibrating
    ? `/ranks/calibration.jpg?v=${RANKS_V}`
    : isChallenger ? `/ranks/challenger.jpg?v=${RANKS_V}` : `/ranks/${rank.level}.jpg?v=${RANKS_V}`
  const labelSize = size < 50 ? 8 : 9

  // Рамка: тонкое градиентное кольцо в цвет ранга + тёмная подложка
  const ringW = Math.max(1.5, Math.round(size * 0.04))
  const imgSize = size - ringW * 2

  // closest-side обязателен: иначе радиус тянется до угла квадрата
  // и маска не доходит до краёв (чёрный квадрат на тонированном фоне)
  const feather = 'radial-gradient(circle closest-side, #000 80%, transparent 100%)'

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: '50%',
          background: `conic-gradient(from 210deg, ${color}, ${color}30 28%, ${color}cc 50%, ${color}26 74%, ${color})`,
          padding: ringW,
          boxShadow: `0 0 ${Math.round(size * 0.22)}px ${color}40`,
          flexShrink: 0,
        }}
      >
        {/* Тёмная сердцевина — растушёванный орб растворяется в неё бесшовно */}
        <div
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            background: '#08080b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
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
              objectFit: 'cover',
              userSelect: 'none',
              WebkitMaskImage: feather,
              maskImage: feather,
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
