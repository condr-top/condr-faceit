'use client'

import { useEffect } from 'react'

export function TelegramProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp
    if (tg) {
      tg.ready()
      tg.expand()
      tg.setHeaderColor('#0A0A0A')
      tg.setBackgroundColor('#0A0A0A')
    }
  }, [])

  return <>{children}</>
}
