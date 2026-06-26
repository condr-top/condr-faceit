'use client'

import { useSwipeNav } from '@/hooks/useSwipeNav'
import { BottomNav } from '@/components/layout/BottomNav'
import { ParticleBackground } from '@/components/ui/ParticleBackground'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '@/store/uiStore'

const PAGES_WITH_NAV = [
  '/dashboard', '/leaderboard', '/clans', '/shop', '/profile',
  '/history', '/missions', '/support', '/tournaments', '/friends',
]

const NO_PARTICLES = ['/auth']

export function SwipeNavProvider({ children }: { children: React.ReactNode }) {
  useSwipeNav()
  const pathname = usePathname()
  const { hideNav } = useUiStore()
  const isWeb = pathname === '/web' || pathname.startsWith('/web/')
  const showNav = !isWeb && PAGES_WITH_NAV.some(p => pathname === p || pathname.startsWith(p + '/'))
  // Сайт (/web) имеет собственную десктоп-оболочку — мобильный фон/навбар не нужны.
  const showParticles = !isWeb && !NO_PARTICLES.includes(pathname)

  return (
    <>
      {showParticles && <ParticleBackground />}
      {/* Без собственного z-index: иначе контент образует stacking-контекст,
          и нижние модалки (z:100) оказываются под навбаром (z:40). */}
      <div style={{ position: 'relative' }}>
        {children}
      </div>
      <AnimatePresence>
        {showNav && !hideNav && (
          <motion.div
            initial={{ y: 0 }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40 }}
          >
            <BottomNav />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
