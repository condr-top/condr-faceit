'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import NProgress from 'nprogress'

NProgress.configure({ showSpinner: false, trickleSpeed: 80, minimum: 0.15 })

export function NavigationProgress() {
  const pathname = usePathname()

  useEffect(() => {
    NProgress.done()
  }, [pathname])

  return null
}

export function startProgress() {
  NProgress.start()
}
