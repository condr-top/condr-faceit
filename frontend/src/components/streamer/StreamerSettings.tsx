'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { Icon } from '@/components/ui/Icon'
import { StreamerWidget, ObsStats } from './StreamerWidget'

const ACCENT = '#A855F7'

/** Раздел настроек «Для стримеров»: ссылка на OBS-виджет, копирование, сброс, живое превью. */
export function StreamerSettings() {
  const [token, setToken] = useState<string | null>(null)
  const [stats, setStats] = useState<ObsStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.55)
  const [previewH, setPreviewH] = useState(150)

  const url = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/obs/${token}` : ''

  const loadStats = async (t: string) => {
    try {
      const r = await fetch(`/api/obs/${t}`, { cache: 'no-store' })
      if (r.ok) setStats(await r.json())
    } catch {}
  }

  useEffect(() => {
    api.get('/users/stream-token').then((r) => {
      setToken(r.data.token)
      loadStats(r.data.token)
    }).catch(() => {})
  }, [])

  // Масштабируем превью (виджет 600px) под ширину карточки
  useLayoutEffect(() => {
    const w = wrapRef.current?.clientWidth || 330
    const s = Math.min(1, w / 620)
    setScale(s)
    const h = innerRef.current?.offsetHeight || 200
    setPreviewH(Math.ceil(h * s))
  }, [stats])

  const copy = async () => {
    if (!url) return
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { /* clipboard недоступен */ }
  }

  const regenerate = async () => {
    if (!window.confirm('Сбросить ссылку? Старая перестанет работать — нужно будет обновить источник в OBS.')) return
    setRegenerating(true)
    try {
      const r = await api.post('/users/stream-token/regenerate')
      setToken(r.data.token)
      await loadStats(r.data.token)
    } catch {} finally { setRegenerating(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.31 }}
      style={{ marginBottom: 14, background: 'rgba(168,85,247,0.05)', border: '1px solid rgba(168,85,247,0.18)', borderRadius: 14, padding: 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
        <Icon name="link" size={15} color={ACCENT} />
        <span style={{ fontSize: 10, color: ACCENT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Для стримеров</span>
      </div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.45, marginBottom: 12 }}>
        Виджет статистики для OBS. Добавь <b style={{ color: '#fff' }}>Источник → Браузер</b> и вставь ссылку. Размер: <b style={{ color: '#fff' }}>640×200</b>, фон прозрачный.
      </div>

      {/* Live preview */}
      <div ref={wrapRef} style={{ width: '100%', height: stats ? previewH : 150, overflow: 'hidden', borderRadius: 16, marginBottom: 12, background: 'repeating-conic-gradient(rgba(255,255,255,0.04) 0% 25%, transparent 0% 50%) 0 / 18px 18px' }}>
        {stats
          ? <div ref={innerRef} style={{ width: 620, transform: `scale(${scale})`, transformOrigin: 'top left' }}><StreamerWidget stats={stats} /></div>
          : <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4B5563', fontSize: 12 }}>Загрузка превью…</div>}
      </div>

      {/* URL + copy */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px', borderRadius: 11, background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 11.5, color: '#9CA3AF', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {url || 'Получаем ссылку…'}
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={copy} disabled={!url}
          style={{ flexShrink: 0, padding: '0 16px', borderRadius: 11, border: 'none', cursor: url ? 'pointer' : 'default', fontSize: 12.5, fontWeight: 800, color: '#fff', background: copied ? '#22C55E' : `linear-gradient(135deg, ${ACCENT}, #7C3AED)`, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name={copied ? 'check' : 'copy'} size={14} color="#fff" />{copied ? 'Скопировано' : 'Копировать'}
        </motion.button>
      </div>

      <button onClick={regenerate} disabled={regenerating}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 11.5, fontWeight: 700, padding: '2px 0' }}>
        <Icon name="refresh" size={12} color="#6B7280" />{regenerating ? 'Сбрасываем…' : 'Сбросить ссылку'}
      </button>
    </motion.div>
  )
}
