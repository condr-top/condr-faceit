'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingScreen } from '@/components/ui/LoadingScreen'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // Always go through /auth so Telegram initData re-validates the current user
    router.replace('/auth')
  }, [])

  return <LoadingScreen />
}
