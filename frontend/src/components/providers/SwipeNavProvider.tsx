'use client'

import { useSwipeNav } from '@/hooks/useSwipeNav'
import { BottomNav } from '@/components/layout/BottomNav'
import { ParticleBackground } from '@/components/ui/ParticleBackground'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useUiStore } from '@/store/uiStore'

const PAGES_WITH_NAV = [
  '/dashboard', '/leaderboard', '/friends', '/shop', '/profile',
  '/history', '/missions', '/support', '/tournaments',
]

const NO_PARTICLES = ['/auth']

export function SwipeNavProvider({ children }: { children: React.ReactNode }) {
  useSwipeNav()
  const pathname = usePathname()
  const { hideNav } = useUiStore()
  const showNav = PAGES_WITH_NAV.some(p => pathname === p || pathname.startsWith(p + '/'))
  const showParticles = !NO_PARTICLES.includes(pathname)

  return (
    <>
      {showParticles && <ParticleBackground />}
      <div style={{ position: 'relative', zIndex: 1 }}>
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
