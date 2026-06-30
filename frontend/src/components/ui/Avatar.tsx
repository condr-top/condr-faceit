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

  // Чёткое кольцо-рамка: полный круг-градиент СЗАДИ, аватар сверху перекрывает
  // центр (без CSS-маски → нет «пиксельных» краёв). Толщина масштабируется.
  const band = Math.max(2, Math.round(size * 0.06))
  const outer = size + band * 2
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: outer, height: outer, flexShrink: 0, lineHeight: 0 }}>
      <span
        aria-hidden
        className={f.animated ? 'cosmetic-frame-spin' : undefined}
        style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: f.gradient, filter: `drop-shadow(0 0 ${Math.max(4, Math.round(size * 0.12))}px ${f.glow})` }}
      />
      {/* тонкий тёмный разделитель между аватаром и кольцом */}
      <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', borderRadius: '50%', boxShadow: '0 0 0 1.5px #0a0a0e' }}>{inner}</span>
    </span>
  )
}
