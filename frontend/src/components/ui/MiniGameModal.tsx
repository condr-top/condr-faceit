'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { Icon } from '@/components/ui/Icon'

type EntityType = 'dot' | 'bomb'
interface Entity {
  id: number
  x: number          // percent of game area
  y: number
  size: number       // px
  type: EntityType
  color: string
  born: number
  ttl: number
}
interface Burst { id: number; x: number; y: number; color: string }

const COLORS = ['#E8092E', '#22C55E', '#F59E0B', '#A855F7', '#60A5FA', '#ec4899', '#06B6D4']
const MAX_PLAYS = 10

// Сложность 0..9: больше цель, чаще спавн, короче жизнь, больше бомб
function getParams(level: number) {
  return {
    target:     6 + level * 2,                    // 6..24 точек до победы
    roundTime:  20000 + level * 1000,             // 20с..29с
    ttl:        1700 - level * 95,                 // 1700..845мс жизнь объекта
    spawnEvery: 720 - level * 46,                  // 720..306мс между спавнами
    bombChance: 0.16 + level * 0.022,             // 16%..36% что спавн — бомба
    maxOnScreen: 4 + Math.floor(level / 2),        // 4..8
    size:       60 - level * 2.4,                  // 60..38px
  }
}

interface Props {
  playsToday: number
  onClose: () => void
  onWin: (coins: number, newPlays: number) => void
}
type Phase = 'ready' | 'playing' | 'win' | 'lose' | 'limit'

export function MiniGameModal({ playsToday, onClose, onWin }: Props) {
  const { refreshUser } = useAuthStore()
  const { setHideNav } = useUiStore()
  useEffect(() => { setHideNav(true); return () => setHideNav(false) }, [])

  // Внутренний счётчик сыгранных партий: после победы растёт без закрытия модалки,
  // чтобы можно было сразу играть следующий уровень вплоть до дневного лимита.
  const [plays, setPlays] = useState(playsToday)
  const level = Math.min(plays, 9)
  const P = getParams(level)

  const [phase, setPhase] = useState<Phase>(playsToday >= MAX_PLAYS ? 'limit' : 'ready')
  const [entities, setEntities] = useState<Entity[]>([])
  const [bursts, setBursts] = useState<Burst[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [timeLeft, setTimeLeft] = useState(P.roundTime)
  const [shake, setShake] = useState(0)
  const [claiming, setClaiming] = useState(false)

  const idRef = useRef(0)
  const startRef = useRef(0)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const spawnRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scoreRef = useRef(0)
  const phaseRef = useRef<Phase>(phase)
  phaseRef.current = phase

  const cleanup = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current)
    if (spawnRef.current) clearInterval(spawnRef.current)
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
  }, [])
  useEffect(() => () => cleanup(), [cleanup])

  const endGame = useCallback((result: 'win' | 'lose') => {
    cleanup()
    setEntities([])
    setPhase(result)
  }, [cleanup])

  const spawnOne = useCallback(() => {
    setEntities(prev => {
      if (prev.length >= P.maxOnScreen) return prev
      const isBomb = Math.random() < P.bombChance
      const id = ++idRef.current
      const e: Entity = {
        id,
        x: 10 + Math.random() * 80,
        y: 12 + Math.random() * 72,
        size: isBomb ? P.size * 0.94 : P.size,
        type: isBomb ? 'bomb' : 'dot',
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        born: Date.now(),
        ttl: P.ttl,
      }
      // авто-исчезновение (пропуск точки/бомбы не штрафуется)
      setTimeout(() => setEntities(d => d.filter(x => x.id !== id)), P.ttl)
      return [...prev, e]
    })
  }, [P.maxOnScreen, P.bombChance, P.size, P.ttl])

  const startGame = useCallback(() => {
    cleanup()
    idRef.current = 0
    scoreRef.current = 0
    setEntities([]); setBursts([]); setScore(0); setCombo(0)
    setTimeLeft(P.roundTime)
    startRef.current = Date.now()
    setPhase('playing')

    // первые объекты сразу
    spawnOne(); setTimeout(spawnOne, 180)
    spawnRef.current = setInterval(spawnOne, P.spawnEvery)

    tickRef.current = setInterval(() => {
      const left = Math.max(0, P.roundTime - (Date.now() - startRef.current))
      setTimeLeft(left)
      if (left <= 0) {
        endGame(scoreRef.current >= P.target ? 'win' : 'lose')
      }
    }, 50)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanup, P.roundTime, P.spawnEvery, P.target, spawnOne, endGame])

  const addBurst = useCallback((x: number, y: number, color: string) => {
    const id = ++idRef.current
    setBursts(b => [...b, { id, x, y, color }])
    setTimeout(() => setBursts(b => b.filter(z => z.id !== id)), 700)
  }, [])

  const tap = useCallback((e: Entity) => {
    if (phaseRef.current !== 'playing') return
    if (e.type === 'bomb') {
      // взрыв → поражение
      addBurst(e.x, e.y, '#EF4444')
      setShake(s => s + 1)
      if (navigator.vibrate) navigator.vibrate(120)
      endGame('lose')
      return
    }
    // точка поймана
    setEntities(prev => prev.filter(x => x.id !== e.id))
    addBurst(e.x, e.y, e.color)
    if (navigator.vibrate) navigator.vibrate(12)
    setCombo(c => {
      if (comboTimerRef.current) clearTimeout(comboTimerRef.current)
      comboTimerRef.current = setTimeout(() => setCombo(0), 1100)
      return c + 1
    })
    scoreRef.current += 1
    setScore(scoreRef.current)
    if (scoreRef.current >= P.target) endGame('win')
  }, [addBurst, endGame, P.target])

  const claimReward = async () => {
    setClaiming(true)
    try {
      const res = await api.post('/users/mini-game/claim')
      await refreshUser()
      const newPlays = res.data.playsToday
      onWin(res.data.coins, newPlays)
      // Не выходим на главную: предлагаем сыграть следующий уровень, пока есть попытки.
      setPlays(newPlays)
      setPhase(newPlays >= MAX_PLAYS ? 'limit' : 'ready')
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка')
    } finally { setClaiming(false) }
  }

  const progressPct = (timeLeft / P.roundTime) * 100
  const urgent = progressPct < 25

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(4,4,7,0.96)', backdropFilter: 'blur(10px)', display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 10px' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="target" size={16} color="#E8092E" />Поймай точки
          </div>
          <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>Уровень {level + 1} · {plays}/{MAX_PLAYS} игр сегодня</div>
        </div>
        {phase === 'playing' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Score / target */}
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
                {score}<span style={{ fontSize: 13, color: '#4B5563' }}>/{P.target}</span>
              </div>
              <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>поймано</div>
            </div>
          </div>
        ) : (
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', display: 'flex' }}><Icon name="x" size={20} /></button>
        )}
      </div>

      {/* Timer bar */}
      {phase === 'playing' && (
        <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', margin: '0 14px', borderRadius: 3, overflow: 'hidden' }}>
          <motion.div animate={{ width: `${progressPct}%` }} transition={{ ease: 'linear', duration: 0.05 }}
            style={{ height: '100%', borderRadius: 3, background: urgent ? 'linear-gradient(90deg, #EF4444, #ff5a72)' : 'linear-gradient(90deg, #22C55E, #34D399)', boxShadow: urgent ? '0 0 10px rgba(239,68,68,0.7)' : '0 0 8px rgba(34,197,94,0.5)' }} />
        </div>
      )}

      {/* Game area */}
      <motion.div
        animate={{ x: [0, -7, 7, -5, 5, 0] }}
        key={shake}
        transition={{ duration: 0.32 }}
        style={{ flex: 1, position: 'relative', overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}
      >
        {/* Ambient background grid + vignette */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '26px 26px', opacity: 0.5, pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, transparent 40%, rgba(4,4,7,0.85) 100%)', pointerEvents: 'none' }} />

        {/* Combo badge */}
        <AnimatePresence>
          {phase === 'playing' && combo >= 3 && (
            <motion.div
              key="combo"
              initial={{ opacity: 0, scale: 0.6, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.6 }}
              style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', zIndex: 5, pointerEvents: 'none', display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px', borderRadius: 20, background: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(232,9,46,0.25))', border: '1px solid rgba(245,158,11,0.5)', backdropFilter: 'blur(8px)' }}
            >
              <Icon name="flame" size={15} color="#F59E0B" />
              <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>Комбо ×{combo}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bursts */}
        {bursts.map(b => (
          <div key={b.id} style={{ position: 'absolute', left: `${b.x}%`, top: `${b.y}%`, transform: 'translate(-50%,-50%)', pointerEvents: 'none', zIndex: 4 }}>
            {Array.from({ length: 8 }).map((_, i) => {
              const a = (i / 8) * Math.PI * 2
              return (
                <motion.div key={i}
                  initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                  animate={{ opacity: 0, x: Math.cos(a) * 44, y: Math.sin(a) * 44, scale: 0.3 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ position: 'absolute', width: 7, height: 7, borderRadius: '50%', background: b.color, boxShadow: `0 0 8px ${b.color}` }} />
              )
            })}
            <motion.div initial={{ scale: 0.4, opacity: 0.8 }} animate={{ scale: 2.4, opacity: 0 }} transition={{ duration: 0.5 }}
              style={{ position: 'absolute', width: 40, height: 40, borderRadius: '50%', border: `2px solid ${b.color}`, transform: 'translate(-50%,-50%)', left: 0, top: 0 }} />
          </div>
        ))}

        {/* READY */}
        {phase === 'ready' && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 30 }}>
            <motion.div animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.6, repeat: Infinity }} style={{ marginBottom: 18, color: '#E8092E', display: 'flex', filter: 'drop-shadow(0 0 18px rgba(232,9,46,0.6))' }}>
              <Icon name="target" size={58} strokeWidth={1.6} />
            </motion.div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Уровень {level + 1}</div>
            <div style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', marginBottom: 18, lineHeight: 1.5, maxWidth: 300 }}>
              Лови <b style={{ color: '#fff' }}>{P.target}</b> цветных точек, пока не вышло время.<br />Можно тапать <b style={{ color: '#22C55E' }}>несколькими пальцами</b> сразу.
            </div>
            {/* Legend */}
            <div style={{ display: 'flex', gap: 22, marginBottom: 26 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #22C55E, #16a34a)', boxShadow: '0 0 14px rgba(34,197,94,0.6)' }} />
                <span style={{ fontSize: 10, color: '#22C55E', fontWeight: 800 }}>ЛОВИ</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <BombVisual size={34} />
                <span style={{ fontSize: 10, color: '#EF4444', fontWeight: 800 }}>НЕ ТРОГАЙ</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
              {Array.from({ length: MAX_PLAYS }).map((_, i) => (
                <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: i < plays ? '#374151' : i === plays ? '#22C55E' : 'rgba(255,255,255,0.08)', boxShadow: i === plays ? '0 0 6px rgba(34,197,94,0.6)' : 'none' }} />
              ))}
            </div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={startGame}
              style={{ padding: '14px 52px', borderRadius: 16, border: 'none', background: 'linear-gradient(135deg, #22C55E, #16a34a)', color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer', boxShadow: '0 6px 28px rgba(34,197,94,0.45)' }}>
              Начать!
            </motion.button>
            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 14, display: 'flex', alignItems: 'center', gap: 4 }}>+10 <Icon name="coins" size={12} color="#EAB308" /> за победу</div>
          </motion.div>
        )}

        {/* PLAYING — entities */}
        {phase === 'playing' && entities.map(e => (
          <motion.div
            key={e.id}
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            onPointerDown={(ev) => { ev.preventDefault(); tap(e) }}
            style={{
              position: 'absolute', left: `${e.x}%`, top: `${e.y}%`, width: e.size, height: e.size,
              transform: 'translate(-50%, -50%)', borderRadius: '50%', cursor: 'pointer', touchAction: 'none', zIndex: 3,
            }}
          >
            {e.type === 'dot' ? (
              <>
                {/* glossy neon dot */}
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                  background: `radial-gradient(circle at 34% 30%, #ffffff, ${e.color} 42%, ${e.color}cc 100%)`,
                  border: `2px solid ${e.color}`, boxShadow: `0 0 22px ${e.color}aa, 0 0 8px ${e.color}, inset 0 -6px 12px ${e.color}66` }} />
                {/* specular highlight */}
                <div style={{ position: 'absolute', top: '16%', left: '22%', width: '30%', height: '24%', borderRadius: '50%', background: 'rgba(255,255,255,0.7)', filter: 'blur(2px)' }} />
                {/* shrinking TTL ring */}
                <motion.div initial={{ scale: 1.5, opacity: 0.7 }} animate={{ scale: 0.55, opacity: 0 }} transition={{ duration: e.ttl / 1000, ease: 'linear' }}
                  style={{ position: 'absolute', inset: -7, borderRadius: '50%', border: `2px solid ${e.color}`, pointerEvents: 'none' }} />
              </>
            ) : (
              <BombVisual size={e.size} ttl={e.ttl} />
            )}
          </motion.div>
        ))}

        {/* WIN */}
        {phase === 'win' && (
          <Result tone="win">
            <motion.div animate={{ rotate: [0, -10, 10, -10, 8, 0], scale: [1, 1.25, 1] }} transition={{ duration: 0.6 }} style={{ marginBottom: 12, color: '#EAB308', display: 'flex', filter: 'drop-shadow(0 0 24px rgba(234,179,8,0.6))' }}><Icon name="trophy" size={62} strokeWidth={1.6} /></motion.div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#22C55E', marginBottom: 4 }}>Победа!</div>
            <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 22 }}>Поймал {score} {pluralDots(score)}</div>
            <div style={{ background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 16, padding: '14px 34px', marginBottom: 24, fontSize: 30, fontWeight: 900, color: '#EAB308', display: 'flex', alignItems: 'center', gap: 8 }}>+10 <Icon name="coins" size={28} /></div>
            <motion.button whileTap={{ scale: 0.96 }} onClick={claimReward} disabled={claiming}
              style={{ padding: '14px 44px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #EAB308, #ca8a04)', color: '#000', fontWeight: 900, fontSize: 15, cursor: 'pointer', opacity: claiming ? 0.6 : 1, boxShadow: '0 6px 24px rgba(234,179,8,0.45)' }}>
              {claiming ? '...' : 'Забрать монеты'}
            </motion.button>
          </Result>
        )}

        {/* LOSE */}
        {phase === 'lose' && (
          <Result tone="lose">
            <motion.div animate={{ x: [-8, 8, -8, 8, 0] }} transition={{ duration: 0.4 }} style={{ marginBottom: 12, color: '#EF4444', display: 'flex' }}><Icon name="skull" size={54} strokeWidth={1.6} /></motion.div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#EF4444', marginBottom: 6 }}>{score >= P.target ? 'Время вышло' : score === 0 ? 'Бабах!' : 'Не успел'}</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24, textAlign: 'center', maxWidth: 280 }}>
              Поймано {score}/{P.target}. {score < P.target ? 'Лови точки быстрее и не тапай бомбы!' : ''}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {plays < MAX_PLAYS && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={startGame} style={{ padding: '12px 30px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #22C55E, #16a34a)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>Ещё раз</motion.button>
              )}
              <motion.button whileTap={{ scale: 0.96 }} onClick={onClose} style={{ padding: '12px 26px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Закрыть</motion.button>
            </div>
          </Result>
        )}

        {/* LIMIT */}
        {phase === 'limit' && (
          <Result tone="lose">
            <div style={{ marginBottom: 12, color: '#EAB308', display: 'flex', justifyContent: 'center' }}><Icon name="timer" size={48} strokeWidth={1.6} /></div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Лимит на сегодня</div>
            <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>Ты уже сыграл {MAX_PLAYS} раз. Возвращайся завтра!</div>
            <button onClick={onClose} style={{ padding: '12px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>Закрыть</button>
          </Result>
        )}
      </motion.div>
    </motion.div>
  )
}

function Result({ tone, children }: { tone: 'win' | 'lose'; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, zIndex: 6, background: tone === 'win' ? 'radial-gradient(ellipse at center, rgba(34,197,94,0.08), transparent 70%)' : 'radial-gradient(ellipse at center, rgba(239,68,68,0.06), transparent 70%)' }}>
      {children}
    </motion.div>
  )
}

// Красивая бомба: тёмная сфера, блик, горящий фитиль с искрой, пульс-кольцо «опасно».
// Самодостаточный размер (size) — корректно рисуется и в игре, и в легенде.
function BombVisual({ size, ttl }: { size: number; ttl?: number }) {
  const fuseW = Math.max(2, size * 0.05)
  const sparkS = Math.max(5, size * 0.16)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* danger pulse */}
      <motion.div animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 0.9, repeat: Infinity }}
        style={{ position: 'absolute', inset: -5, borderRadius: '50%', border: '2px solid #EF4444', pointerEvents: 'none' }} />
      {/* sphere */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'radial-gradient(circle at 34% 30%, #4b5563, #111418 55%, #050608 100%)',
        border: '2px solid rgba(239,68,68,0.55)', boxShadow: '0 0 18px rgba(239,68,68,0.45), inset 0 -6px 12px rgba(0,0,0,0.7)' }} />
      {/* highlight */}
      <div style={{ position: 'absolute', top: '20%', left: '24%', width: '24%', height: '20%', borderRadius: '50%', background: 'rgba(255,255,255,0.45)', filter: 'blur(1.5px)' }} />
      {/* fuse */}
      <div style={{ position: 'absolute', bottom: '92%', left: '50%', width: fuseW, height: size * 0.26, background: '#9CA3AF', borderRadius: fuseW, transform: 'translateX(-50%) rotate(18deg)', transformOrigin: 'bottom' }} />
      {/* spark */}
      <motion.div animate={{ scale: [1, 1.5, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 0.35, repeat: Infinity }}
        style={{ position: 'absolute', bottom: '112%', left: '58%', width: sparkS, height: sparkS, borderRadius: '50%', background: 'radial-gradient(circle, #fff, #F59E0B 60%, transparent)', boxShadow: '0 0 10px #F59E0B, 0 0 4px #fff', transform: 'translateX(-50%)' }} />
      {ttl && (
        <motion.div initial={{ scale: 1.4, opacity: 0.4 }} animate={{ scale: 0.6, opacity: 0 }} transition={{ duration: ttl / 1000, ease: 'linear' }}
          style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: '2px solid rgba(239,68,68,0.5)', pointerEvents: 'none' }} />
      )}
    </div>
  )
}

const pluralDots = (n: number) => (n % 10 === 1 && n % 100 !== 11) ? 'точку' : 'точек'
