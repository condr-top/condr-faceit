'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { Icon, IconName } from '@/components/ui/Icon'
import { FRAMES as FRAME_VIS, TITLES as TITLE_VIS } from '@/lib/cosmetics'

interface Cat { key: string; name: string; price: number }
interface Cosmetics {
  frames: Cat[]; titles: Cat[]
  ownedFrames: string[]; equippedFrame: string | null; title: string | null; coins: number
}

function SectionHeader({ label, sub, color, icon }: { label: string; sub: string; color: string; icon: IconName }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 22 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}1a`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}

export function CustomizationSection() {
  const { user, refreshUser } = useAuthStore()
  const [c, setC] = useState<Cosmetics | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = () => api.get('/shop/cosmetics').then(r => setC(r.data)).catch(() => {})
  useEffect(() => { load() }, [])

  const act = async (id: string, fn: () => Promise<any>, okMsg?: string) => {
    setBusy(id)
    try { await fn(); await load(); await refreshUser(); if (okMsg) {/* тихо */} }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setBusy(null) }
  }

  if (!c) return null
  const coins = user?.coins ?? c.coins

  return (
    <>
      {/* ── РАМКИ ── */}
      <SectionHeader label="Рамки аватара" sub="Видны другим игрокам везде" color="#A855F7" icon="image" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {c.frames.map((f, i) => {
          const vis = FRAME_VIS[f.key]
          const owned = c.ownedFrames.includes(f.key)
          const equipped = c.equippedFrame === f.key
          const id = `frame_${f.key}`
          return (
            <motion.div key={f.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}
              style={{ borderRadius: 16, padding: 14, background: `radial-gradient(120% 120% at 50% 0%, ${vis?.glow ?? 'rgba(168,85,247,0.2)'}, transparent 60%), #0f0f15`, border: `1px solid ${equipped ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.07)'}`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <Avatar avatarUrl={user?.avatarUrl} name={user?.gameNickname || 'CONDR'} size={62} frame={f.key} />
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{f.name}</div>
              {equipped ? (
                <button onClick={() => act(id, () => api.post('/shop/frame/equip', { key: null }))} disabled={busy === id}
                  style={{ width: '100%', padding: '8px 0', borderRadius: 10, border: '1px solid rgba(168,85,247,0.4)', background: 'rgba(168,85,247,0.14)', color: '#C084FC', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Надето · снять
                </button>
              ) : owned ? (
                <button onClick={() => act(id, () => api.post('/shop/frame/equip', { key: f.key }))} disabled={busy === id}
                  style={{ width: '100%', padding: '8px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #A855F7, #7C3AED)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>
                  Надеть
                </button>
              ) : (
                <button onClick={() => { if (coins < f.price) return alert('Недостаточно монет'); act(id, () => api.post('/shop/frame/buy', { key: f.key })) }} disabled={busy === id}
                  style={{ width: '100%', padding: '8px 0', borderRadius: 10, border: 'none', background: coins >= f.price ? 'linear-gradient(135deg, #A855F7, #7C3AED)' : 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                  <Icon name="coins" size={13} color="#fff" />{f.price.toLocaleString()}
                </button>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* ── ТИТУЛЫ ── */}
      <SectionHeader label="Титулы" sub="Один активный титул — новый заменяет старый" color="#EAB308" icon="crown" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {c.titles.map((t, i) => {
          const vis = TITLE_VIS[t.key]
          const active = c.title === t.key
          const id = `title_${t.key}`
          const col = vis?.color ?? '#EAB308'
          return (
            <motion.div key={t.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}
              style={{ borderRadius: 14, padding: '12px 14px', background: `${col}0f`, border: `1px solid ${active ? col + '88' : 'rgba(255,255,255,0.07)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: col, background: vis?.bg ?? `${col}1a`, border: `1px solid ${col}55`, padding: '4px 11px', borderRadius: 8, whiteSpace: 'nowrap' }}>{t.name}</span>
              <div style={{ flex: 1 }} />
              {active ? (
                <button onClick={() => act(id, () => api.post('/shop/title/clear'))} disabled={busy === id}
                  style={{ padding: '8px 14px', borderRadius: 10, border: `1px solid ${col}55`, background: `${col}1a`, color: col, fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="check" size={13} color={col} />Активен
                </button>
              ) : (
                <button onClick={() => { if (coins < t.price) return alert('Недостаточно монет'); act(id, () => api.post('/shop/title/buy', { key: t.key })) }} disabled={busy === id}
                  style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: coins >= t.price ? `linear-gradient(135deg, ${col}, ${col}bb)` : 'rgba(255,255,255,0.07)', color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="coins" size={13} color="#fff" />{t.price.toLocaleString()}
                </button>
              )}
            </motion.div>
          )
        })}
      </div>
    </>
  )
}
