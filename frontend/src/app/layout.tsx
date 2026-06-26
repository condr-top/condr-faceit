import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import './nprogress.css'
import { TelegramProvider } from '@/components/providers/TelegramProvider'
import { NavigationProgress } from '@/components/layout/NavigationProgress'
import { BetaBanner } from '@/components/ui/BetaBanner'
import { SwipeNavProvider } from '@/components/providers/SwipeNavProvider'
import { PwaInstall } from '@/components/pwa/PwaInstall'
import { ForceRegionGate } from '@/components/providers/ForceRegionGate'

export const metadata: Metadata = {
  title: 'CONDR | Faceit',
  description: 'Competitive matchmaking for Standoff 2',
  applicationName: 'CONDR',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'CONDR' },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

// Это клиентский Telegram-мини-апп: статический пререндер не нужен и ломается
// на хуках вроде useSearchParams(). Рендерим все роуты динамически (на запросе).
export const dynamic = 'force-dynamic'

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#060608',
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
          <PwaInstall />
          <ForceRegionGate />
        </TelegramProvider>
      </body>
    </html>
  )
}
