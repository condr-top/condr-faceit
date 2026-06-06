'use client'

import { useState } from 'react'

interface AvatarProps {
  avatarUrl?: string | null
  name: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function Avatar({ avatarUrl, name, size = 32, className = '', style }: AvatarProps) {
  const [error, setError] = useState(false)

  // /uploads/... → проксируется через Next.js (работает для всех)
  // http://... → внешняя ссылка (Telegram фото, может не грузиться)
  const resolvedUrl = avatarUrl
    ? avatarUrl.startsWith('/uploads')
      ? avatarUrl  // используем как есть — Next.js проксирует на бэкенд
      : avatarUrl  // внешняя ссылка (Telegram)
    : null

  const initials = (name || '?')[0].toUpperCase()

  const baseStyle: React.CSSProperties = { width: size, height: size, borderRadius: '50%', ...style }

  if (!resolvedUrl || error) {
    return (
      <div
        className={`flex items-center justify-center font-bold text-white flex-shrink-0 ${className}`}
        style={{ ...baseStyle, background: 'rgba(255,255,255,0.08)', fontSize: size * 0.4 }}
      >
        {initials}
      </div>
    )
  }

  return (
    <img
      src={resolvedUrl}
      alt={name}
      onError={() => setError(true)}
      className={`object-cover flex-shrink-0 ${className}`}
      style={{ ...baseStyle }}
    />
  )
}
