'use client'

export type IconName =
  | 'timer' | 'target' | 'coins' | 'swords' | 'bolt'
  | 'trophy' | 'cart' | 'chat' | 'card' | 'sword' | 'terrorist'
  | 'crown' | 'medal' | 'star' | 'globe' | 'pin'
  | 'pencil' | 'check' | 'camera' | 'gamepad' | 'skull'
  | 'trendingUp' | 'barChart' | 'shield' | 'ban'
  | 'hourglass' | 'x' | 'search' | 'flame' | 'users'
  | 'warning' | 'plus' | 'dot' | 'handshake' | 'flask'
  | 'mail' | 'link' | 'refresh' | 'clipboard' | 'bomb'
  | 'gift' | 'sparkles' | 'help' | 'megaphone' | 'bell'
  | 'phone' | 'logout' | 'user' | 'bank' | 'eye'
  | 'rocket' | 'hash' | 'chevronRight' | 'chevronLeft' | 'copy'
  | 'lock' | 'mic' | 'upload' | 'gem' | 'image'
  | 'palette' | 'box' | 'check-circle' | 'settings' | 'verified'

interface IconProps {
  name: IconName
  size?: number
  color?: string
  strokeWidth?: number
  style?: React.CSSProperties
}

/**
 * Минималистичные line-иконки (геометрия в духе Lucide), рисуются
 * через currentColor — заменяют эмодзи, выглядят одинаково везде.
 */
export function Icon({ name, size = 24, color = 'currentColor', strokeWidth = 2, style }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style },
    'aria-hidden': true,
  }

  switch (name) {
    case 'timer':
      return (
        <svg {...common}>
          <line x1="9.5" y1="2.5" x2="14.5" y2="2.5" />
          <line x1="12" y1="2.5" x2="12" y2="6" />
          <circle cx="12" cy="14" r="7.5" />
          <line x1="12" y1="14" x2="14.5" y2="11.5" />
        </svg>
      )
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.4" fill={color} stroke="none" />
        </svg>
      )
    case 'bolt':
      return (
        <svg {...common} fill={color}>
          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" strokeLinejoin="round" />
        </svg>
      )
    case 'trophy':
      return (
        <svg {...common}>
          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
          <path d="M4 22h16" />
          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
        </svg>
      )
    case 'sword':
      return (
        <svg {...common}>
          {/* Одиночный меч (клинок из верхнего правого угла + крестовина и рукоять) */}
          <path d="M20.5 3.5L11 13l-1.5 3.5L13 15 22.5 5.5V3.5h-2z" />
          <line x1="9.5" y1="14.5" x2="5" y2="19" />
          <line x1="5.5" y1="15.5" x2="8.5" y2="18.5" />
          <line x1="4" y1="17" x2="7" y2="20" />
        </svg>
      )
    case 'terrorist':
      // Бомба (террористы в Standoff 2). Заливка currentColor, свой viewBox.
      return (
        <svg
          width={size} height={size} viewBox="796 796 200 200" fill={color}
          style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
          aria-hidden
        >
          <g>
            <path d="M889.414,877.934c-12.737,0-24.711,4.96-33.716,13.965c-1.572,1.573-1.572,4.122,0,5.694c1.572,1.573,4.123,1.573,5.696,0c7.484-7.483,17.435-11.605,28.02-11.605c10.584,0,20.538,4.123,28.023,11.606c0.786,0.787,1.817,1.181,2.847,1.18c1.031,0,2.062-0.393,2.848-1.18c1.573-1.573,1.573-4.122,0-5.695C914.126,882.894,902.15,877.934,889.414,877.934z" />
            <path d="M954.393,866.523c5.926-5.926,9.189-13.804,9.189-22.183c0-8.379-3.264-16.257-9.188-22.183c-2.358-2.36-6.184-2.359-8.543,0c-2.36,2.359-2.36,6.184-0.002,8.543c3.644,3.644,5.651,8.488,5.651,13.641c0,5.151-2.007,9.995-5.649,13.639l-2.168,2.167l-3.055-3.056c-1.835-1.834-4.322-2.864-6.916-2.864s-5.081,1.03-6.914,2.864l-5.136,5.135c-0.566,0.568-1.431,0.716-2.155,0.369c-9.275-4.438-19.503-6.779-30.09-6.779c-18.644,0-36.172,7.26-49.356,20.443c-27.214,27.215-27.214,71.495,0,98.708c13.184,13.185,30.711,20.445,49.355,20.445c18.643,0,36.173-7.261,49.355-20.445c21.443-21.443,25.988-53.483,13.64-79.421c-0.346-0.723-0.197-1.585,0.37-2.153l5.16-5.161c3.817-3.819,3.817-10.01,0-13.829l-5.715-5.714L954.393,866.523z M930.227,966.427c-10.901,10.9-25.396,16.904-40.812,16.904c-15.416,0-29.91-6.004-40.811-16.904c-22.503-22.504-22.503-59.12,0-81.623c10.902-10.9,25.396-16.904,40.813-16.904s29.911,6.003,40.812,16.904C952.728,907.307,952.728,943.922,930.227,966.427z" />
            <path d="M935.287,817.365c0.785,0.786,1.817,1.18,2.848,1.18c1.029,0,2.061-0.393,2.848-1.179c1.573-1.572,1.573-4.123,0-5.696l-6.304-6.305c-1.57-1.574-4.122-1.573-5.695,0c-1.573,1.573-1.573,4.122,0,5.696L935.287,817.365z" />
            <path d="M924.316,830.503h8.915c2.225,0,4.028-1.803,4.028-4.028c0-2.224-1.804-4.027-4.028-4.027h-8.915c-2.225,0-4.027,1.804-4.027,4.027C920.289,828.7,922.092,830.503,924.316,830.503z" />
            <path d="M950.058,813.553c2.226,0,4.027-1.804,4.027-4.027v-8.915c0-2.225-1.802-4.028-4.027-4.028s-4.028,1.803-4.028,4.028v8.915C946.029,811.749,947.832,813.553,950.058,813.553z" />
            <path d="M971.171,805.275c-1.573-1.572-4.124-1.572-5.695,0l-6.304,6.305c-1.573,1.572-1.573,4.122,0,5.695c0.787,0.786,1.817,1.18,2.848,1.18s2.063-0.394,2.847-1.18l6.304-6.305C972.744,809.398,972.744,806.848,971.171,805.275z" />
          </g>
        </svg>
      )
    case 'swords':
      return (
        <svg {...common}>
          <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
          <line x1="13" y1="19" x2="19" y2="13" />
          <line x1="16" y1="16" x2="20" y2="20" />
          <line x1="19" y1="21" x2="21" y2="19" />
          <polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
          <line x1="5" y1="14" x2="9" y2="18" />
          <line x1="7" y1="17" x2="4" y2="20" />
          <line x1="3" y1="19" x2="5" y2="21" />
        </svg>
      )
    case 'coins':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4" />
          <path d="m16.71 13.88.7.71-2.82 2.82" />
        </svg>
      )
    case 'cart':
      return (
        <svg {...common}>
          <circle cx="8" cy="21" r="1" />
          <circle cx="19" cy="21" r="1" />
          <path d="M2.5 3h2l2.6 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.57l1.6-7.43H5.1" />
        </svg>
      )
    case 'chat':
      return (
        <svg {...common}>
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      )
    case 'card':
      return (
        <svg {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2.5" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      )
    case 'crown':
      return (
        <svg {...common}>
          <path d="M2.5 8.5 6.5 12 12 5 17.5 12 21.5 8.5 19.4 18.5H4.6L2.5 8.5Z" strokeLinejoin="round" />
          <line x1="5" y1="21" x2="19" y2="21" />
        </svg>
      )
    case 'medal':
      return (
        <svg {...common}>
          <path d="m8.5 9-3-6h4l2 3.5" />
          <path d="m15.5 9 3-6h-4l-2 3.5" />
          <circle cx="12" cy="15" r="5.5" />
          <path d="m12 12.4 1 2 2.2.3-1.6 1.5.4 2.2-2-1.05-2 1.05.4-2.2-1.6-1.5 2.2-.3Z" strokeLinejoin="round" />
        </svg>
      )
    case 'star':
      return (
        <svg {...common}>
          <path d="m12 2.5 2.95 5.98 6.6.96-4.77 4.65 1.13 6.57L12 18.6l-5.9 3.1 1.13-6.57L2.46 9.44l6.6-.96L12 2.5Z" strokeLinejoin="round" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
        </svg>
      )
    case 'pin':
      return (
        <svg {...common}>
          <path d="M20 10c0 5.5-8 11.5-8 11.5S4 15.5 4 10a8 8 0 0 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      )
    case 'pencil':
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" strokeLinejoin="round" />
        </svg>
      )
    case 'check':
      return (
        <svg {...common}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )
    case 'camera':
      return (
        <svg {...common}>
          <path d="M3 7.5h3.2L7.7 5h8.6l1.5 2.5H21a1 1 0 0 1 1 1V19a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8.5a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      )
    case 'gamepad':
      return (
        <svg {...common}>
          <rect x="2" y="6" width="20" height="12" rx="6" />
          <line x1="6" y1="11" x2="10" y2="11" />
          <line x1="8" y1="9" x2="8" y2="13" />
          <line x1="15.5" y1="12.5" x2="15.51" y2="12.5" />
          <line x1="18" y1="10" x2="18.01" y2="10" />
        </svg>
      )
    case 'skull':
      return (
        <svg {...common}>
          <path d="M8 20.5v-2.2C5.4 17.1 4 14.4 4 11.3A8 8 0 0 1 20 11.3c0 3.1-1.4 5.8-4 7v2.2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1Z" strokeLinejoin="round" />
          <circle cx="9" cy="12" r="1.4" fill={color} stroke="none" />
          <circle cx="15" cy="12" r="1.4" fill={color} stroke="none" />
          <line x1="12" y1="16" x2="12" y2="18" />
        </svg>
      )
    case 'trendingUp':
      return (
        <svg {...common}>
          <polyline points="3 17 9 11 13 15 21 7" />
          <polyline points="15 7 21 7 21 13" />
        </svg>
      )
    case 'barChart':
      return (
        <svg {...common}>
          <line x1="3" y1="21" x2="21" y2="21" />
          <rect x="5" y="11" width="3.4" height="7.5" rx="1" />
          <rect x="10.3" y="6" width="3.4" height="12.5" rx="1" />
          <rect x="15.6" y="14" width="3.4" height="4.5" rx="1" />
        </svg>
      )
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 2.5 4.5 5.3v6.2c0 4.7 3.2 8 7.5 9.5 4.3-1.5 7.5-4.8 7.5-9.5V5.3L12 2.5Z" strokeLinejoin="round" />
        </svg>
      )
    case 'ban':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <line x1="5.6" y1="5.6" x2="18.4" y2="18.4" />
        </svg>
      )
    case 'hourglass':
      return (
        <svg {...common}>
          <path d="M6 3h12" /><path d="M6 21h12" />
          <path d="M7 3c0 4 4 5 5 6 1-1 5-2 5-6" />
          <path d="M7 21c0-4 4-5 5-6 1 1 5 2 5 6" />
        </svg>
      )
    case 'x':
      return (
        <svg {...common}>
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )
    case 'search':
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="7" />
          <line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
      )
    case 'flame':
      return (
        <svg {...common}>
          <path d="M12 2c1 3 5 5 5 9a5 5 0 0 1-10 0c0-1 .3-1.8.7-2.5C8 10 9 11 9.5 11 9 8 10 4 12 2Z" strokeLinejoin="round" />
        </svg>
      )
    case 'users':
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3.2" />
          <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
          <path d="M16 5.2a3.2 3.2 0 0 1 0 6" />
          <path d="M17 14.5a5.5 5.5 0 0 1 3.5 5.5" />
        </svg>
      )
    case 'warning':
      return (
        <svg {...common}>
          <path d="M12 3 1.7 21h20.6L12 3Z" strokeLinejoin="round" />
          <line x1="12" y1="10" x2="12" y2="14.5" />
          <line x1="12" y1="17.5" x2="12.01" y2="17.5" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      )
    case 'dot':
      return (
        <svg {...common} fill={color} stroke="none">
          <circle cx="12" cy="12" r="6" />
        </svg>
      )
    case 'handshake':
      return (
        <svg {...common}>
          <path d="m11 17 2 2a1 1 0 0 0 1.4 0l3.6-3.6a1 1 0 0 0 0-1.4l-4-4" />
          <path d="m21 11-4.5-4.5a2 2 0 0 0-2.5-.3L11 8" />
          <path d="M3 13l4.5 4.5a2 2 0 0 0 2.8 0" />
          <path d="m3 13 4-4 3 3" />
        </svg>
      )
    case 'flask':
      return (
        <svg {...common}>
          <path d="M9 3h6" /><path d="M10 3v6L5 19a1.5 1.5 0 0 0 1.4 2h11.2A1.5 1.5 0 0 0 19 19L14 9V3" strokeLinejoin="round" />
          <line x1="7.5" y1="15" x2="16.5" y2="15" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
          <path d="m3.5 7 8.5 6 8.5-6" />
        </svg>
      )
    case 'link':
      return (
        <svg {...common}>
          <path d="M10 13a4 4 0 0 0 5.66 0l3-3a4 4 0 1 0-5.66-5.66l-1.5 1.5" />
          <path d="M14 11a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.5-1.5" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...common}>
          <path d="M21 12a9 9 0 1 1-2.64-6.36" />
          <polyline points="21 3 21 8 16 8" />
        </svg>
      )
    case 'clipboard':
      return (
        <svg {...common}>
          <rect x="5" y="4" width="14" height="17" rx="2.5" />
          <rect x="8.5" y="2.5" width="7" height="4" rx="1.4" />
        </svg>
      )
    case 'bomb':
      return (
        <svg {...common}>
          <circle cx="10" cy="14" r="7" />
          <path d="m15.5 8.5 2-2" />
          <path d="M18 6.5 19.5 5" />
          <path d="M19.5 5c.8-.8 2-.8 2.5 0" />
          <path d="M17 7l1.2 1.2" />
        </svg>
      )
    case 'gift':
      return (
        <svg {...common}>
          <rect x="3.5" y="9" width="17" height="11" rx="1.5" />
          <line x1="12" y1="9" x2="12" y2="20" />
          <path d="M3.5 13h17" />
          <path d="M12 9C12 6 10 4.5 8.5 5.5 7 6.5 8 9 12 9Z" strokeLinejoin="round" />
          <path d="M12 9C12 6 14 4.5 15.5 5.5 17 6.5 16 9 12 9Z" strokeLinejoin="round" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" strokeLinejoin="round" />
          <path d="M18.5 15l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" strokeLinejoin="round" />
        </svg>
      )
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.2 9.2a2.8 2.8 0 0 1 5.4 1c0 1.9-2.8 2.5-2.8 4" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    case 'megaphone':
      return (
        <svg {...common}>
          <path d="M3 11v2a1 1 0 0 0 1 1h2l9 5V5L6 10H4a1 1 0 0 0-1 1Z" strokeLinejoin="round" />
          <path d="M18.5 8a4 4 0 0 1 0 8" />
        </svg>
      )
    case 'bell':
      return (
        <svg {...common}>
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" strokeLinejoin="round" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...common}>
          <rect x="6" y="2.5" width="12" height="19" rx="3" />
          <line x1="10.5" y1="18.5" x2="13.5" y2="18.5" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
          <polyline points="15 17 20 12 15 7" />
          <line x1="20" y1="12" x2="9" y2="12" />
        </svg>
      )
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </svg>
      )
    case 'bank':
      return (
        <svg {...common}>
          <path d="M3 9.5 12 4l9 5.5" />
          <line x1="4" y1="21" x2="20" y2="21" />
          <line x1="5.5" y1="11" x2="5.5" y2="18" />
          <line x1="10" y1="11" x2="10" y2="18" />
          <line x1="14" y1="11" x2="14" y2="18" />
          <line x1="18.5" y1="11" x2="18.5" y2="18" />
        </svg>
      )
    case 'eye':
      return (
        <svg {...common}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )
    case 'rocket':
      return (
        <svg {...common}>
          <path d="M12 2c3 1 6 5 6 10l-3 2H9l-3-2c0-5 3-9 6-10Z" strokeLinejoin="round" />
          <circle cx="12" cy="9" r="1.8" />
          <path d="M9 16c-2 1-2.5 3-2.5 5 2 0 4-.5 5-2.5" />
          <path d="M15 16c2 1 2.5 3 2.5 5-2 0-4-.5-5-2.5" />
        </svg>
      )
    case 'hash':
      return (
        <svg {...common}>
          <line x1="5" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="19" y2="15" />
          <line x1="11" y1="3" x2="8" y2="21" />
          <line x1="16" y1="3" x2="13" y2="21" />
        </svg>
      )
    case 'chevronRight':
      return (
        <svg {...common}><polyline points="9 5 16 12 9 19" /></svg>
      )
    case 'chevronLeft':
      return (
        <svg {...common}><polyline points="15 5 8 12 15 19" /></svg>
      )
    case 'copy':
      return (
        <svg {...common}>
          <rect x="8.5" y="8.5" width="12" height="12" rx="2.5" />
          <path d="M4.5 15.5A2 2 0 0 1 3.5 14V5a2 2 0 0 1 2-2h9a2 2 0 0 1 1.5.7" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
          <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
        </svg>
      )
    case 'mic':
      return (
        <svg {...common}>
          <rect x="9" y="2.5" width="6" height="11" rx="3" />
          <path d="M6 11a6 6 0 0 0 12 0" />
          <line x1="12" y1="17" x2="12" y2="21" />
          <line x1="9" y1="21" x2="15" y2="21" />
        </svg>
      )
    case 'upload':
      return (
        <svg {...common}>
          <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" />
          <polyline points="8 8 12 4 16 8" />
          <line x1="12" y1="4" x2="12" y2="15" />
        </svg>
      )
    case 'gem':
      return (
        <svg {...common}>
          <path d="M5 3h14l3 6-10 12L2 9l3-6Z" strokeLinejoin="round" />
          <path d="M2 9h20" /><path d="m9 3-2.5 6L12 21l5.5-12L15 3" />
        </svg>
      )
    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="16" rx="2.5" />
          <circle cx="8.5" cy="9.5" r="1.8" />
          <path d="m4 18 5-5 4 4 3-3 4 4" />
        </svg>
      )
    case 'palette':
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-1 2-2s-.6-2-2-2h-1a2 2 0 0 1 0-4h4a4 4 0 0 0 0-8h-3Z" strokeLinejoin="round" />
          <circle cx="8" cy="11" r="1" fill={color} stroke="none" />
          <circle cx="9" cy="7.5" r="1" fill={color} stroke="none" />
          <circle cx="13" cy="7" r="1" fill={color} stroke="none" />
        </svg>
      )
    case 'box':
      return (
        <svg {...common}>
          <path d="M3 8 12 3l9 5v8l-9 5-9-5V8Z" strokeLinejoin="round" />
          <path d="m3 8 9 5 9-5" /><line x1="12" y1="13" x2="12" y2="21" />
        </svg>
      )
    case 'check-circle':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="8 12 11 15 16 9" />
        </svg>
      )
    case 'verified':
      return (
        <svg
          width={size} height={size} viewBox="0 0 24 24"
          style={{ display: 'block', flexShrink: 0, ...style }}
          aria-label="verified"
        >
          <path
            d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z"
            fill={color === 'currentColor' ? '#3B82F6' : color}
          />
          <path d="m9 12 2 2 4-4" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      )
    default:
      return null
  }
}
