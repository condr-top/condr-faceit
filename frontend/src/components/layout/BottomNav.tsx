'use client'

import { useRouter, usePathname } from 'next/navigation'
import { motion, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { useEffect, useState } from 'react'
import NProgress from 'nprogress'

export const tabs = [
  { href: '/dashboard',   label: 'Главная',  icon: HomeIcon,    color: '#E8092E' },
  { href: '/leaderboard', label: 'Рейтинг',  icon: TrophyIcon,  color: '#F59E0B' },
  { href: '/clans',       label: 'Кланы',    icon: ClanIcon,    color: '#22C55E' },
  { href: '/shop',        label: 'Магазин',  icon: ShopIcon,    color: '#A855F7' },
  { href: '/profile',     label: 'Профиль',  icon: ProfileIcon, color: '#60A5FA' },
]

// ── SVG icons ─────────────────────────────────────────────────────────────────
function HomeIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M3 12L12 3L21 12V20C21 20.55 20.55 21 20 21H15V16H9V21H4C3.45 21 3 20.55 3 20V12Z"
        stroke={active ? color : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
        fill={active ? `${color}20` : 'none'}
        style={{ transition: 'all 0.3s' }}
      />
    </svg>
  )
}

function TrophyIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M7 4H17V11C17 13.76 14.76 16 12 16C9.24 16 7 13.76 7 11V4Z"
        stroke={active ? color : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
        fill={active ? `${color}20` : 'none'}
        style={{ transition: 'all 0.3s' }}
      />
      <path d="M7 7H4C4 9.5 5.5 11.5 7 11.5M17 7H20C20 9.5 18.5 11.5 17 11.5M8 21H16M12 17V21"
        stroke={active ? color : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.7" strokeLinecap="round"
        style={{ transition: 'stroke 0.3s' }}
      />
    </svg>
  )
}

function ClanIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {/* Clan banner / pennant on a pole */}
      <path d="M5 3V21"
        stroke={active ? color : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.8" strokeLinecap="round"
        style={{ transition: 'stroke 0.3s' }}
      />
      <path d="M5 4H17.5C18.3 4 18.7 5 18.1 5.6L16 8L18.1 10.4C18.7 11 18.3 12 17.5 12H5V4Z"
        stroke={active ? color : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
        fill={active ? `${color}22` : 'none'}
        style={{ transition: 'all 0.3s' }}
      />
    </svg>
  )
}

function ShopIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M6 2L3 6V20C3 20.55 3.45 21 4 21H20C20.55 21 21 20.55 21 20V6L18 2H6Z"
        stroke={active ? color : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
        fill={active ? `${color}20` : 'none'}
        style={{ transition: 'all 0.3s' }}
      />
      <path d="M3 6H21M16 10C16 12.21 14.21 14 12 14C9.79 14 8 12.21 8 10"
        stroke={active ? color : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.7" strokeLinecap="round"
        style={{ transition: 'stroke 0.3s' }}
      />
    </svg>
  )
}

function ProfileIcon({ active, color }: { active: boolean; color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4"
        stroke={active ? color : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.7"
        fill={active ? `${color}20` : 'none'}
        style={{ transition: 'all 0.3s' }}
      />
      <path d="M4 20C4 16.13 7.58 13 12 13C16.42 13 20 16.13 20 20"
        stroke={active ? color : 'rgba(255,255,255,0.35)'}
        strokeWidth="1.7" strokeLinecap="round"
        style={{ transition: 'stroke 0.3s' }}
      />
    </svg>
  )
}

// ── Single tab ─────────────────────────────────────────────────────────────────
function NavTab({ tab, active, onClick }: {
  tab: typeof tabs[0]; active: boolean; onClick: () => void
}) {
  const [tapped, setTapped] = useState(false)
  const Icon = tab.icon

  const handleClick = () => {
    if (active) return
    setTapped(true)
    setTimeout(() => setTapped(false), 500)
    onClick()
  }

  return (
    <button
      onClick={handleClick}
      style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 4, padding: '12px 0 10px',
        background: 'none', border: 'none', cursor: 'pointer', position: 'relative',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Glow behind icon when active */}
      <AnimatePresence>
        {active && (
          <motion.div
            key="glow"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              marginTop: -22, marginLeft: -22,
              width: 44, height: 44,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${tab.color}40 0%, transparent 70%)`,
              filter: `blur(8px)`,
              pointerEvents: 'none',
            }}
          />
        )}
      </AnimatePresence>

      {/* Icon bounce on tap */}
      <motion.div
        animate={tapped ? { y: [-6, 2, 0], scale: [1.25, 0.95, 1] } : {}}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        style={{ position: 'relative', zIndex: 1 }}
      >
        <Icon active={active} color={tab.color} />
      </motion.div>

      {/* Label */}
      <span style={{
        fontSize: 9, fontWeight: active ? 700 : 500,
        color: active ? tab.color : 'rgba(255,255,255,0.3)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        transition: 'color 0.3s, font-weight 0.3s',
        position: 'relative', zIndex: 1,
        lineHeight: 1,
      }}>
        {tab.label}
      </span>
    </button>
  )
}

// ── BottomNav ──────────────────────────────────────────────────────────────────
export function BottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const activeIndex = tabs.findIndex(t => t.href === pathname)
  const idx = Math.max(0, activeIndex)
  const activeColor = tabs[idx]?.color ?? '#E8092E'

  // Sliding highlight bar
  const TAB_W = 100 / tabs.length
  const motionIdx = useSpring(idx, { stiffness: 440, damping: 38, mass: 0.65 })
  useEffect(() => { if (activeIndex >= 0) motionIdx.set(activeIndex) }, [activeIndex])
  const barLeft  = useTransform(motionIdx, v => `${v * TAB_W}%`)

  return (
    <div className="tg-safe" style={{ position: 'relative', padding: '0 12px 2px' }}>
      {/* Liquid glass container */}
      <div style={{
        borderRadius: 24,
        overflow: 'hidden',
        background: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(48px) saturate(200%) brightness(1.1)',
        WebkitBackdropFilter: 'blur(48px) saturate(200%) brightness(1.1)',
        border: '1px solid rgba(255,255,255,0.13)',
        boxShadow: `
          inset 0 1px 0 rgba(255,255,255,0.18),
          inset 0 -1px 0 rgba(255,255,255,0.04),
          0 8px 40px rgba(0,0,0,0.45),
          0 2px 8px rgba(0,0,0,0.25)
        `,
        position: 'relative',
      }}>

        {/* Specular light streak across top */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)',
          pointerEvents: 'none',
        }} />

        {/* Thin colored indicator line at top */}
        <motion.div style={{
          position: 'absolute', top: 0, height: 2,
          width: `${TAB_W}%`, left: barLeft,
          background: `linear-gradient(90deg, transparent, ${activeColor}cc, transparent)`,
          pointerEvents: 'none',
          borderRadius: 2,
        }} />

        {/* Tabs */}
        <div style={{ display: 'flex' }}>
          {tabs.map((tab) => (
            <NavTab
              key={tab.href}
              tab={tab}
              active={pathname === tab.href}
              onClick={() => {
                NProgress.start()
                router.push(tab.href)
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
