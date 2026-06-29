'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { StreamerWidget, ObsStats } from '@/components/streamer/StreamerWidget'

/**
 * Публичная страница OBS-виджета (Browser Source). Прозрачный фон, без чрома.
 * Опрашивает /api/obs/<token> каждые 20с, чтобы цифры на стриме были свежими.
 */
export default function ObsWidgetPage() {
  const { token } = useParams()
  const [stats, setStats] = useState<ObsStats | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Прозрачный фон для захвата в OBS
  useEffect(() => {
    const html = document.documentElement
    const body = document.body
    const prevH = html.style.background, prevB = body.style.background
    html.style.background = 'transparent'
    body.style.background = 'transparent'
    return () => { html.style.background = prevH; body.style.background = prevB }
  }, [])

  useEffect(() => {
    if (!token) return
    let alive = true
    const load = async () => {
      try {
        const r = await fetch(`/api/obs/${token}`, { cache: 'no-store' })
        if (!r.ok) { if (alive && r.status === 404) setNotFound(true); return }
        const data = await r.json()
        if (alive) { setStats(data); setNotFound(false) }
      } catch { /* временная ошибка сети — оставляем прошлые данные */ }
    }
    load()
    const t = setInterval(load, 20000)
    return () => { alive = false; clearInterval(t) }
  }, [token])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'transparent', display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-start', padding: 12 }}>
      {stats
        ? <StreamerWidget stats={stats} />
        : notFound
          ? <div style={{ color: '#EF4444', fontWeight: 800, fontSize: 15, fontFamily: 'system-ui' }}>Виджет не найден — проверьте ссылку</div>
          : null}
    </div>
  )
}
