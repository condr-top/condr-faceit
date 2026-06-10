'use client'

const KNOWN = new Set([
  'ru','ua','kz','by','uz','az','am','ge','kg','tj','tm','md',
  'tr','de','us','gb','fr','pl','br','cn',
])

interface FlagProps {
  code?: string | null
  /** Высота флага в px (ширина = 4:3) */
  size?: number
  style?: React.CSSProperties
}

/**
 * Прямоугольный SVG-флаг страны со скруглёнными углами (self-hosted
 * /public/flags, набор lipis/flag-icons 4x3). Вместо эмодзи — выглядит
 * одинаково на всех устройствах. Неизвестный код → глобус.
 */
export function Flag({ code, size = 14, style }: FlagProps) {
  const c = (code || '').toLowerCase()
  const src = KNOWN.has(c) ? `/flags/${c}.svg` : '/flags/other.svg'
  const w = Math.round(size * 4 / 3)
  return (
    <img
      src={src}
      alt={code || 'flag'}
      width={w}
      height={size}
      draggable={false}
      style={{
        display: 'inline-block',
        width: w,
        height: size,
        borderRadius: Math.max(2, Math.round(size * 0.22)),
        objectFit: 'cover',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.35)',
        verticalAlign: 'middle',
        flexShrink: 0,
        userSelect: 'none',
        // Оптическая поправка: у текста снизу запас под выносные элементы,
        // из-за этого флаг по геометрическому центру кажется ниже строки
        transform: 'translateY(-1px)',
        ...style,
      }}
    />
  )
}
