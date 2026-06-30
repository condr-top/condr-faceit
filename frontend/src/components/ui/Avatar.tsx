'use client'

import { useState } from 'react'
import { getFrame } from '@/lib/cosmetics'

interface AvatarProps {
  avatarUrl?: string | null
  name: string
  size?: number
  className?: string
  style?: React.CSSProperties
  /** Ключ декоративной рамки (косметика). Если задан — рисуется кольцо-рамка. */
  frame?: string | null
}

const ringMask = (band: number) => `radial-gradient(farthest-side, transparent calc(100% - ${band}px), #000 calc(100% - ${band}px))`

export function Avatar({ avatarUrl, name, size = 32, className = '', style, frame }: AvatarProps) {
  const [error, setError] = useState(false)
  const resolvedUrl = avatarUrl || null
  const initials = (name || '?')[0].toUpperCase()
  const baseStyle: React.CSSProperties = { width: size, height: size, borderRadius: '50%', ...style }

  const inner = (!resolvedUrl || error) ? (
    <div
      className={`flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
      style={{ ...baseStyle, background: 'rgba(255,255,255,0.08)', fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  ) : (
    <img
      src={resolvedUrl}
      alt={name}
      onError={() => setError(true)}
      className={`object-cover flex-shrink-0 ${className}`}
      style={{ ...baseStyle }}
    />
  )

  const f = getFrame(frame)
  if (!f) return inner // без рамки — поведение как раньше (нулевая регрессия)

  // Толщина рамки и свечение масштабируются под размер аватара
  const band = Math.max(2.5, Math.round(size * 0.07))
  const gap = Math.max(1, Math.round(size * 0.02)) // зазор между аватаром и рамкой
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
      {inner}
      <span
        aria-hidden
        className={f.animated ? 'cosmetic-frame-spin' : undefined}
        style={{
          position: 'absolute', inset: -(band + gap), borderRadius: '50%',
          background: f.gradient,
          WebkitMask: ringMask(band), mask: ringMask(band),
          filter: `drop-shadow(0 0 ${Math.max(4, Math.round(size * 0.13))}px ${f.glow})`,
          pointerEvents: 'none',
        }}
      />
    </span>
  )
}
