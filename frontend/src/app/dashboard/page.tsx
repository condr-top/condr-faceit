'use client'

import { useEffect, useState, useCallback, useRef } from 'react' // useRef kept for TiltCard
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { EloRing } from '@/components/ui/EloRing'
import { useQueueStore } from '@/store/queueStore'
import { DailyRewardModal } from '@/components/ui/DailyRewardModal'
import { CoinPurchaseModal } from '@/components/coins/CoinPurchaseModal'
import { MiniGameModal } from '@/components/ui/MiniGameModal'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'
import { getEloRank } from '@/lib/eloRank'
import { Avatar } from '@/components/ui/Avatar'
import { Flag } from '@/components/ui/Flag'
import { playQueueJoin, playQueueLeave, playMatchFound } from '@/lib/sounds'
import { useUiStore } from '@/store/uiStore'

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 })
  const [display, setDisplay] = useState(0)

  useEffect(() => { mv.set(value) }, [value])
  useEffect(() => spring.on('change', v => setDisplay(Math.round(v))), [spring])

  return <>{display.toLocaleString()}</>
}

// ── Tilt card ─────────────────────────────────────────────────────────────────
function TiltCard({
  icon, label, sub, color, glow, delay, onClick,
}: {
  icon: string; label: string; sub: string; href: string
  color: string; glow: string; delay: number; onClick: () => void
}) {
  const cardRef  = useRef<HTMLButtonElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number>(0)

  const track = (clientX: number, clientY: number) => {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      const el = cardRef.current
      const sh = shineRef.current
      if (!el || !sh) return
      const rect = el.getBoundingClientRect()
      const x = (clientX - rect.left) / rect.width   // 0..1
      const y = (clientY - rect.top)  / rect.height  // 0..1
      const rx = (0.5 - y) * 18
      const ry = (x - 0.5) * 18
      el.style.transform = `perspective(600px) rotateX(${rx}deg) rotateY(${ry}deg) scale(1.02)`
      sh.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.2) 0%, transparent 55%)`
    })
  }

  const reset = () => {
    cancelAnimationFrame(frameRef.current)
    const el = cardRef.current
    const sh = shineRef.current
    if (!el || !sh) return
    el.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)'
    sh.style.background = 'none'
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
      onMouseMove={e => track(e.clientX, e.clientY)}
      onMouseLeave={reset}
      onTouchMove={e => { const t = e.touches[0]; track(t.clientX, t.clientY) }}
      onTouchEnd={reset}
    >
      <button
        ref={cardRef}
        onClick={onClick}
        style={{
          width: '100%', borderRadius: 14,
          border: `1px solid ${color}25`,
          background: glow,
          padding: '14px 12px',
          cursor: 'pointer', textAlign: 'left',
          position: 'relative', overflow: 'hidden',
          transition: 'transform 0.15s ease',
          willChange: 'transform',
        }}
      >
        <div ref={shineRef} style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 14,
          transition: 'background 0.08s',
        }} />

        <div style={{
          position: 'absolute', top: -16, right: -8, fontSize: 54, opacity: 0.07,
          lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
        }}>{icon}</div>

        <div style={{ fontSize: 26, marginBottom: 8, position: 'relative' }}>{icon}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', position: 'relative' }}>{label}</div>
        <div style={{ fontSize: 10, color, fontWeight: 600, opacity: 0.75, marginTop: 2, position: 'relative' }}>{sub}</div>
      </button>
    </motion.div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value, color, delay = 0 }: {
  label: string; value: string | number; color: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}22`,
        borderRadius: 12,
        padding: '10px 6px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* glow strip */}
      <div style={{
        position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
        background: `linear-gradient(90deg, transparent, ${color}88, transparent)`,
      }} />
      <div style={{ fontSize: 16, fontWeight: 900, color, letterSpacing: '-0.5px', lineHeight: 1 }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
    </motion.div>
  )
}

// ── Cooldown banner ───────────────────────────────────────────────────────────
function CooldownBanner({ until }: { until: Date }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    const update = () => {
      const ms = until.getTime() - Date.now()
      if (ms <= 0) { setRemaining(''); return }
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setRemaining(m > 0 ? `${m}:${String(s).padStart(2,'0')}` : `${s}с`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [until])
  if (!remaining) return null
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      style={{
        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)',
        borderRadius: 10, padding: '10px 14px', marginBottom: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}
    >
      <span style={{ fontSize: 16 }}>⏱️</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#EF4444' }}>Кулдаун активен</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>Поиск заблокирован ещё {remaining}</div>
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#EF4444', fontVariantNumeric: 'tabular-nums' }}>
        {remaining}
      </div>
    </motion.div>
  )
}

interface LobbyInfo {
  matchId: number
  players: { id: number; name: string }[]
  slots: number
  filled: number
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user, refreshUser } = useAuthStore()
  const { inQueue, queueSize, fetchStatus, joinQueue, leaveQueue } = useQueueStore()
  const [queueLoading, setQueueLoading]   = useState(false)
  const [lobbyLoading, setLobbyLoading]   = useState(false)
  const [showDailyReward, setShowDailyReward] = useState(false)
  const [dailyReward, setDailyReward]         = useState<any>(null)
  const [showCoinPurchase, setShowCoinPurchase] = useState(false)
  const [showCoinMenu, setShowCoinMenu] = useState(false)
  const [showMiniGame, setShowMiniGame] = useState(false)
  const { setHideNav } = useUiStore()

  const openCoinMenu  = () => { setShowCoinMenu(true);  setHideNav(true) }
  const closeCoinMenu = () => { setShowCoinMenu(false); setHideNav(false) }
  const [myRank, setMyRank]     = useState<number | null>(null)
  const [lobby, setLobby]       = useState<LobbyInfo | null>(null)
  const router = useRouter()

  useEffect(() => {
    refreshUser()
    claimDailyReward()
    fetchStatus()
    api.get('/leaderboard/rank').then(r => setMyRank(r.data)).catch(() => {})
    const socket = connectSocket()
    socket.on('queue_update', (d: { size: number }) => useQueueStore.setState({ queueSize: d.size }))
    socket.on('match_found',  (d: { matchId: number }) => { useQueueStore.setState({ inQueue: false }); playMatchFound(); router.push(`/match/${d.matchId}`) })
    return () => { socket.off('queue_update'); socket.off('match_found') }
  }, [])

  const fetchLobby = useCallback(() => {
    api.get('/matches/lobby').then(r => {
      const data: LobbyInfo | null = r.data
      setLobby(data)
      if (data?.matchId && data.players?.some(p => p.id === user?.id) && data.filled >= data.slots)
        router.push(`/match/${data.matchId}`)
    }).catch(() => {})
  }, [user?.id, router])

  useEffect(() => { fetchLobby(); const t = setInterval(fetchLobby, 3000); return () => clearInterval(t) }, [fetchLobby])

  const claimDailyReward = async () => {
    try {
      const res = await api.post('/users/daily-reward')
      if (!res.data.alreadyClaimed) { setDailyReward(res.data); setShowDailyReward(true) }
    } catch {}
  }

  const findOrCreateLobby = async () => {
    setLobbyLoading(true)
    playQueueJoin()
    try { const res = await api.post('/matches/lobby/join'); router.push(`/match/${res.data.id}`) }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setLobbyLoading(false) }
  }

  const leaveLobby = async () => { await api.post('/matches/lobby/leave').catch(() => {}); setLobby(null); fetchLobby() }

  if (!user) return null

  const rank      = getEloRank(user.elo)
  const isOnCooldown = user.cooldownUntil && new Date(user.cooldownUntil) > new Date()
  const isChallenger = myRank !== null && myRank <= 5

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', overflowX: 'hidden', paddingBottom: 88 }}>
        <div style={{ padding: '0 16px' }}>

          {/* ── TOP BAR ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 8 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Avatar with rank glow */}
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => router.push('/profile')}
                style={{ position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
              >
                {/* Animated rank-color ring */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                  style={{
                    position: 'absolute', inset: -2, borderRadius: '50%',
                    background: `conic-gradient(${rank.color}, transparent 60%, ${rank.color})`,
                    opacity: 0.7,
                  }}
                />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <Avatar
                    avatarUrl={user.avatarUrl}
                    name={user.gameNickname || user.firstName}
                    size={56}
                    style={{ border: `2px solid ${rank.color}40`, borderRadius: '50%' }}
                  />
                </div>
                {/* ELO rank level pip */}
                <div style={{
                  position: 'absolute', bottom: -2, right: -2, zIndex: 2,
                  background: '#060608', border: `1px solid ${rank.color}60`,
                  borderRadius: 10, padding: '1px 5px',
                  fontSize: 8, fontWeight: 900, color: rank.color,
                }}>
                  {rank.level}
                </div>
              </motion.button>

              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <div style={{
                  fontSize: (user.gameNickname || user.firstName).length > 10 ? 12 : 15,
                  fontWeight: 900, color: '#fff', letterSpacing: '-0.3px', lineHeight: 1.1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {user.region && <Flag code={user.region} size={12} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.gameNickname || user.firstName}</span>
                </div>
                <div style={{ fontSize: 10, color: '#4B5563', fontWeight: 600 }}>
                  {user.username ? `@${user.username}` : `Уровень ${user.level}`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NotificationBell />
              {/* XP ring in top bar */}
              {(() => {
                const xpForNext = Math.pow(user.level, 2) * 100
                const pct = (user.xp % xpForNext) / xpForNext
                const r = 22, circ = 2 * Math.PI * r
                return (
                  <div style={{ position: 'relative', width: 52, height: 52 }}>
                    <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="26" cy="26" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3.5" />
                      <motion.circle
                        cx="26" cy="26" r={r} fill="none"
                        stroke="url(#xpGradTop)" strokeWidth="3.5"
                        strokeLinecap="round"
                        strokeDasharray={circ}
                        initial={{ strokeDashoffset: circ }}
                        animate={{ strokeDashoffset: circ * (1 - pct) }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                      />
                      <defs>
                        <linearGradient id="xpGradTop" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#6366f1" />
                          <stop offset="100%" stopColor="#A855F7" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{user.level}</div>
                      <div style={{ fontSize: 7, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase' }}>lvl</div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </motion.div>

          {/* ── HERO CARD ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 26 }}
            style={{
              borderRadius: 20,
              marginBottom: 14,
              overflow: 'hidden',
              position: 'relative',
              background: 'linear-gradient(135deg, rgba(232,9,46,0.12) 0%, rgba(15,15,20,0.95) 50%, rgba(168,85,247,0.08) 100%)',
              border: '1px solid rgba(232,9,46,0.2)',
              padding: '20px 18px',
            }}
          >

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 11, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  Текущий рейтинг
                </div>
                <div style={{ fontSize: 42, fontWeight: 900, color: '#fff', letterSpacing: '-2px', lineHeight: 1 }}>
                  <AnimatedNumber value={user.elo} duration={1.5} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    background: `${rank.color}18`, color: rank.color,
                    border: `1px solid ${rank.color}40`, letterSpacing: '0.04em',
                  }}>
                    {rank.label}
                  </span>
                  {myRank && (
                    <span style={{ fontSize: 11, color: '#4B5563', fontWeight: 600 }}>
                      #{myRank} в рейтинге
                    </span>
                  )}
                </div>
              </div>

              {/* EloRing in hero card */}
              <div style={{ textAlign: 'center' }}>
                <EloRing elo={user.elo} size={72} isChallenger={isChallenger} />
              </div>
            </div>

            {/* Calibration notice */}
            {user.matchesPlayed < 10 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                style={{
                  marginTop: 12, padding: '7px 10px', borderRadius: 8,
                  background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#C084FC',
                }}
              >
                <span>🎯</span>
                <span>Калибровка: {user.matchesPlayed}/10 матчей · Win <b>+80</b> / Loss <b>−40</b> ELO</span>
              </motion.div>
            )}
          </motion.div>

          {/* ── STATS ROW ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <StatChip label="Матчи"   value={user.matchesPlayed}          color="#60A5FA" delay={0.1} />
            <StatChip label="Винрейт" value={`${user.winRate}%`}          color="#22C55E" delay={0.15} />
            <StatChip label="K/D"     value={Number(user.kdr).toFixed(2)} color="#F59E0B" delay={0.2} />
          </div>

          {/* ── COINS BAR ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.23 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.18)',
              borderRadius: 14, padding: '10px 16px', marginBottom: 14,
              position: 'relative', overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>🪙</span>
              <div>
                <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', lineHeight: 1, marginBottom: 2 }}>
                  Монеты
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#EAB308', letterSpacing: '-0.5px', lineHeight: 1 }}>
                  <AnimatedNumber value={user.coins} />
                </div>
              </div>
            </div>
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={openCoinMenu}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'linear-gradient(135deg, #EAB308, #ca8a04)',
                border: 'none', borderRadius: 10, padding: '8px 16px',
                color: '#000', fontWeight: 900, fontSize: 13, cursor: 'pointer',
                boxShadow: '0 2px 12px rgba(234,179,8,0.4)',
              }}
            >
              🪙 Получить
            </motion.button>
          </motion.div>

          {/* ── COOLDOWN ── */}
          {isOnCooldown && <CooldownBanner until={new Date(user.cooldownUntil!)} />}

          {/* ── FIND MATCH 5v5 ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, type: 'spring', stiffness: 260, damping: 24 }}
            style={{ marginBottom: 10 }}
          >
            <AnimatePresence mode="wait">
              {inQueue ? (
                <motion.div
                  key="q5-on"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  style={{
                    borderRadius: 16,
                    background: 'rgba(232,9,46,0.06)',
                    border: '1px solid rgba(232,9,46,0.35)',
                    padding: '14px 16px',
                    overflow: 'hidden', position: 'relative',
                  }}
                >
                  {/* Animated search sweep */}
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      position: 'absolute', top: 0, bottom: 0, width: '40%',
                      background: 'linear-gradient(90deg, transparent, rgba(232,9,46,0.08), transparent)',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <motion.div
                      animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8092E', flexShrink: 0 }}
                    />
                    <span style={{ fontWeight: 800, fontSize: 13, flex: 1 }}>⚔️ Поиск матча 5v5</span>
                    <span style={{ fontSize: 12, color: '#E8092E', fontWeight: 800 }}>{queueSize}/10</span>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <motion.div
                        key={i}
                        animate={i < queueSize ? { opacity: [0.7, 1, 0.7] } : {}}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.1 }}
                        style={{
                          flex: 1, height: 5, borderRadius: 3,
                          background: i < queueSize ? '#E8092E' : 'rgba(255,255,255,0.07)',
                          boxShadow: i < queueSize ? '0 0 6px rgba(232,9,46,0.6)' : 'none',
                          transition: 'background 0.3s',
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#4B5563', alignSelf: 'center' }}>Ожидаем игроков...</span>
                    <button
                      onClick={async () => { setQueueLoading(true); playQueueLeave(); try { await leaveQueue() } finally { setQueueLoading(false) } }}
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '6px 14px', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}
                    >
                      Выйти
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="q5-off"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={queueLoading || !!isOnCooldown}
                  onClick={async () => {
                    setQueueLoading(true)
                    try { playQueueJoin(); await joinQueue() }
                    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
                    finally { setQueueLoading(false) }
                  }}
                  style={{
                    width: '100%', borderRadius: 16, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(232,9,46,0.9) 0%, rgba(180,0,30,0.95) 100%)',
                    padding: '18px 0', position: 'relative', overflow: 'hidden',
                    boxShadow: isOnCooldown ? 'none' : '0 4px 32px rgba(232,9,46,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
                    opacity: (queueLoading || !!isOnCooldown) ? 0.5 : 1,
                  }}
                >
                  {/* Shimmer */}
                  {!isOnCooldown && (
                    <motion.div
                      animate={{ x: ['-100%', '200%'] }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3 }}
                      style={{
                        position: 'absolute', top: 0, bottom: 0, width: '35%',
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                        pointerEvents: 'none',
                      }}
                    />
                  )}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>⚔️</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: '#fff', letterSpacing: '0.02em' }}>
                        {queueLoading ? 'Подключаемся...' : 'Найти матч 5v5'}
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: 600, marginTop: 1 }}>
                        Рейтинговый · {queueSize} в очереди
                      </div>
                    </div>
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── FIND MATCH 2v2 ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, type: 'spring', stiffness: 260, damping: 24 }}
            style={{ marginBottom: 18 }}
          >
            <AnimatePresence mode="wait">
              {lobby ? (
                <motion.div
                  key="l2-on"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  style={{
                    borderRadius: 16,
                    background: 'rgba(168,85,247,0.06)',
                    border: '1px solid rgba(168,85,247,0.3)',
                    padding: '14px 16px', position: 'relative', overflow: 'hidden',
                  }}
                >
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      position: 'absolute', top: 0, bottom: 0, width: '40%',
                      background: 'linear-gradient(90deg, transparent, rgba(168,85,247,0.07), transparent)',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>⚡ Очередь 2v2</span>
                    <span style={{ fontSize: 12, color: '#A855F7', fontWeight: 800 }}>{lobby.filled}/{lobby.slots}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    {Array.from({ length: lobby.slots ?? 4 }).map((_, i) => {
                      const p = lobby.players?.[i]
                      const isMe = p?.id === user.id
                      return (
                        <div key={i} style={{
                          flex: 1, padding: '8px 4px', borderRadius: 8, textAlign: 'center',
                          fontSize: 11, fontWeight: 700,
                          background: p ? isMe ? 'rgba(232,9,46,0.2)' : 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
                          color: p ? isMe ? '#F87171' : '#C084FC' : '#2D2D2D',
                          border: p ? isMe ? '1px solid rgba(232,9,46,0.35)' : '1px solid rgba(168,85,247,0.25)' : '1px dashed rgba(255,255,255,0.06)',
                        }}>
                          {p ? (isMe ? 'Ты' : p.name.slice(0, 6)) : '—'}
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => router.push(`/match/${lobby.matchId}`)}
                      style={{
                        flex: 1, background: 'linear-gradient(135deg, #7c3aed, #A855F7)',
                        border: 'none', borderRadius: 10, padding: '10px 0',
                        color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                        boxShadow: '0 2px 16px rgba(168,85,247,0.3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                      Вернуться
                    </button>
                    <button
                      onClick={leaveLobby}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '10px 14px', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}
                    >✕</button>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="l2-off"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={lobbyLoading || !!isOnCooldown}
                  onClick={findOrCreateLobby}
                  style={{
                    width: '100%', borderRadius: 16, border: '1px solid rgba(168,85,247,0.3)',
                    cursor: 'pointer', padding: '16px 0', position: 'relative', overflow: 'hidden',
                    background: 'rgba(168,85,247,0.07)',
                    opacity: (lobbyLoading || !!isOnCooldown) ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>⚡</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#C084FC' }}>
                        {lobbyLoading ? 'Подключаемся...' : 'Найти матч 2v2'}
                      </div>
                      <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginTop: 1 }}>
                        Быстрый · без ожидания
                      </div>
                    </div>
                  </div>
                </motion.button>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── QUICK LINKS ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Разделы
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: '🏆', label: 'Рейтинг',  sub: 'Топ игроков',   href: '/leaderboard', color: '#F59E0B', glow: 'rgba(245,158,11,0.12)'  },
                { icon: '🎯', label: 'Задания',   sub: 'Ежедневные',    href: '/missions',    color: '#22C55E', glow: 'rgba(34,197,94,0.12)'   },
                { icon: '🛒', label: 'Магазин',   sub: 'Варны и скины', href: '/shop',        color: '#A855F7', glow: 'rgba(168,85,247,0.12)'  },
                { icon: '💬', label: 'Поддержка', sub: 'Помощь · FAQ',  href: '/support',     color: '#60A5FA', glow: 'rgba(96,165,250,0.12)'  },
              ].map((item, i) => (
                <TiltCard
                  key={item.href}
                  {...item}
                  delay={0.32 + i * 0.05}
                  onClick={() => router.push(item.href)}
                />
              ))}
            </div>
          </motion.div>

        </div>
      </div>

      {showDailyReward && dailyReward && (
        <DailyRewardModal reward={dailyReward} onClose={() => setShowDailyReward(false)} />
      )}

      {/* Coin purchase modal */}
      {showCoinPurchase && (
        <CoinPurchaseModal onClose={() => setShowCoinPurchase(false)} />
      )}

      {/* Mini-game modal */}
      <AnimatePresence>
        {showMiniGame && (
          <MiniGameModal
            playsToday={user.miniGamePlaysToday ?? 0}
            onClose={() => setShowMiniGame(false)}
            onWin={(coins, newPlays) => {
              setShowMiniGame(false)
              refreshUser()
            }}
          />
        )}
      </AnimatePresence>

      {/* Coin menu — choose buy or play */}
      <AnimatePresence>
        {showCoinMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 55,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
            }}
            onClick={closeCoinMenu}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 480,
                background: 'rgba(14,14,18,0.98)',
                backdropFilter: 'blur(24px)',
                borderRadius: '24px 24px 0 0',
                border: '1px solid rgba(255,255,255,0.07)',
                borderBottom: 'none',
                padding: '20px 20px 40px',
              }}
            >
              <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 20px' }} />
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4, textAlign: 'center' }}>Получить монеты</div>
              <div style={{ fontSize: 12, color: '#4B5563', textAlign: 'center', marginBottom: 20 }}>
                Текущий баланс: <b style={{ color: '#EAB308' }}>🪙 {user.coins}</b>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {/* Buy */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { closeCoinMenu(); setShowCoinPurchase(true) }}
                  style={{
                    padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(202,138,4,0.1))',
                    border: '1px solid rgba(234,179,8,0.3)',
                    display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  } as any}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #EAB308, #ca8a04)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>💳</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 2 }}>Купить за рубли</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>1 ₽ = 10 монет · от 10 ₽</div>
                  </div>
                  <div style={{ marginLeft: 'auto', color: '#4B5563', fontSize: 18 }}>›</div>
                </motion.button>

                {/* Mini-game */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { closeCoinMenu(); setShowMiniGame(true) }}
                  style={{
                    padding: '16px', borderRadius: 16, border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.07))',
                    border: '1px solid rgba(34,197,94,0.25)',
                    display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left',
                  } as any}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, #22C55E, #16a34a)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>🎯</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 2 }}>Сыграть и заработать</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      +10 🪙 за победу · {Math.max(0, 10 - (user.miniGamePlaysToday ?? 0))}/10 попыток осталось
                    </div>
                  </div>
                  {(user.miniGamePlaysToday ?? 0) < 10 ? (
                    <div style={{
                      background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)',
                      borderRadius: 20, padding: '2px 8px',
                      fontSize: 10, fontWeight: 800, color: '#22C55E', whiteSpace: 'nowrap',
                    }}>
                      БЕСПЛАТНО
                    </div>
                  ) : (
                    <div style={{ fontSize: 10, color: '#374151', fontWeight: 700 }}>завтра</div>
                  )}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </RequireRegistration>
  )
}
