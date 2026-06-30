'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Icon } from '@/components/ui/Icon'
import { GamePrize } from '@/components/games/prize'
import { GameResult } from '@/components/games/GameResult'

const SYM_H = 92
const GLYPH: Record<string, { g: string; c: string }> = {
  coin:    { g: '🪙', c: '#EAB308' },
  star:    { g: '⭐', c: '#FACC15' },
  seven:   { g: '7',  c: '#E8092E' },
  diamond: { g: '💎', c: '#22D3EE' },
  crown:   { g: '👑', c: '#F59E0B' },
  condr:   { g: '⚔️', c: '#E8092E' },
}

function SymCell({ id }: { id: string }) {
  const s = GLYPH[id] || { g: '?', c: '#888' }
  return (
    <div style={{ height: SYM_H, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: id === 'seven' ? 46 : 44, fontWeight: 900, color: s.c, textShadow: `0 0 16px ${s.c}66` }}>
      {s.g}
    </div>
  )
}

function Reel({ symbols, result, spinId, duration }: { symbols: string[]; result: string; spinId: number; duration: number }) {
  const controls = useAnimationControls()
  const [strip, setStrip] = useState<string[]>(() => Array.from({ length: 8 }, () => symbols[Math.floor(Math.random() * symbols.length)]))
  useEffect(() => {
    if (!spinId || !symbols.length) return
    const s = Array.from({ length: 26 }, () => symbols[Math.floor(Math.random() * symbols.length)])
    s[24] = result
    setStrip(s)
    controls.set({ y: 0 })
    controls.start({ y: -(24 * SYM_H), transition: { duration, ease: [0.1, 0.82, 0.18, 1] } })
  }, [spinId])
  return (
    <div style={{ flex: 1, height: SYM_H, overflow: 'hidden', position: 'relative', background: 'linear-gradient(180deg, #0c0c11, #07070a)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.07)' }}>
      <div style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none', background: 'linear-gradient(180deg, rgba(0,0,0,0.5), transparent 30%, transparent 70%, rgba(0,0,0,0.5))' }} />
      <motion.div animate={controls}>{strip.map((s, i) => <SymCell key={i} id={s} />)}</motion.div>
    </div>
  )
}

export default function SlotsPage() {
  const router = useRouter()
  const { user, refreshUser } = useAuthStore()
  const [cfg, setCfg] = useState<{ name: string; cost: number; symbols: { id: string }[] } | null>(null)
  const [spinning, setSpinning] = useState(false)
  const [spinId, setSpinId] = useState(0)
  const [results, setResults] = useState<string[]>(['coin', 'star', 'seven'])
  const [result, setResult] = useState<GamePrize | null | undefined>(undefined)

  useEffect(() => { api.get('/games/config').then(r => setCfg(r.data.slots)).catch(() => {}) }, [])
  const symIds = (cfg?.symbols ?? []).map(s => s.id)

  const spin = async () => {
    if (!cfg || spinning) return
    if ((user?.coins ?? 0) < cfg.cost) { alert('Недостаточно монет'); return }
    setSpinning(true); setResult(undefined)
    try {
      const r = await api.post('/games/slots/play')
      setResults(r.data.symbols)
      setSpinId(id => id + 1)
      await new Promise(res => setTimeout(res, 3100))
      await refreshUser()
      setResult(r.data.granted ?? null)
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setSpinning(false) }
  }

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <button onClick={() => router.back()} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '7px 9px', color: '#9CA3AF', cursor: 'pointer', display: 'inline-flex' }}><Icon name="chevronLeft" size={16} /></button>
          <h1 style={{ flex: 1, fontSize: 19, fontWeight: 900, color: '#fff', margin: 0 }}>CONDR SLOTS</h1>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 12, padding: '6px 10px', color: '#EAB308', fontWeight: 900, fontSize: 14 }}><Icon name="coins" size={15} color="#EAB308" />{(user?.coins ?? 0).toLocaleString()}</span>
        </div>

        {/* Machine */}
        <div style={{ margin: '28px 0 18px', padding: 14, borderRadius: 22, background: 'radial-gradient(120% 120% at 50% 0%, rgba(232,9,46,0.14), transparent 60%), linear-gradient(180deg, #15151c, #0a0a0f)', border: '1px solid rgba(232,9,46,0.35)', boxShadow: '0 16px 50px rgba(0,0,0,0.5)' }}>
          <div style={{ position: 'relative', display: 'flex', gap: 8 }}>
            {/* win line */}
            <div style={{ position: 'absolute', top: '50%', left: -4, right: -4, height: 2, transform: 'translateY(-50%)', background: 'linear-gradient(90deg, transparent, #E8092E, transparent)', zIndex: 3, pointerEvents: 'none' }} />
            <Reel symbols={symIds} result={results[0]} spinId={spinId} duration={2.0} />
            <Reel symbols={symIds} result={results[1]} spinId={spinId} duration={2.5} />
            <Reel symbols={symIds} result={results[2]} spinId={spinId} duration={3.0} />
          </div>
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={spin} disabled={spinning}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', cursor: spinning ? 'default' : 'pointer', fontSize: 16, fontWeight: 900, color: '#fff', background: spinning ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg, #E8092E, #b3001f)', boxShadow: spinning ? 'none' : '0 8px 28px rgba(232,9,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {spinning ? 'Крутим…' : <>Крутить · <Icon name="coins" size={17} color="#fff" /> {cfg?.cost ?? '—'}</>}
        </motion.button>
        <div style={{ textAlign: 'center', fontSize: 11, color: '#4B5563', marginTop: 10 }}>3 одинаковых — большой приз · 2 монеты/звезды — мелкий</div>

        {result !== undefined && <GameResult granted={result} onClose={() => setResult(undefined)} />}
      </div>
    </RequireRegistration>
  )
}
