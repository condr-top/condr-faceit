'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Icon } from '@/components/ui/Icon'
import { PrizeCell, GamePrize } from '@/components/games/prize'
import { GameResult } from '@/components/games/GameResult'

const CELL = 96, STEP = CELL + 8, LAND = 45, REEL_LEN = 52

export default function CasePage() {
  const router = useRouter()
  const { user, refreshUser } = useAuthStore()
  const [cfg, setCfg] = useState<{ name: string; cost: number; prizes: GamePrize[] } | null>(null)
  const [reel, setReel] = useState<GamePrize[]>([])
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<GamePrize | null | undefined>(undefined)
  const trackRef = useRef<HTMLDivElement>(null)
  const controls = useAnimationControls()

  useEffect(() => {
    api.get('/games/config').then(r => {
      setCfg(r.data.case)
      // стартовая «холостая» лента
      setReel(Array.from({ length: REEL_LEN }, () => rnd(r.data.case.prizes)))
    }).catch(() => {})
  }, [])

  const rnd = (pool: GamePrize[]) => pool[Math.floor(Math.random() * pool.length)]

  const open = async () => {
    if (!cfg || spinning) return
    if ((user?.coins ?? 0) < cfg.cost) { alert('Недостаточно монет'); return }
    setSpinning(true); setResult(undefined)
    try {
      const r = await api.post('/games/case/play')
      const won: GamePrize = r.data.prize
      // строим ленту с победным предметом на позиции LAND
      const items = Array.from({ length: REEL_LEN }, () => rnd(cfg.prizes))
      items[LAND] = won
      setReel(items)
      const w = trackRef.current?.parentElement?.clientWidth ?? 360
      const jitter = (Math.random() - 0.5) * STEP * 0.6
      const target = w / 2 - (LAND * STEP + STEP / 2) + jitter
      controls.set({ x: 0 })
      await controls.start({ x: target, transition: { duration: 5, ease: [0.08, 0.86, 0.18, 1] } })
      await refreshUser()
      setResult(r.data.granted)
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setReel(Array.from({ length: REEL_LEN }, () => rnd(cfg.prizes))) }
    finally { setSpinning(false) }
  }

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 0 96px', maxWidth: 560, margin: '0 auto' }}>
        <Header title="CONDR CASE" coins={user?.coins ?? 0} onBack={() => router.back()} />

        <div style={{ padding: '24px 14px 0', textAlign: 'center' }}>
          <motion.div animate={{ rotate: spinning ? [0, -4, 4, 0] : 0 }} transition={{ duration: 0.4, repeat: spinning ? Infinity : 0 }}
            style={{ display: 'inline-flex', width: 92, height: 92, borderRadius: 22, alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 40% 30%, #2a2a33, #0d0d12)', border: '1px solid rgba(232,9,46,0.4)', boxShadow: '0 0 34px rgba(232,9,46,0.3)', marginBottom: 6 }}>
            <Icon name="box" size={48} color="#E8092E" />
          </motion.div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>Прокрути и забери награду</div>
        </div>

        {/* Reel */}
        <div style={{ position: 'relative', margin: '18px 0', overflow: 'hidden', padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
          {/* center marker */}
          <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: 3, transform: 'translateX(-50%)', background: 'linear-gradient(180deg, #E8092E, #ff5a72)', boxShadow: '0 0 12px #E8092E', zIndex: 3 }} />
          <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', zIndex: 3, width: 0, height: 0, borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '10px solid #E8092E' }} />
          {/* side fades */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'linear-gradient(90deg, #0a0a0e 0%, transparent 18%, transparent 82%, #0a0a0e 100%)' }} />
          <motion.div ref={trackRef} animate={controls} style={{ display: 'flex', alignItems: 'center', willChange: 'transform' }}>
            {reel.map((p, i) => <PrizeCell key={i} prize={p} w={CELL} h={118} />)}
          </motion.div>
        </div>

        <div style={{ padding: '0 14px' }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={open} disabled={spinning}
            style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', cursor: spinning ? 'default' : 'pointer', fontSize: 16, fontWeight: 900, color: '#fff', background: spinning ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #E8092E, #b3001f)', boxShadow: spinning ? 'none' : '0 8px 28px rgba(232,9,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {spinning ? 'Открываем…' : <>Открыть · <Icon name="coins" size={17} color="#fff" /> {cfg?.cost ?? '—'}</>}
          </motion.button>
        </div>

        {result !== undefined && <GameResult granted={result} onClose={() => setResult(undefined)} />}
      </div>
    </RequireRegistration>
  )
}

function Header({ title, coins, onBack }: { title: string; coins: number; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px' }}>
      <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 9px', color: '#9CA3AF', cursor: 'pointer', display: 'inline-flex' }}><Icon name="chevronLeft" size={16} /></button>
      <h1 style={{ flex: 1, fontSize: 19, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{title}</h1>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 12, padding: '6px 10px', color: '#EAB308', fontWeight: 900, fontSize: 14 }}><Icon name="coins" size={15} color="#EAB308" />{coins.toLocaleString()}</span>
    </div>
  )
}
