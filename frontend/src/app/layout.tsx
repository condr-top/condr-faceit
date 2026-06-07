import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import './nprogress.css'
import { TelegramProvider } from '@/components/providers/TelegramProvider'
import { NavigationProgress } from '@/components/layout/NavigationProgress'
import { BetaBanner } from '@/components/ui/BetaBanner'
import { SwipeNavProvider } from '@/components/providers/SwipeNavProvider'

export const metadata: Metadata = {
  title: 'CONDR | Faceit',
  description: 'Competitive matchmaking for Standoff 2',
}

// Это клиентский Telegram-мини-апп: статический пререндер не нужен и ломается
// на хуках вроде useSearchParams(). Рендерим все роуты динамически (на запросе).
export const dynamic = 'force-dynamic'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
      </head>
      <body className="bg-dark text-white antialiased">
        <TelegramProvider>
          <SwipeNavProvider>
            <NavigationProgress />
            {children}
          </SwipeNavProvider>
          {/* Вне SwipeNavProvider — иначе попадает в его stacking-context (zIndex:1)
              и оказывается под навбаром (zIndex:40). Здесь — поверх всего. */}
          <BetaBanner />
        </TelegramProvider>
      </body>
    </html>
  )
}
