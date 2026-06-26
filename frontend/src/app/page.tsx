'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingScreen } from '@/components/ui/LoadingScreen'

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    // В Telegram — вебапп (через /auth, где initData валидирует пользователя).
    // В обычном браузере initData пустой → ведём на сайт (/web), иначе будет вечная загрузка.
    const tg = (window as any).Telegram?.WebApp
    const inTelegram = !!(tg && ((typeof tg.initData === 'string' && tg.initData.length > 0) || tg.initDataUnsafe?.user))
    if (inTelegram) { router.replace('/auth'); return }
    // Браузер: есть сохранённый токен → сразу в приложение (тот же дизайн), иначе на вход сайта.
    const token = localStorage.getItem('condr_faceit_token')
    router.replace(token ? '/web' : '/web/login')
  }, [])

  return <LoadingScreen />
}
