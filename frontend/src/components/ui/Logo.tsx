'use client'

interface LogoProps {
  size?: number
  color?: string
  style?: React.CSSProperties
}

/** Векторный знак CONDR (из /public/logo_vectorized.svg), инлайн —
 *  чтобы красить через color и масштабировать без потери качества. */
export function Logo({ size = 48, color = '#fff', style }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1536 1536"
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-label="CONDR"
    >
      <g fill={color} fillRule="evenodd">
        <path d="M 440 1005 L 865 1226 L 805 1135 Z" />
        <path d="M 228 680 L 270 802 L 728 1015 Z" />
        <path d="M 447 481 L 395 672 L 398 677 L 709 879 L 704 870 L 573 705 L 575 700 L 583 702 L 675 776 L 992 1021 L 997 1023 L 1016 1023 L 1018 1021 L 1171 550 L 829 848 L 827 842 L 851 767 L 850 761 L 622 480 L 450 479 Z" />
      </g>
    </svg>
  )
}
