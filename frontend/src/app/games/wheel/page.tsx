'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Icon } from '@/components/ui/Icon'
import { GamePrize, PrizeIcon, RARITY } from '@/components/games/prize'
import { GameResult } from '@/components/games/GameResult'

export default function WheelPage() {
  const router = useRouter()
  const { user, refreshUser } = useAuthStore()
  const [cfg, setCfg] = useState<{ name: string; cost: number; segments: GamePrize[] } | null>(null)
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<GamePrize | null | undefined>(undefined)
  const rotRef = useRef(0)

  useEffect(() => { api.get('/games/config').then(r => setCfg(r.data.wheel)).catch(() => {}) }, [])

  const segs = cfg?.segments ?? []
  const n = segs.length || 1
  const seg = 360 / n

  // конический градиент секторов
  const conic = segs.length
    ? `conic-gradient(${segs.map((s, i) => {
        const c = RARITY[s.rarity]?.c ?? '#444'
        const dim = i % 2 === 0 ? 'cc' : '99'
        return `${c}${dim} ${i * seg}deg ${(i + 1) * seg}deg`
      }).join(', ')})`
    : '#222'

  const spin = async () => {
    if (!cfg || spinning) return
    if ((user?.coins ?? 0) < cfg.cost) { alert('Недостаточно монет'); return }
    setSpinning(true); setResult(undefined)
    try {
      const r = await api.post('/games/wheel/play')
      const winIndex: number = r.data.winIndex
      const desired = (360 - (winIndex * seg + seg / 2)) % 360
      const cur = rotRef.current
      const delta = ((desired - (cur % 360)) % 360 + 360) % 360
      const jitter = (Math.random() - 0.5) * seg * 0.5
      const next = cur + delta + 360 * 6 + jitter
      rotRef.current = next
      setRotation(next)
      await new Promise(res => setTimeout(res, 4700))
      await refreshUser()
      setResult(r.data.granted)
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setSpinning(false) }
  }

  const R = 150 // радиус

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 9px', color: '#9CA3AF', cursor: 'pointer', display: 'inline-flex' }}><Icon name="chevronLeft" size={16} /></button>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 900, color: '#fff', margin: 0 }}>CONDR WHEEL</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 12, padding: '6px 10px', color: '#EAB308', fontWeight: 900, fontSize: 14 }}><Icon name="coins" size={15} color="#EAB308" />{(user?.coins ?? 0).toLocaleString()}</span>
        </div>

        <div style={{ position: 'relative', width: R * 2 + 20, height: R * 2 + 20, margin: '28px auto 10px' }}>
          {/* pointer */}
          <div style={{ position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)', zIndex: 5, width: 0, height: 0, borderLeft: '12px solid transparent', borderRight: '12px solid transparent', borderTop: '20px solid #E8092E', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }} />
          <motion.div
            animate={{ rotate: rotation }}
            transition={{ duration: 4.7, ease: [0.12, 0.78, 0.16, 1] }}
            style={{ position: 'absolute', inset: 10, borderRadius: '50%', background: conic, border: '6px solid #0d0d12', boxShadow: '0 0 0 3px rgba(232,9,46,0.4), 0 14px 50px rgba(0,0,0,0.6)' }}
          >
            {segs.map((s, i) => {
              const a = i * seg + seg / 2
              return (
                <div key={i} style={{ position: 'absolute', top: '50%', left: '50%', transform: `rotate(${a}deg) translateY(-${R - 30}px)`, transformOrigin: '0 0' }}>
                  <div style={{ transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <PrizeIcon prize={s} size={22} />
                    <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.9)', whiteSpace: 'nowrap' }}>{s.kind === 'coins' ? s.amount : ''}</span>
                  </div>
                </div>
              )
            })}
          </motion.div>
          {/* hub */}
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 54, height: 54, borderRadius: '50%', background: 'radial-gradient(circle at 40% 30%, #2a2a33, #0d0d12)', border: '2px solid rgba(232,9,46,0.5)', zIndex: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(232,9,46,0.4)' }}>
            <Icon name="target" size={24} color="#E8092E" />
          </div>
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={spin} disabled={spinning}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', cursor: spinning ? 'default' : 'pointer', fontSize: 16, fontWeight: 900, color: '#fff', background: spinning ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #E8092E, #b3001f)', boxShadow: spinning ? 'none' : '0 8px 28px rgba(232,9,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14 }}>
          {spinning ? 'Крутим…' : <>Крутить · <Icon name="coins" size={17} color="#fff" /> {cfg?.cost ?? '—'}</>}
        </motion.button>

        {result !== undefined && <GameResult granted={result} onClose={() => setResult(undefined)} />}
      </div>
    </RequireRegistration>
  )
}
