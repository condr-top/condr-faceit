'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from 'framer-motion'
import { api } from '@/lib/api'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { useAuthStore } from '@/store/authStore'

interface DailyMission {
  userMissionId: number; missionId: number
  title: string; description: string
  difficulty: 'easy' | 'medium' | 'hard'
  goal: number; rewardCoins: number; rewardXp: number
  progress: number; isCompleted: boolean; isClaimed: boolean
}

interface DailyData {
  missions: DailyMission[]
  allCompleted: boolean; bonusClaimed: boolean
  bonusCoins: number; bonusXp: number
  missionStreak: number; msUntilReset: number
}

const DIFF = {
  easy:   { label: 'Easy',   color: '#4ADE80', glow: 'rgba(74,222,128,0.3)',   icon: '⚡', rank: 1 },
  medium: { label: 'Medium', color: '#FACC15', glow: 'rgba(250,204,21,0.3)',   icon: '🔥', rank: 2 },
  hard:   { label: 'Hard',   color: '#F97316', glow: 'rgba(249,115,22,0.35)',  icon: '💀', rank: 3 },
}

const MILESTONES = [
  { days: 3,  icon: '🔥', reward: '+150🪙',  color: '#F97316' },
  { days: 7,  icon: '💎', reward: '+500🪙',  color: '#60A5FA' },
  { days: 14, icon: '👑', reward: '+1000🪙', color: '#FACC15' },
  { days: 30, icon: '🌟', reward: '+3000🪙', color: '#E8092E' },
]

function useCountdown(ms: number) {
  const [left, setLeft] = useState(ms)
  useEffect(() => { setLeft(ms); const t = setInterval(() => setLeft(p => Math.max(0, p - 1000)), 1000); return () => clearInterval(t) }, [ms])
  const h = Math.floor(left / 3_600_000), m = Math.floor((left % 3_600_000) / 60_000), s = Math.floor((left % 60_000) / 1000)
  return { h, m, s, str: `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` }
}

// ── Animated progress ring ────────────────────────────────────────────────────
function ProgressRing({ pct, color, size = 56 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2, circ = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <motion.circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - Math.min(pct / 100, 1)) }}
          transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 900, color,
      }}>
        {Math.round(Math.min(pct, 100))}%
      </div>
    </div>
  )
}

// ── Mission card ──────────────────────────────────────────────────────────────
function MissionCard({ m, idx, onClaim }: { m: DailyMission; idx: number; onClaim: () => void }) {
  const d = DIFF[m.difficulty]
  const pct = Math.min((m.progress / m.goal) * 100, 100)
  const cardRef = useRef<HTMLDivElement>(null)
  const [shine, setShine] = useState({ x: 50, y: 50 })
  const [claiming, setClaiming] = useState(false)

  const track = (cx: number, cy: number) => {
    const el = cardRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    setShine({ x: ((cx - r.left) / r.width) * 100, y: ((cy - r.top) / r.height) * 100 })
  }

  const handleClaim = async () => {
    setClaiming(true)
    try { await onClaim() } finally { setClaiming(false) }
  }

  const borderColor = m.isClaimed ? 'rgba(255,255,255,0.05)' : m.isCompleted ? `${d.color}55` : `${d.color}18`
  const bgColor     = m.isClaimed ? 'rgba(255,255,255,0.02)' : m.isCompleted ? `${d.color}08` : 'rgba(255,255,255,0.04)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07, type: 'spring', stiffness: 280, damping: 24 }}
      onMouseMove={e => track(e.clientX, e.clientY)}
      onTouchMove={e => { const t = e.touches[0]; track(t.clientX, t.clientY) }}
      style={{ opacity: m.isClaimed ? 0.5 : 1 }}
    >
      <div ref={cardRef} style={{
        borderRadius: 18, padding: '16px', position: 'relative', overflow: 'hidden',
        background: bgColor, border: `1px solid ${borderColor}`,
        boxShadow: m.isCompleted && !m.isClaimed ? `0 4px 24px ${d.glow}` : 'none',
        transition: 'box-shadow 0.3s',
      }}>
        {/* Tilt shine */}
        {!m.isClaimed && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 18,
            background: `radial-gradient(circle at ${shine.x}% ${shine.y}%, rgba(255,255,255,0.06) 0%, transparent 55%)`,
            transition: 'background 0.1s',
          }} />
        )}

        {/* Top glow strip */}
        {!m.isClaimed && (
          <div style={{
            position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
            background: `linear-gradient(90deg, transparent, ${m.isCompleted ? d.color : d.color + '66'}, transparent)`,
          }} />
        )}

        {/* Left accent bar */}
        {!m.isClaimed && (
          <div style={{
            position: 'absolute', left: 0, top: '15%', bottom: '15%', width: 3,
            borderRadius: '0 3px 3px 0',
            background: m.isCompleted
              ? `linear-gradient(180deg, ${d.color}, ${d.color}66)`
              : `linear-gradient(180deg, ${d.color}66, transparent)`,
            boxShadow: m.isCompleted ? `2px 0 10px ${d.glow}` : 'none',
          }} />
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, paddingLeft: 8 }}>
          {/* Progress ring */}
          <ProgressRing pct={pct} color={m.isClaimed ? '#4B5563' : d.color} size={52} />

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
              <span style={{
                fontSize: 9, fontWeight: 900, padding: '2px 8px', borderRadius: 20,
                background: `${d.color}18`, color: d.color,
                border: `1px solid ${d.color}30`,
                textTransform: 'uppercase', letterSpacing: '0.08em',
              }}>
                {d.icon} {d.label}
              </span>
              {m.isClaimed && (
                <span style={{ fontSize: 9, color: '#22C55E', fontWeight: 800, background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 20, border: '1px solid rgba(34,197,94,0.25)' }}>
                  ✓ Получено
                </span>
              )}
            </div>

            <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', marginBottom: 3, lineHeight: 1.2 }}>
              {m.title}
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4, marginBottom: 8 }}>
              {m.description}
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4B5563', marginBottom: 4 }}>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{m.progress} / {m.goal}</span>
                <span style={{ color: m.isCompleted ? d.color : '#4B5563', fontWeight: 700 }}>
                  {m.isCompleted ? '✓ Выполнено!' : `осталось ${m.goal - m.progress}`}
                </span>
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.15 + idx * 0.07 }}
                  style={{
                    height: '100%', borderRadius: 2,
                    background: m.isCompleted
                      ? `linear-gradient(90deg, ${d.color}, ${d.color}cc)`
                      : `linear-gradient(90deg, ${d.color}88, ${d.color})`,
                    boxShadow: m.isCompleted ? `0 0 8px ${d.glow}` : 'none',
                  }}
                />
              </div>
            </div>

            {/* Rewards */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#EAB308' }}>+{m.rewardCoins} 🪙</span>
              <span style={{ fontSize: 11, color: '#60A5FA' }}>+{m.rewardXp} XP</span>
            </div>
          </div>
        </div>

        {/* Claim button */}
        {m.isCompleted && !m.isClaimed && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileTap={{ scale: 0.96 }}
            onClick={handleClaim}
            disabled={claiming}
            style={{
              width: '100%', marginTop: 14,
              padding: '11px 0', borderRadius: 12, border: 'none',
              background: `linear-gradient(135deg, ${d.color}cc, ${d.color}88)`,
              color: '#000', fontWeight: 900, fontSize: 13,
              cursor: claiming ? 'default' : 'pointer',
              opacity: claiming ? 0.7 : 1,
              boxShadow: `0 3px 16px ${d.glow}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            {claiming ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#000' }}
              />
            ) : '🎁'} {claiming ? 'Получаем...' : 'Забрать награду'}
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// ── Bonus block ───────────────────────────────────────────────────────────────
function BonusBlock({ data, completedCount, onClaim }: { data: DailyData; completedCount: number; onClaim: () => void }) {
  const [claiming, setClaiming] = useState(false)
  const allDone = data.allCompleted && !data.bonusClaimed

  const handle = async () => {
    setClaiming(true)
    try { await onClaim() } finally { setClaiming(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28, type: 'spring', stiffness: 280, damping: 24 }}
      style={{
        borderRadius: 20, padding: '18px 16px', position: 'relative', overflow: 'hidden',
        background: allDone
          ? 'linear-gradient(135deg, rgba(232,9,46,0.12) 0%, rgba(168,85,247,0.08) 100%)'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${allDone ? 'rgba(232,9,46,0.35)' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: allDone ? '0 4px 32px rgba(232,9,46,0.15)' : 'none',
      }}
    >
      {allDone && (
        <>
          {/* Animated shimmer */}
          <motion.div
            animate={{ x: ['-100%', '200%'] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
            style={{
              position: 'absolute', top: 0, bottom: 0, width: '35%',
              background: 'linear-gradient(90deg, transparent, rgba(232,9,46,0.08), transparent)',
              pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(232,9,46,0.5), transparent)' }} />
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
            Ежедневный бонус
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
            {data.bonusClaimed ? '✅ Получен сегодня' : 'Выполни все 3 задания'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: '#EAB308' }}>+{data.bonusCoins} 🪙</span>
            <span style={{ fontSize: 13, color: '#60A5FA' }}>+{data.bonusXp} XP</span>
          </div>
          {data.bonusClaimed && data.missionStreak > 0 && (
            <div style={{ fontSize: 11, color: '#E8092E', marginTop: 6, fontWeight: 700 }}>
              🔥 Стрик: {data.missionStreak} дней подряд
            </div>
          )}
        </div>

        {/* 3-dot progress */}
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: allDone ? '#22C55E' : '#fff', marginBottom: 8 }}>
            {completedCount}/3
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[0,1,2].map(i => (
              <motion.div
                key={i}
                animate={i < completedCount && !data.bonusClaimed ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: i < completedCount
                    ? 'linear-gradient(135deg, #22C55E, #4ADE80)'
                    : 'rgba(255,255,255,0.08)',
                  boxShadow: i < completedCount ? '0 0 8px rgba(74,222,128,0.5)' : 'none',
                  transition: 'background 0.3s, box-shadow 0.3s',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {allDone && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handle}
          disabled={claiming}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
            background: 'linear-gradient(135deg, rgba(232,9,46,0.95), rgba(180,0,30,0.95))',
            color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer',
            boxShadow: '0 4px 24px rgba(232,9,46,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            opacity: claiming ? 0.7 : 1,
          }}
        >
          {claiming ? '...' : '🏆 Забрать дневной бонус'}
        </motion.button>
      )}
    </motion.div>
  )
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ coins, xp, label, onClose }: { coins: number; xp: number; label?: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 2800); return () => clearTimeout(t) }, [])
  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.85 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -30, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 350, damping: 28 }}
      style={{
        position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(6,6,8,0.98)', border: '1px solid rgba(74,222,128,0.4)',
        borderRadius: 18, padding: '16px 24px', zIndex: 999,
        textAlign: 'center', minWidth: 220,
        boxShadow: '0 8px 40px rgba(74,222,128,0.2)',
      }}
    >
      <motion.div
        animate={{ rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 0.5 }}
        style={{ fontSize: 32, marginBottom: 6 }}
      >🎉</motion.div>
      <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', marginBottom: 6 }}>Награда получена!</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
        <span style={{ fontSize: 15, color: '#EAB308', fontWeight: 800 }}>+{coins} 🪙</span>
        <span style={{ fontSize: 14, color: '#60A5FA', fontWeight: 700 }}>+{xp} XP</span>
      </div>
      {label && <div style={{ fontSize: 11, color: '#E8092E', marginTop: 6, fontWeight: 700 }}>{label}</div>}
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MissionsPage() {
  const { refreshUser } = useAuthStore()
  const [data, setData] = useState<DailyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ coins: number; xp: number; label?: string } | null>(null)
  const timer = useCountdown(data?.msUntilReset ?? 0)

  const load = async () => {
    try { const r = await api.get('/missions'); setData(r.data) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const claim = async (id: number) => {
    const r = await api.post(`/missions/${id}/claim`)
    setToast({ coins: r.data.coins, xp: r.data.xp })
    load(); refreshUser()
  }

  const claimBonus = async () => {
    const r = await api.post('/missions/daily-bonus')
    setToast({ coins: r.data.coins, xp: r.data.xp, label: r.data.streakReward?.label ?? `Стрик: ${r.data.missionStreak} дней 🔥` })
    load(); refreshUser()
  }

  const completedCount = data?.missions.filter(m => m.isCompleted).length ?? 0
  const streak = data?.missionStreak ?? 0

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 96 }}>
        <div style={{ padding: '0 16px', position: 'relative', zIndex: 1 }}>

          {/* ── HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{ paddingTop: 24, paddingBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                background: 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(74,222,128,0.12))',
                border: '1px solid rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>🎯</div>
              <div>
                <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.5px', lineHeight: 1 }}>
                  Задания
                </h1>
                <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
                  Обновление через <b style={{ color: '#6B7280' }}>{timer.str}</b>
                </div>
              </div>
            </div>

            {/* Streak badge */}
            {streak > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 400, damping: 20 }}
                style={{
                  background: 'rgba(232,9,46,0.1)', border: '1px solid rgba(232,9,46,0.3)',
                  borderRadius: 14, padding: '8px 14px', textAlign: 'center',
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ fontSize: 20, lineHeight: 1, marginBottom: 2 }}
                >🔥</motion.div>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#E8092E', lineHeight: 1 }}>{streak}</div>
                <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  ДНЕЙ
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* ── STREAK MILESTONES ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
              margin: '14px 0 16px',
            }}
          >
            {MILESTONES.map((ms, i) => {
              const reached = streak >= ms.days
              const isCurrent = streak >= ms.days - 1 && streak < ms.days
              return (
                <motion.div
                  key={ms.days}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.04 }}
                  style={{
                    borderRadius: 14, padding: '12px 8px', textAlign: 'center',
                    background: reached
                      ? `${ms.color}12`
                      : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${reached ? ms.color + '35' : 'rgba(255,255,255,0.06)'}`,
                    boxShadow: reached ? `0 0 16px ${ms.color}20` : 'none',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {reached && (
                    <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
                      background: `linear-gradient(90deg, transparent, ${ms.color}66, transparent)` }} />
                  )}
                  <motion.div
                    animate={reached ? { rotate: [0, -5, 5, 0] } : {}}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    style={{ fontSize: 22, filter: reached ? 'none' : 'grayscale(1) opacity(0.4)', marginBottom: 4 }}
                  >{ms.icon}</motion.div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: reached ? ms.color : '#374151', marginBottom: 2 }}>
                    {ms.days}д
                  </div>
                  <div style={{ fontSize: 9, color: reached ? ms.color + 'cc' : '#2D2D2D', fontWeight: 700 }}>
                    {ms.reward}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          {/* ── OVERALL PROGRESS ── */}
          {data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              style={{ marginBottom: 18 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Прогресс сегодня
                </span>
                <span style={{ fontSize: 13, fontWeight: 900, color: completedCount === 3 ? '#22C55E' : '#fff' }}>
                  {completedCount}/3
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(completedCount / 3) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                  style={{
                    height: '100%', borderRadius: 3,
                    background: completedCount === 3
                      ? 'linear-gradient(90deg, #16a34a, #22C55E, #4ADE80)'
                      : 'linear-gradient(90deg, #E8092E, #F97316)',
                    boxShadow: completedCount === 3
                      ? '0 0 10px rgba(74,222,128,0.5)'
                      : '0 0 8px rgba(232,9,46,0.4)',
                  }}
                />
              </div>
            </motion.div>
          )}

          {/* ── SECTION LABEL ── */}
          <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            Ежедневные задания
          </div>

          {/* ── MISSIONS ── */}
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[0,1,2].map(i => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.2 }}
                  style={{ height: 130, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
                />
              ))}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              {data?.missions.map((m, i) => (
                <MissionCard key={m.userMissionId} m={m} idx={i} onClaim={() => claim(m.userMissionId)} />
              ))}
            </div>
          )}

          {/* ── BONUS ── */}
          {data && !loading && (
            <BonusBlock data={data} completedCount={completedCount} onClaim={claimBonus} />
          )}

        </div>

        <AnimatePresence>
          {toast && <Toast coins={toast.coins} xp={toast.xp} label={toast.label} onClose={() => setToast(null)} />}
        </AnimatePresence>
      </div>
    </RequireRegistration>
  )
}
