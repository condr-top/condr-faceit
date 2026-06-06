'use client'

import { useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import NProgress from 'nprogress'

const TABS = [
  '/dashboard',
  '/leaderboard',
  '/friends',
  '/shop',
  '/profile',
]

const MIN_SWIPE_X = 55    // min horizontal distance to count as swipe
const MAX_SWIPE_Y = 80    // max vertical drift — beyond this it's a scroll, not swipe
const MIN_VELOCITY = 0.3  // px/ms — must be fast enough to be intentional

export function useSwipeNav() {
  const router = useRouter()
  const pathname = usePathname()
  const touchStart = useRef<{ x: number; y: number; t: number } | null>(null)

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0]
      touchStart.current = { x: t.clientX, y: t.clientY, t: Date.now() }
    }

    const onTouchEnd = (e: TouchEvent) => {
      if (!touchStart.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - touchStart.current.x
      const dy = t.clientY - touchStart.current.y
      const dt = Date.now() - touchStart.current.t
      touchStart.current = null

      // Must be mostly horizontal and fast enough
      if (Math.abs(dy) > MAX_SWIPE_Y) return
      if (Math.abs(dx) < MIN_SWIPE_X) return
      if (Math.abs(dx) / dt < MIN_VELOCITY) return

      const idx = TABS.indexOf(pathname)
      if (idx === -1) return // not a tab page — ignore

      const next = dx < 0 ? idx + 1 : idx - 1 // swipe left → next, swipe right → prev
      if (next < 0 || next >= TABS.length) return

      NProgress.start()
      router.push(TABS[next])
    }

    document.addEventListener('touchstart', onTouchStart, { passive: true })
    document.addEventListener('touchend', onTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [pathname, router])
}
