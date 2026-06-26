'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { ParticleBackground } from '@/components/ui/ParticleBackground'
import { Logo } from '@/components/ui/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Icon, IconName } from '@/components/ui/Icon'

const ACCENT = '#E8092E'
const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/web',             label: 'Главная',  icon: 'rocket' },
  { href: '/web/leaderboard', label: 'Рейтинг',  icon: 'trophy' },
  { href: '/web/clans',       label: 'Кланы',    icon: 'shield' },
  { href: '/web/shop',        label: 'Магазин',  icon: 'cart' },
  { href: '/web/friends',     label: 'Друзья',   icon: 'users' },
  { href: '/web/profile',     label: 'Профиль',  icon: 'user' },
]

function Loader() {
  return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#060608' }}>
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: ACCENT }} />
  </div>
}

export default function WebLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, hydrateFromToken, logout } = useAuthStore()
  const [isMobile, setIsMobile] = useState<boolean | null>(null)
  const isLogin = pathname === '/web/login'

  useEffect(() => { setIsMobile(window.matchMedia('(max-width: 820px)').matches) }, [])

  useEffect(() => {
    if (isLogin || isMobile === null) return
    // Мобильный сайт = реальные экраны приложения (как в Telegram). Уводим /web/* → app-эквивалент.
    if (isMobile) {
      const appPath = pathname.replace(/^\/web/, '') || '/dashboard'
      router.replace(appPath)
      return
    }
    if (!isAuthenticated) hydrateFromToken().then((ok) => { if (!ok) router.replace('/web/login') })
  }, [isLogin, isMobile, isAuthenticated, pathname])

  if (isLogin) return <>{children}</>
  if (isMobile === null || isMobile) return <Loader />
  if (!isAuthenticated || !user) return <Loader />

  return (
    <div style={{ minHeight: '100vh', background: '#060608', color: '#fff', position: 'relative' }}>
      <ParticleBackground />

      {/* Top nav */}
      <header style={{ position: 'sticky', top: 0, zIndex: 30, height: 62, display: 'flex', alignItems: 'center', gap: 24, padding: '0 28px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(8,8,11,0.72)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}>
        <button onClick={() => router.push('/web')} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
          <div style={{ filter: `drop-shadow(0 0 10px ${ACCENT}66)` }}><Logo size={30} color={ACCENT} /></div>
          <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff' }}>CONDR</span>
        </button>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 4, flex: 1 }}>
          {NAV.map((n) => {
            const active = n.href === '/web' ? pathname === '/web' : pathname.startsWith(n.href)
            return (
              <button key={n.href} onClick={() => router.push(n.href)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: active ? `${ACCENT}1a` : 'transparent', color: active ? '#fff' : '#9CA3AF', position: 'relative', transition: 'background .15s, color .15s' }}>
                <Icon name={n.icon} size={17} color={active ? ACCENT : '#6B7280'} />
                <span style={{ fontSize: 14, fontWeight: active ? 800 : 600 }}>{n.label}</span>
              </button>
            )
          })}
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 11, padding: '6px 12px' }}>
            <Icon name="coins" size={15} color="#EAB308" /><span style={{ fontWeight: 900, fontSize: 13.5, color: '#EAB308' }}>{(user.coins || 0).toLocaleString()}</span>
          </div>
          <button onClick={() => router.push('/web/profile')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
            <Avatar avatarUrl={user.avatarUrl} name={user.gameNickname || user.firstName} size={36} style={{ border: `2px solid ${ACCENT}40` }} />
          </button>
          <button onClick={() => { logout(); router.replace('/web/login') }} title="Выйти" style={{ width: 34, height: 34, borderRadius: 9, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.05)', color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="logout" size={16} color="#6B7280" />
          </button>
        </div>
      </header>

      <main style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 1200, margin: '0 auto', padding: '28px 28px 60px' }}>
        {children}
      </main>
    </div>
  )
}
