'use client'

import { useEffect, useState, useCallback, useRef } from 'react' // useRef kept for TiltCard
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { EloRing } from '@/components/ui/EloRing'
import { useQueueStore } from '@/store/queueStore'
import { CoinPurchaseModal } from '@/components/coins/CoinPurchaseModal'
import { MiniGameModal } from '@/components/ui/MiniGameModal'
import { NotificationBell } from '@/components/notifications/NotificationBell'
import { PartyPanel, PartyDto, Invitation } from '@/components/party/PartyPanel'
import { api } from '@/lib/api'
import { getCached, setCached } from '@/lib/cache'
import { connectSocket } from '@/lib/socket'
import { getEloRank, getRankProgress, ELO_RANKS, CHALLENGER_RANK, qualifiesChallenger } from '@/lib/eloRank'
import { Avatar } from '@/components/ui/Avatar'
import { Flag } from '@/components/ui/Flag'
import { Logo } from '@/components/ui/Logo'
import { Icon, IconName } from '@/components/ui/Icon'
import { playQueueJoin, playQueueLeave, playMatchFound } from '@/lib/sounds'
import { useUiStore } from '@/store/uiStore'
import { useSheetDrag } from '@/lib/useSheetDrag'

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
  icon: IconName; label: string; sub: string; href: string
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
      whileTap={{ scale: 0.96 }}
      onMouseMove={e => track(e.clientX, e.clientY)}
      onMouseLeave={reset}
    >
      <button
        ref={cardRef}
        onClick={onClick}
        style={{
          width: '100%', borderRadius: 16,
          border: `1px solid ${color}2a`,
          background: `radial-gradient(120% 120% at 0% 0%, ${color}12, transparent 55%), #0f0f15`,
          padding: '14px 12px',
          cursor: 'pointer', textAlign: 'left',
          position: 'relative', overflow: 'hidden',
          transition: 'transform 0.15s ease',
          willChange: 'transform',
          backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
        }}
      >
        {/* accent corner glow */}
        <div style={{ position: 'absolute', top: -30, right: -30, width: 90, height: 90, background: `radial-gradient(circle, ${color}26, transparent 70%)`, pointerEvents: 'none' }} />
        {/* top accent line */}
        <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: 1, background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }} />
        <div ref={shineRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 16, transition: 'background 0.08s' }} />

        <div style={{ position: 'absolute', top: -14, right: -10, opacity: 0.10, lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}><Icon name={icon} size={58} color={color} /></div>

        <div style={{
          width: 38, height: 38, borderRadius: 11, marginBottom: 10, position: 'relative',
          background: `${color}16`, border: `1px solid ${color}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}><Icon name={icon} size={20} color={color} /></div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', position: 'relative' }}>{label}</div>
        <div style={{ fontSize: 10, color, fontWeight: 600, opacity: 0.75, marginTop: 2, position: 'relative' }}>{sub}</div>
      </button>
    </motion.div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value, color, icon, delay = 0, valueColor }: {
  label: string; value: string | number; color: string; icon: IconName; delay?: number; valueColor?: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: '#0f0f15',
        border: `1px solid ${color}26`,
        borderRadius: 14,
        padding: '12px 8px 10px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '18%', right: '18%', height: 1, background: `linear-gradient(90deg, transparent, ${color}aa, transparent)` }} />
      <div style={{ position: 'absolute', top: -8, right: -6, opacity: 0.08, pointerEvents: 'none' }}>
        <Icon name={icon} size={42} color={color} />
      </div>
      <div style={{ marginBottom: 5, display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <Icon name={icon} size={15} color={color} />
      </div>
      <div style={{ fontSize: 17, fontWeight: 900, color: valueColor ?? color, letterSpacing: '-0.5px', lineHeight: 1, position: 'relative' }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.06em', position: 'relative' }}>
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
      <Icon name="timer" size={18} color="#EF4444" />
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
  const [showCoinPurchase, setShowCoinPurchase] = useState(false)
  const [showCoinMenu, setShowCoinMenu] = useState(false)
  const [showMiniGame, setShowMiniGame] = useState(false)
  const { setHideNav } = useUiStore()

  const openCoinMenu  = () => { setShowCoinMenu(true);  setHideNav(true) }
  const closeCoinMenu = () => { setShowCoinMenu(false); setHideNav(false) }
  const coinSheet = useSheetDrag(closeCoinMenu)
  const [myRank, setMyRank]     = useState<number | null>(() => getCached<number>('leaderboard-rank'))
  const [lobby, setLobby]       = useState<LobbyInfo | null>(null)
  const [party, setParty]       = useState<PartyDto | null>(null)
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [mode, setMode]         = useState<'normal' | 'cplq' | 'cpl'>('normal')
  const router = useRouter()

  const loadParty = useCallback(() => {
    api.get('/party').then(r => { setParty(r.data?.party ?? null); setInvitations(r.data?.invitations ?? []) }).catch(() => {})
  }, [])

  useEffect(() => {
    refreshUser()
    fetchStatus()
    api.get('/leaderboard/rank').then(r => { setMyRank(r.data); setCached('leaderboard-rank', r.data) }).catch(() => {})
    loadParty()
    const socket = connectSocket()
    socket.on('queue_update', (d: { size: number }) => useQueueStore.setState({ queueSize: d.size }))
    socket.on('match_found',  (d: { matchId: number }) => { useQueueStore.setState({ inQueue: false }); playMatchFound(); router.push(`/match/${d.matchId}`) })
    socket.on('party_updated', () => loadParty())
    socket.on('party_invite',  () => loadParty())
    return () => { socket.off('queue_update'); socket.off('match_found'); socket.off('party_updated'); socket.off('party_invite') }
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

  // Если доступ к выбранной лиге пропал (вылет/снятие) — откатываемся к обычному режиму
  useEffect(() => {
    if ((mode === 'cpl' && !user?.cplAccess) || (mode === 'cplq' && !user?.cplqAccess)) setMode('normal')
  }, [user?.cplAccess, user?.cplqAccess, mode])

  const findOrCreateLobby = async () => {
    // Отряд работает только в обычном режиме
    if (mode === 'normal' && party && party.members.length >= 2) {
      if (!party.isLeader) { alert('Поиск запускает лидер отряда'); return }
      setLobbyLoading(true)
      playQueueJoin()
      try { const res = await api.post('/party/queue'); router.push(`/match/${res.data.matchId}`) }
      catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setLobbyLoading(false) }
      return
    }
    setLobbyLoading(true)
    playQueueJoin()
    try {
      const body = mode === 'normal' ? {} : { league: mode }
      const res = await api.post('/matches/lobby/join', body)
      router.push(`/match/${res.data.id}`)
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setLobbyLoading(false) }
  }

  const leaveLobby = async () => { await api.post('/matches/lobby/leave').catch(() => {}); setLobby(null); fetchLobby() }

  if (!user) return null

  const rank      = getEloRank(user.elo)
  const calibrating = (user.matchesPlayed ?? 0) < 10
  const isOnCooldown = user.cooldownUntil && new Date(user.cooldownUntil) > new Date()
  const isChallenger = !calibrating && qualifiesChallenger(user.elo, myRank)
  const theme     = isChallenger ? CHALLENGER_RANK : rank
  // Во время калибровки тема — жёлтая (ранг скрыт)
  const accent    = calibrating ? '#EAB308' : theme.color
  const nextRank  = ELO_RANKS.find(r => r.min > user.elo) || null
  const eloToNext = nextRank ? nextRank.min - user.elo : 0
  const isMaxRank = rank.max === Infinity
  const segPct = isMaxRank ? 100 : Math.round(getRankProgress(user.elo) * 100)
  const GREEN = '#22C55E', YELLOW = '#EAB308', RED = '#EF4444'
  const kdNum   = Number(user.kdr ?? 0)
  const kdColor = kdNum > 1.1 ? GREEN : kdNum >= 0.9 ? YELLOW : RED
  const wrColor = user.winRate >= 50 ? GREEN : '#F59E0B'
  const ratingNum   = Number(user.ratingOverall ?? 0)
  const ratingColor = ratingNum > 1.1 ? GREEN : ratingNum >= 0.9 ? YELLOW : RED

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
                {/* Без рамки — тонкая ранговая обводка; с рамкой — её отдаёт сам Avatar */}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <Avatar
                    avatarUrl={user.avatarUrl}
                    name={user.gameNickname || user.firstName}
                    size={56}
                    frame={user.avatarFrame}
                    style={user.avatarFrame ? { borderRadius: '50%' } : { border: `1.5px solid ${rank.color}66`, borderRadius: '50%' }}
                  />
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
                  {user.isVerified && <Icon name="verified" size={14} style={{ flexShrink: 0 }} />}
                </div>
                <div style={{ fontSize: 10, color: '#4B5563', fontWeight: 600 }}>
                  {user.username ? `@${user.username}` : `${user.elo} ELO`}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <NotificationBell />
            </div>
          </motion.div>

          {/* ── HERO CARD ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05, type: 'spring', stiffness: 280, damping: 26 }}
            style={{
              borderRadius: 24, marginBottom: 14, overflow: 'hidden', position: 'relative',
              background: `radial-gradient(130% 130% at 0% 0%, ${accent}22, transparent 46%), radial-gradient(130% 130% at 100% 100%, ${accent}14, transparent 52%), linear-gradient(160deg, #0c0c11, #08080b)`,
              border: `1px solid ${accent}33`,
              boxShadow: `0 16px 50px ${accent}1a`,
              padding: 18,
              backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', willChange: 'transform',
            }}
          >
            {/* CONDR logo — roams across the whole card */}
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
              <motion.div
                animate={{ x: [-140, 130, -70, 150, -140], y: [-44, 52, -58, 34, -44], opacity: [0.05, 0.11, 0.06, 0.1, 0.05] }}
                transition={{ duration: 40, repeat: Infinity, ease: 'easeInOut' }}
              >
                <motion.div
                  animate={{ rotate: 360, scale: [1, 1.08, 1] }}
                  transition={{ rotate: { duration: 75, repeat: Infinity, ease: 'linear' }, scale: { duration: 11, repeat: Infinity, ease: 'easeInOut' } }}
                  style={{ filter: `drop-shadow(0 0 22px ${accent}66)` }}
                >
                  <Logo size={210} color={accent} />
                </motion.div>
              </motion.div>
            </div>
            {/* Dotted grid */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '18px 18px',
              WebkitMaskImage: 'radial-gradient(120% 120% at 20% 0%, #000 24%, transparent 70%)',
              maskImage: 'radial-gradient(120% 120% at 20% 0%, #000 24%, transparent 70%)',
            }} />
            {/* Shimmer */}
            <motion.div animate={{ x: ['-130%', '230%'] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 6, ease: 'linear' }}
              style={{ position: 'absolute', top: 0, bottom: 0, width: '28%', pointerEvents: 'none', background: `linear-gradient(90deg, transparent, ${accent}16, transparent)` }} />

            {/* Header */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em' }}>Текущий рейтинг</span>
              {!calibrating && myRank && (
                <span style={{ fontSize: 10, fontWeight: 800, color: accent, display: 'inline-flex', alignItems: 'center', gap: 4, background: `${accent}14`, border: `1px solid ${accent}30`, padding: '3px 9px', borderRadius: 20 }}>
                  <Icon name="trophy" size={11} color={accent} />#{myRank} в мире
                </span>
              )}
            </div>

            {/* Main row — orb on the same level as the ELO number */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
              {calibrating ? (
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-2px', lineHeight: 0.95, color: '#fff', textShadow: `0 2px 24px ${accent}88` }}>
                    {user.matchesPlayed}<span style={{ fontSize: 26, color: '#6B7280' }}>/10</span>
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: accent, letterSpacing: '0.06em' }}>КАЛИБРОВКА</span>
                </div>
              ) : (
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-2.5px', lineHeight: 0.95, color: '#fff', textShadow: `0 2px 24px ${accent}88` }}>
                    <AnimatedNumber value={user.elo} duration={1.5} />
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#6B7280', letterSpacing: '0.06em' }}>ELO</span>
                </div>
              )}

              {/* Rank orb with pulsing glow */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <motion.div
                  animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.1, 1] }}
                  transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ position: 'absolute', inset: -14, borderRadius: '50%', background: `radial-gradient(circle, ${accent}4a, transparent 70%)`, pointerEvents: 'none' }}
                />
                <div style={{ position: 'relative', filter: `drop-shadow(0 0 16px ${accent}99)` }}>
                  <EloRing elo={user.elo} size={88} isChallenger={isChallenger} showLabel={false} calibrating={calibrating} />
                </div>
              </div>
            </div>

            {/* Progress bar — ранг (или калибровка) */}
            <div style={{ position: 'relative', marginTop: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 10, color: '#6B7280', fontWeight: 700 }}>
                {calibrating ? (
                  <>
                    <span style={{ color: accent }}>Калибровка</span>
                    <span>Осталось матчей: <b style={{ color: accent }}>{10 - user.matchesPlayed}</b></span>
                  </>
                ) : (
                  <>
                    <span style={{ color: accent }}>{isChallenger ? 'Challenger' : rank.label}</span>
                    <span>{nextRank ? <>До {nextRank.label}: <b style={{ color: accent }}>{eloToNext}</b></> : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="bolt" size={10} color={accent} />Макс. ранг</span>}</span>
                  </>
                )}
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${calibrating ? Math.round((user.matchesPlayed / 10) * 100) : segPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
                  style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${accent}aa, ${accent})`, boxShadow: `0 0 8px ${accent}88` }}
                />
              </div>
            </div>
          </motion.div>

          {/* ── STATS ROW ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <StatChip label="Матчи"   value={user.matchesPlayed}   color="#6B7280" icon="gamepad"    delay={0.1}  valueColor="#F3F4F6" />
            <StatChip label="Винрейт" value={`${user.winRate}%`}    color="#6B7280" icon="trendingUp" delay={0.15} valueColor={wrColor} />
            <StatChip label="Рейтинг" value={ratingNum.toFixed(2)}  color="#6B7280" icon="barChart"   delay={0.2}  valueColor={ratingColor} />
          </div>

          {/* ── COINS BAR ── */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.23 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'linear-gradient(135deg, rgba(234,179,8,0.12), #0f0f15 65%)', border: '1px solid rgba(234,179,8,0.28)',
              borderRadius: 16, padding: '12px 16px', marginBottom: 14,
              position: 'relative', overflow: 'hidden', boxShadow: '0 8px 26px rgba(234,179,8,0.1)',
            }}
          >
            <div style={{ position: 'absolute', right: -24, top: -24, width: 110, height: 110, background: 'radial-gradient(circle, rgba(234,179,8,0.22), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: 'rgba(234,179,8,0.14)', border: '1px solid rgba(234,179,8,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="coins" size={20} color="#EAB308" />
              </div>
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
              <Icon name="coins" size={16} color="#000" />
              Получить
            </motion.button>
          </motion.div>

          {/* ── COOLDOWN ── */}
          {isOnCooldown && <CooldownBanner until={new Date(user.cooldownUntil!)} />}

          {/* ── PLAY ZONE HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}
          >
            <span style={{ fontSize: 11, color: '#E5E7EB', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 3, height: 13, borderRadius: 2, background: '#E8092E', boxShadow: '0 0 8px rgba(232,9,46,0.6)' }} />Играть
            </span>
            <span style={{ fontSize: 10, color: '#4B5563', fontWeight: 700 }}>Рейтинговый режим 5×5</span>
          </motion.div>

          {/* ── MODE SELECTOR (Обычный / CPL-Q / CPL) — sliding highlight ── */}
          {!lobby && (() => {
            const tabs = ([
              { key: 'normal', label: 'Обычный', locked: false },
              { key: 'cplq',   label: 'CPL-Q',   locked: !user.cplqAccess },
              { key: 'cpl',    label: 'CPL',     locked: !user.cplAccess },
            ] as { key: typeof mode; label: string; locked: boolean }[])
            const activeIdx = Math.max(0, tabs.findIndex(t => t.key === mode))
            return (
              <div style={{ position: 'relative', display: 'flex', marginBottom: 10, background: 'rgba(255,255,255,0.035)', padding: 4, borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)' }}>
                {/* sliding highlight — animates only on index change, never on mount/reflow */}
                <motion.div
                  initial={false}
                  animate={{ x: `${activeIdx * 100}%` }}
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc((100% - 8px) / 3)', borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(135deg, #ff1f43, #b4001e)', boxShadow: '0 4px 16px rgba(232,9,46,0.45), inset 0 1px 0 rgba(255,255,255,0.28)', zIndex: 0, willChange: 'transform', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                >
                  <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)' }} />
                  <motion.div animate={{ x: ['-160%', '260%'] }} transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 1.6, ease: 'easeInOut' }}
                    style={{ position: 'absolute', top: 0, bottom: 0, width: '45%', transform: 'skewX(-18deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)' }} />
                </motion.div>
                {tabs.map(m => {
                  const active = mode === m.key
                  return (
                    <button key={m.key} onClick={() => m.locked ? alert('Доступ к лиге выдаёт администратор') : setMode(m.key)}
                      style={{ flex: 1, position: 'relative', zIndex: 1, padding: '10px 0', border: 'none', cursor: 'pointer', background: 'none', borderRadius: 10, fontSize: 12.5, fontWeight: 800, color: active ? '#fff' : m.locked ? '#4B5563' : '#9CA3AF', textShadow: active ? '0 1px 8px rgba(0,0,0,0.35)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'color .25s ease' }}>
                      {m.locked && <Icon name="lock" size={12} color="#4B5563" />}{m.label}
                    </button>
                  )
                })}
              </div>
            )
          })()}

          {/* ── FIND MATCH (5v5 lobby) ── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, type: 'spring', stiffness: 260, damping: 24 }}
            style={{ marginBottom: 10 }}
          >
            <AnimatePresence mode="wait">
              {lobby ? (
                <motion.div
                  key="lobby-on"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  style={{
                    borderRadius: 18,
                    background: 'rgba(232,9,46,0.06)',
                    border: '1px solid rgba(232,9,46,0.35)',
                    padding: '15px 16px', position: 'relative', overflow: 'hidden',
                  }}
                >
                  <motion.div
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      position: 'absolute', top: 0, bottom: 0, width: '38%',
                      background: 'linear-gradient(90deg, transparent, rgba(232,9,46,0.08), transparent)',
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1, repeat: Infinity }}
                      style={{ width: 8, height: 8, borderRadius: '50%', background: '#E8092E', flexShrink: 0 }} />
                    <span style={{ fontWeight: 800, fontSize: 13, flex: 1, display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="swords" size={16} color="#fff" />Поиск матча 5×5</span>
                    <span style={{ fontSize: 12, color: '#E8092E', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{lobby.filled}/{lobby.slots}</span>
                  </div>

                  {/* 10 slots — 5 per row */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5, marginBottom: 12 }}>
                    {Array.from({ length: lobby.slots ?? 10 }).map((_, i) => {
                      const p = lobby.players?.[i]
                      const isMe = p?.id === user.id
                      return (
                        <motion.div
                          key={i}
                          initial={false}
                          animate={p ? { scale: [0.85, 1.06, 1] } : {}}
                          transition={{ duration: 0.35 }}
                          style={{
                            padding: '9px 2px', borderRadius: 9, textAlign: 'center',
                            fontSize: 10, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            background: p ? isMe ? 'rgba(232,9,46,0.22)' : 'rgba(232,9,46,0.12)' : 'rgba(255,255,255,0.03)',
                            color: p ? isMe ? '#F87171' : '#fca5a5' : '#2D2D2D',
                            border: p ? isMe ? '1px solid rgba(232,9,46,0.45)' : '1px solid rgba(232,9,46,0.25)' : '1px dashed rgba(255,255,255,0.07)',
                            boxShadow: p && !isMe ? '0 0 8px rgba(232,9,46,0.15)' : 'none',
                          }}
                        >
                          {p ? (isMe ? 'Ты' : p.name.slice(0, 5)) : '—'}
                        </motion.div>
                      )
                    })}
                  </div>

                  {/* Progress */}
                  <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
                    <motion.div
                      animate={{ width: `${((lobby.filled ?? 0) / (lobby.slots || 10)) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                      style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #E8092E, #ff5a72)', boxShadow: '0 0 8px rgba(232,9,46,0.5)' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => router.push(`/match/${lobby.matchId}`)}
                      style={{
                        flex: 1, background: 'linear-gradient(135deg, rgba(232,9,46,0.95), rgba(180,0,30,0.95))',
                        border: 'none', borderRadius: 11, padding: '11px 0',
                        color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                        boxShadow: '0 2px 16px rgba(232,9,46,0.35)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      }}
                    >
                      <motion.div animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff' }} />
                      {lobby.filled >= lobby.slots ? 'В матч' : 'Открыть лобби'}
                    </button>
                    <button
                      onClick={leaveLobby}
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 11, padding: '11px 14px', color: '#6B7280', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    ><Icon name="x" size={14} /></button>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="lobby-off" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'relative' }}>
                  {/* breathing red halo — единственный яркий красный сигнал, на тёмной кнопке (GPU-safe, без blur) */}
                  {!isOnCooldown && !lobbyLoading && (
                    <motion.div aria-hidden animate={{ opacity: [0.3, 0.6, 0.3], scale: [0.97, 1.025, 0.97] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ position: 'absolute', inset: -8, borderRadius: 28, background: 'radial-gradient(55% 62% at 50% 50%, rgba(232,9,46,0.42), transparent 72%)', zIndex: 0, pointerEvents: 'none' }} />
                  )}
                  <motion.button
                    whileTap={{ scale: 0.975 }}
                    disabled={lobbyLoading || !!isOnCooldown}
                    onClick={findOrCreateLobby}
                    style={{
                      position: 'relative', zIndex: 1, width: '100%', borderRadius: 20, border: '1px solid rgba(232,9,46,0.45)', cursor: lobbyLoading || isOnCooldown ? 'default' : 'pointer',
                      background: 'radial-gradient(130% 130% at 0% 0%, rgba(232,9,46,0.24), transparent 50%), radial-gradient(130% 130% at 100% 110%, rgba(232,9,46,0.12), transparent 55%), linear-gradient(160deg, #150810, #0b0b0f)',
                      padding: '21px 18px', overflow: 'hidden',
                      boxShadow: isOnCooldown ? 'none' : '0 14px 40px rgba(232,9,46,0.26), inset 0 1px 0 rgba(255,255,255,0.07)',
                      opacity: (lobbyLoading || !!isOnCooldown) ? 0.55 : 1,
                    }}
                  >
                    {/* top red hairline — как у секций главной */}
                    <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(232,9,46,0.9), transparent)', pointerEvents: 'none' }} />
                    {/* dotted texture */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.5, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)', backgroundSize: '15px 15px', WebkitMaskImage: 'radial-gradient(120% 120% at 28% 0%, #000 28%, transparent 72%)', maskImage: 'radial-gradient(120% 120% at 28% 0%, #000 28%, transparent 72%)' }} />
                    {!isOnCooldown && !lobbyLoading && (<>
                      {/* drifting red ember (screen-blend → мягкое красное свечение по тёмному фону) */}
                      <motion.div animate={{ x: ['-30%', '40%', '-30%'], y: ['-16%', '22%', '-16%'], opacity: [0.4, 0.75, 0.4] }} transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut' }}
                        style={{ position: 'absolute', top: '50%', left: '50%', width: '75%', height: '200%', transform: 'translate(-50%,-50%)', background: 'radial-gradient(circle, rgba(232,9,46,0.6), transparent 60%)', mixBlendMode: 'screen', pointerEvents: 'none' }} />
                      {/* sheen sweep — приглушённый, для стекла */}
                      <motion.div animate={{ x: ['-150%', '250%'] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' }}
                        style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', transform: 'skewX(-18deg)', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', pointerEvents: 'none' }} />
                    </>)}

                    <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 13 }}>
                      {/* красный значок-бейдж — акцент на тёмной кнопке */}
                      <div style={{ position: 'relative', width: 42, height: 42, borderRadius: 13, flexShrink: 0, background: 'linear-gradient(135deg, #E8092E, #b4001e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(232,9,46,0.5), inset 0 1px 0 rgba(255,255,255,0.28)' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '13px 13px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.3), transparent)', pointerEvents: 'none' }} />
                        {!isOnCooldown && !lobbyLoading && <motion.div animate={{ opacity: [0, 0.5, 0], scale: [0.92, 1.12, 0.92] }} transition={{ duration: 2.1, repeat: Infinity, ease: 'easeInOut' }} style={{ position: 'absolute', inset: -2, borderRadius: 15, border: '1.5px solid rgba(232,9,46,0.7)', pointerEvents: 'none' }} />}
                        <motion.div animate={lobbyLoading ? { rotate: 360 } : { scale: [1, 1.12, 1] }} transition={lobbyLoading ? { duration: 0.9, repeat: Infinity, ease: 'linear' } : { duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} style={{ display: 'flex', position: 'relative' }}>
                          <Icon name="swords" size={22} color="#fff" />
                        </motion.div>
                      </div>

                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div key={lobbyLoading ? 'loading' : mode} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }} style={{ textAlign: 'left' }}>
                          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '0.01em', lineHeight: 1.05, textShadow: '0 0 18px rgba(232,9,46,0.45)' }}>
                            {lobbyLoading ? 'Подключаемся…' : mode === 'cpl' ? 'Найти матч · CPL' : mode === 'cplq' ? 'Найти матч · CPL-Q' : 'Найти матч'}
                          </div>
                          <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginTop: 2 }}>
                            {mode === 'cpl' ? 'CONDR Pro League · про-сцена' : mode === 'cplq' ? 'Квалификации в Pro League' : '5 на 5 · подбор по уровню'}
                          </div>
                        </motion.div>
                      </AnimatePresence>

                      {!lobbyLoading && !isOnCooldown && (
                        <motion.div animate={{ x: [0, 5, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }} style={{ marginLeft: 2, display: 'flex' }}>
                          <Icon name="chevronRight" size={20} color="#ff5267" />
                        </motion.div>
                      )}
                    </div>
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* ── PARTY / SQUAD — только в обычном режиме (CPL/CPL-Q — соло) ── */}
          {!lobby && mode === 'normal' && <PartyPanel party={party} invitations={invitations} refresh={loadParty} />}
          {!lobby && mode !== 'normal' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 14, borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="user" size={17} color="#F59E0B" /></div>
              <div style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.4 }}><b style={{ color: '#fff' }}>{mode === 'cpl' ? 'CPL' : 'CPL-Q'} — только соло-подбор.</b> Отряды доступны лишь в обычном режиме.</div>
            </div>
          )}

          {/* ── SECONDARY MODE HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 4 }}
          >
            <span style={{ fontSize: 11, color: '#E5E7EB', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 3, height: 13, borderRadius: 2, background: '#E8092E', boxShadow: '0 0 8px rgba(232,9,46,0.6)' }} />Другие режимы
            </span>
            <span style={{ fontSize: 10, color: '#4B5563', fontWeight: 700 }}>Без рейтинга</span>
          </motion.div>

          {/* ── CONDR DM ── */}
          <motion.button
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.32, type: 'spring', stiffness: 260, damping: 24 }}
            whileTap={{ scale: 0.98 }} onClick={() => router.push('/dm')}
            style={{ width: '100%', marginBottom: 14, borderRadius: 16, cursor: 'pointer', position: 'relative', overflow: 'hidden', padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 13, textAlign: 'left', background: 'radial-gradient(120% 120% at 0% 0%, rgba(232,9,46,0.12), transparent 55%), #0f0f15', border: '1px solid rgba(232,9,46,0.22)' }}>
            <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1, background: 'linear-gradient(90deg, transparent, rgba(232,9,46,0.55), transparent)' }} />
            <motion.div animate={{ x: ['-120%', '220%'] }} transition={{ duration: 3.5, repeat: Infinity, repeatDelay: 4, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '28%', background: 'linear-gradient(90deg, transparent, rgba(232,9,46,0.08), transparent)', pointerEvents: 'none' }} />
            <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: 'rgba(232,9,46,0.12)', border: '1px solid rgba(232,9,46,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <Icon name="flame" size={22} color="#E8092E" />
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <div style={{ fontSize: 15.5, fontWeight: 900, color: '#fff', letterSpacing: '0.01em' }}>CONDR DM</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginTop: 1 }}>Дезматч · быстрый разогрев</div>
            </div>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', borderRadius: 20, background: 'rgba(232,9,46,0.14)', border: '1px solid rgba(232,9,46,0.3)', fontSize: 10, fontWeight: 800, color: '#ff5267', whiteSpace: 'nowrap' }}>
              Играть<Icon name="chevronRight" size={13} color="#ff5267" />
            </div>
          </motion.button>

          {/* ── QUICK LINKS ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36 }}
            style={{ marginTop: 6 }}
          >
            <div style={{ fontSize: 11, color: '#E5E7EB', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ width: 3, height: 13, borderRadius: 2, background: '#E8092E', boxShadow: '0 0 8px rgba(232,9,46,0.6)' }} />Разделы
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { icon: 'users', label: 'Друзья',   sub: 'Твои контакты', href: '/friends',     color: '#34D399', glow: 'rgba(52,211,153,0.12)'  },
                { icon: 'target', label: 'Задания',   sub: 'Ежедневные',    href: '/missions',    color: '#FBBF24', glow: 'rgba(251,191,36,0.12)'  },
                { icon: 'cart', label: 'Магазин',   sub: 'Варны и скины', href: '/shop',        color: '#C084FC', glow: 'rgba(192,132,252,0.12)' },
                { icon: 'chat', label: 'Поддержка', sub: 'Помощь · FAQ',  href: '/support',     color: '#60A5FA', glow: 'rgba(96,165,250,0.12)'  },
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
            onWin={() => {
              // Не закрываем — модалка сама предложит сыграть следующий уровень.
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
              {...coinSheet.panelProps}
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
              <div {...coinSheet.handleProps} style={{ ...coinSheet.handleProps.style, padding: '2px 0 18px' }}>
                <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4, textAlign: 'center' }}>Получить монеты</div>
              <div style={{ fontSize: 12, color: '#4B5563', textAlign: 'center', marginBottom: 20 }}>
                Текущий баланс: <b style={{ color: '#EAB308', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="coins" size={13} color="#EAB308" />{user.coins}</b>
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
                  }}><Icon name="card" size={22} color="#000" /></div>
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
                  }}><Icon name="target" size={22} color="#fff" /></div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 2 }}>Сыграть и заработать</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>
                      +10 <Icon name="coins" size={11} color="#22C55E" style={{ verticalAlign: '-1px' }} /> за победу · {Math.max(0, 10 - (user.miniGamePlaysToday ?? 0))}/10 попыток осталось
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
