'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Icon } from '@/components/ui/Icon'

const ACCENT = '#E8092E'
const SITE_URL = 'condrfaceit.ru/web'

export default function LinkSitePage() {
  return <RequireRegistration><Inner /></RequireRegistration>
}

function Inner() {
  const router = useRouter()
  const [code, setCode] = useState<string | null>(null)
  const [left, setLeft] = useState(0)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const gen = useCallback(async () => {
    setLoading(true)
    try { const r = await api.post('/auth/web/pair'); setCode(r.data.code); setLeft(r.data.expiresIn || 300) }
    catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { gen() }, [gen])
  useEffect(() => { if (left <= 0) return; const t = setInterval(() => setLeft(l => Math.max(0, l - 1)), 1000); return () => clearInterval(t) }, [left])

  const copy = () => { if (code) { navigator.clipboard?.writeText(code).catch(() => {}); setCopied(true); setTimeout(() => setCopied(false), 1500) } }
  const mm = Math.floor(left / 60), ss = left % 60

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}>
        <Icon name="chevronLeft" size={18} color="#9CA3AF" /> Назад
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${ACCENT}, #A855F7)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 22px ${ACCENT}55` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)' }} />
          <Icon name="link" size={22} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>Вход на сайт</h1>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>Тот же аккаунт на компьютере</div>
        </div>
      </div>

      <div style={{ fontSize: 13.5, color: '#B0B0B8', lineHeight: 1.6, marginBottom: 18 }}>
        Открой <b style={{ color: '#fff' }}>{SITE_URL}</b> в браузере на компьютере, выбери «Код привязки» и введи этот код — войдёшь под своим аккаунтом со всей статистикой, лобби и кланами.
      </div>

      {/* Code card */}
      <div style={{ borderRadius: 22, padding: 24, textAlign: 'center', position: 'relative', overflow: 'hidden',
        background: `radial-gradient(120% 120% at 0% 0%, ${ACCENT}1f, transparent 55%), linear-gradient(160deg, #0c0c11, #08080b)`, border: `1px solid ${ACCENT}3a` }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14 }}>Код привязки</div>
        {loading ? (
          <div style={{ padding: '18px 0' }}><motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: ACCENT, margin: '0 auto' }} /></div>
        ) : code && left > 0 ? (
          <>
            <button onClick={copy} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: '0.22em', color: '#fff', fontFamily: 'monospace', textShadow: `0 2px 24px ${ACCENT}66`, paddingLeft: '0.22em' }}>{code}</div>
            </button>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 14 }}>
              <button onClick={copy} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: copied ? 'rgba(34,197,94,0.16)' : 'rgba(255,255,255,0.06)', color: copied ? '#22C55E' : '#D1D5DB', fontSize: 13, fontWeight: 700 }}>
                <Icon name={copied ? 'check' : 'copy'} size={14} color={copied ? '#22C55E' : '#D1D5DB'} />{copied ? 'Скопировано' : 'Копировать'}
              </button>
              <div style={{ fontSize: 13, color: '#6B7280', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>Истекает через {mm}:{String(ss).padStart(2, '0')}</div>
            </div>
          </>
        ) : (
          <div style={{ padding: '10px 0' }}>
            <div style={{ fontSize: 14, color: '#9CA3AF', marginBottom: 14 }}>Код истёк</div>
            <button onClick={gen} style={{ padding: '11px 22px', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #b8001e)` }}>Сгенерировать новый</button>
          </div>
        )}
      </div>

      {code && left > 0 && (
        <button onClick={gen} style={{ width: '100%', marginTop: 12, padding: '12px 0', borderRadius: 13, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Icon name="refresh" size={15} color="#9CA3AF" /> Новый код
        </button>
      )}
    </div>
  )
}
