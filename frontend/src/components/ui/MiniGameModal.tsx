'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'

interface Dot {
  id: number
  x: number   // percent
  y: number
  size: number
  color: string
  born: number
  ttl: number // ms to live
  hit: boolean
}

const COLORS = ['#E8092E', '#22C55E', '#F59E0B', '#A855F7', '#60A5FA', '#ec4899']
const MAX_PLAYS = 10

// difficulty level 0..9: more dots, less time per dot
function getDifficultyParams(level: number) {
  const dotCount = 1 + level           // 1..10
  const baseTTL  = 2400 - level * 150  // 2400ms..1050ms
  const timeLimit = dotCount * baseTTL + 800  // total round time
  return { dotCount, baseTTL, timeLimit }
}

interface Props {
  playsToday: number     // 0-based current plays done
  onClose: () => void
  onWin: (coins: number, newPlays: number) => void
}

type Phase = 'ready' | 'playing' | 'win' | 'lose' | 'limit'

export function MiniGameModal({ playsToday, onClose, onWin }: Props) {
  const { refreshUser } = useAuthStore()
  const { setHideNav } = useUiStore()

  useEffect(() => {
    setHideNav(true)
    return () => setHideNav(false)
  }, [])
  const level = Math.min(playsToday, 9)   // difficulty = plays already done
  const { dotCount, baseTTL, timeLimit } = getDifficultyParams(level)

  const [phase, setPhase] = useState<Phase>(playsToday >= MAX_PLAYS ? 'limit' : 'ready')
  const [dots, setDots] = useState<Dot[]>([])
  const [timeLeft, setTimeLeft] = useState(baseTTL)
  const [score, setScore] = useState(0)
  const [claiming, setClaiming] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startRef  = useRef(0)
  const idRef     = useRef(0)
  const spawnRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (spawnRef.current) clearTimeout(spawnRef.current)
  }, [])

  useEffect(() => () => cleanup(), [cleanup])

  const spawnDot = useCallback((delay = 0) => {
    spawnRef.current = setTimeout(() => {
      setDots(prev => {
        if (prev.length >= dotCount) return prev
        const dot: Dot = {
          id: ++idRef.current,
          x: 8 + Math.random() * 84,
          y: 10 + Math.random() * 70,
          size: 54 - level * 3,   // 54px..27px as level increases
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
          born: Date.now(),
          ttl: baseTTL,
          hit: false,
        }
        // schedule auto-expire
        setTimeout(() => {
          setDots(d => {
            const target = d.find(x => x.id === dot.id)
            if (target && !target.hit) {
              // missed — game over
              setPhase('lose')
              cleanup()
            }
            return d.filter(x => x.id !== dot.id)
          })
        }, baseTTL)
        return [...prev, dot]
      })
    }, delay)
  }, [dotCount, baseTTL, level, cleanup])

  const startGame = useCallback(() => {
    cleanup()
    idRef.current = 0
    setDots([])
    setScore(0)
    setTimeLeft(baseTTL)   // bar = dot lifetime
    startRef.current = Date.now()
    setPhase('playing')

    // Spawn dots with staggered delays
    for (let i = 0; i < dotCount; i++) {
      spawnDot(i * (baseTTL / dotCount) * 0.4)
    }

    // Bar drains over baseTTL — exactly matching dot lifetime
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current
      const left = Math.max(0, baseTTL - elapsed)
      setTimeLeft(left)
    }, 50)
  }, [cleanup, baseTTL, dotCount, spawnDot])

  const hitDot = useCallback((dotId: number) => {
    setDots(prev => {
      const updated = prev.map(d => d.id === dotId ? { ...d, hit: true } : d)
      const allHit = updated.every(d => d.hit)
      if (allHit && updated.length === dotCount) {
        setPhase('win')
        cleanup()
      }
      return updated.filter(d => !d.hit)
    })
    setScore(s => {
      const next = s + 1
      if (next >= dotCount) {
        setPhase('win')
        cleanup()
      }
      return next
    })
  }, [dotCount, cleanup])

  const claimReward = async () => {
    setClaiming(true)
    try {
      const res = await api.post('/users/mini-game/claim')
      await refreshUser()
      onWin(res.data.coins, res.data.playsToday)
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка')
    } finally {
      setClaiming(false)
    }
  }

  const progressPct = (timeLeft / baseTTL) * 100
  const isUrgent = progressPct < 30

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 8px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>🎯 Поймай точки</div>
          <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>
            Уровень {level + 1} · {playsToday}/{MAX_PLAYS} игр сегодня
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 22, cursor: 'pointer' }}>✕</button>
      </div>

      {/* Timer bar */}
      {phase === 'playing' && (
        <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', margin: '0' }}>
          <motion.div
            style={{
              height: '100%',
              background: isUrgent
                ? 'linear-gradient(90deg, #EF4444, #ff2d55)'
                : 'linear-gradient(90deg, #22C55E, #34D399)',
              width: `${progressPct}%`,
              transition: 'background 0.5s',
            }}
          />
        </div>
      )}

      {/* Game area */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* READY */}
        {phase === 'ready' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ fontSize: 56, marginBottom: 16 }}
            >🎯</motion.div>
            <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
              Уровень {level + 1}
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 8 }}>
              Тапни все <b style={{ color: '#fff' }}>{dotCount}</b> {dotCount === 1 ? 'точку' : 'точки'} прежде чем они исчезнут
            </div>
            <div style={{ fontSize: 11, color: '#374151', marginBottom: 28 }}>
              Точки живут ~{(baseTTL / 1000).toFixed(1)}с
            </div>

            {/* Difficulty dots */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
              {Array.from({ length: MAX_PLAYS }).map((_, i) => (
                <div key={i} style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: i < playsToday ? '#374151' : i === playsToday ? '#22C55E' : 'rgba(255,255,255,0.08)',
                  boxShadow: i === playsToday ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
                }} />
              ))}
            </div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={startGame}
              style={{
                padding: '14px 48px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #22C55E, #16a34a)',
                color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer',
                boxShadow: '0 4px 24px rgba(34,197,94,0.4)',
              }}
            >
              Начать!
            </motion.button>
            <div style={{ fontSize: 11, color: '#374151', marginTop: 12 }}>
              +10 🪙 за победу
            </div>
          </motion.div>
        )}

        {/* PLAYING — dots */}
        {phase === 'playing' && dots.map(dot => (
          <motion.button
            key={dot.id}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 18 }}
            onClick={() => hitDot(dot.id)}
            style={{
              position: 'absolute',
              left: `${dot.x}%`,
              top: `${dot.y}%`,
              width: dot.size, height: dot.size,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              background: `radial-gradient(circle at 35% 35%, ${dot.color}ff, ${dot.color}88)`,
              border: `3px solid ${dot.color}`,
              boxShadow: `0 0 20px ${dot.color}88, 0 0 8px ${dot.color}`,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {/* Shrink ring showing TTL */}
            <motion.div
              initial={{ scale: 1.4, opacity: 0.6 }}
              animate={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: dot.ttl / 1000, ease: 'linear' }}
              style={{
                position: 'absolute', inset: -6, borderRadius: '50%',
                border: `2px solid ${dot.color}`,
                pointerEvents: 'none',
              }}
            />
          </motion.button>
        ))}

        {/* WIN */}
        {phase === 'win' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.6 }}
              style={{ fontSize: 64, marginBottom: 12 }}
            >🏆</motion.div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#22C55E', marginBottom: 6 }}>Победа!</div>
            <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>Все точки пойманы</div>
            <div style={{
              background: 'rgba(234,179,8,0.12)', border: '1px solid rgba(234,179,8,0.3)',
              borderRadius: 14, padding: '14px 32px', marginBottom: 24,
              fontSize: 28, fontWeight: 900, color: '#EAB308',
            }}>
              +10 🪙
            </div>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={claimReward}
              disabled={claiming}
              style={{
                padding: '13px 40px', borderRadius: 14, border: 'none',
                background: 'linear-gradient(135deg, #EAB308, #ca8a04)',
                color: '#000', fontWeight: 900, fontSize: 15, cursor: 'pointer',
                opacity: claiming ? 0.6 : 1,
                boxShadow: '0 4px 20px rgba(234,179,8,0.4)',
              }}
            >
              {claiming ? '...' : 'Забрать монеты'}
            </motion.button>
          </motion.div>
        )}

        {/* LOSE */}
        {phase === 'lose' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          >
            <motion.div
              animate={{ x: [-8, 8, -8, 8, 0] }}
              transition={{ duration: 0.4 }}
              style={{ fontSize: 56, marginBottom: 12 }}
            >💀</motion.div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#EF4444', marginBottom: 6 }}>Промах!</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 28 }}>
              Точка исчезла раньше чем ты успел
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {playsToday < MAX_PLAYS && (
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={startGame}
                  style={{
                    padding: '12px 28px', borderRadius: 12, border: 'none',
                    background: 'linear-gradient(135deg, #22C55E, #16a34a)',
                    color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  }}
                >
                  Ещё раз
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={onClose}
                style={{
                  padding: '12px 24px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#6B7280', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                }}
              >
                Закрыть
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* LIMIT */}
        {phase === 'limit' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          >
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏰</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 8 }}>Лимит на сегодня</div>
            <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center', marginBottom: 24 }}>
              Ты уже сыграл {MAX_PLAYS} раз. Возвращайся завтра!
            </div>
            <button onClick={onClose} style={{ padding: '12px 28px', borderRadius: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
              Закрыть
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}
