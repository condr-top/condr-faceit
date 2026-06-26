'use client'

import { useEffect, useState, useRef } from 'react'
import { LeagueBoard } from '@/components/cpl/LeagueBoard'
import { motion, useSpring, useMotionValue } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCached, setCached } from '@/lib/cache'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Avatar } from '@/components/ui/Avatar'
import { EloRing } from '@/components/ui/EloRing'
import { getEloRank, getRankProgress, qualifiesChallenger, CHALLENGER_RANK } from '@/lib/eloRank'
import { Flag } from '@/components/ui/Flag'
import { Icon } from '@/components/ui/Icon'

interface Entry {
  rank: number; id: number
  gameNickname: string | null; username: string | null; firstName: string
  avatarUrl: string | null; elo: number; matchesPlayed: number
  winRate: number; isPremium: boolean; isVerified: boolean; region?: string | null
}

const CHALL = '#E8092E'

// ── Animated number ───────────────────────────────────────────────────────────
function AnimNum({ value }: { value: number }) {
  const mv = useMotionValue(0)
  const sp = useSpring(mv, { duration: 1400, bounce: 0 })
  const [d, setD] = useState(0)
  useEffect(() => { mv.set(value) }, [value])
  useEffect(() => sp.on('change', v => setD(Math.round(v))), [sp])
  return <>{d.toLocaleString()}</>
}

// ── Medal config ──────────────────────────────────────────────────────────────
const MEDALS = {
  1: { color: '#FFD700', dim: '#B8860B', glow: 'rgba(255,215,0,0.5)',  height: 96, avatar: 62, label: '1ST' },
  2: { color: '#E2E8F0', dim: '#94A3B8', glow: 'rgba(226,232,240,0.35)', height: 70, avatar: 50, label: '2ND' },
  3: { color: '#F97316', dim: '#C2410C', glow: 'rgba(249,115,22,0.35)',  height: 54, avatar: 50, label: '3RD' },
} as const

// ── Podium card ───────────────────────────────────────────────────────────────
function PodiumCard({ p, pos, delay, isChallenger }: { p: Entry; pos: 1 | 2 | 3; delay: number; isChallenger: boolean }) {
  const router = useRouter()
  const { user } = useAuthStore()
  const isMe = p.id === user?.id
  const m = MEDALS[pos]
  const theme = isChallenger ? CHALLENGER_RANK : getEloRank(p.elo)

  return (
    <motion.button
      initial={{ opacity: 0, y: 40 + (pos === 1 ? 0 : 20) }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 22 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => router.push(`/player/${p.id}`)}
      style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {/* Crown #1 */}
      {pos === 1
        ? <motion.div animate={{ y: [0, -5, 0], rotate: [-4, 4, -4] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ marginBottom: 3, color: '#FFD700', filter: 'drop-shadow(0 0 7px rgba(255,215,0,0.6))' }}><Icon name="crown" size={26} /></motion.div>
        : <div style={{ height: 29 }} />}

      {/* Avatar with spinning medal ring */}
      <div style={{ position: 'relative', marginBottom: 7 }}>
        <motion.div
          animate={{ boxShadow: [`0 0 12px ${m.glow}`, `0 0 26px ${m.glow}`, `0 0 12px ${m.glow}`] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{ position: 'relative', width: m.avatar + 6, height: m.avatar + 6, borderRadius: '50%', overflow: 'hidden' }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12 - pos * 2, repeat: Infinity, ease: 'linear' }}
            style={{ position: 'absolute', inset: -3, background: `conic-gradient(${m.color} 0deg, ${m.dim} 120deg, ${m.color} 240deg, transparent 285deg, ${m.color} 360deg)`, opacity: 0.65 }}
          />
          <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', overflow: 'hidden', background: '#0a0a0e' }}>
            <Avatar avatarUrl={p.avatarUrl} name={p.gameNickname || p.firstName} size={m.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          </div>
        </motion.div>
        {/* Rank orb badge — иконка ранга */}
        <div style={{ position: 'absolute', bottom: -5, right: -7, filter: `drop-shadow(0 0 6px ${theme.color}88)` }}>
          <EloRing elo={p.elo} size={26} isChallenger={isChallenger} showLabel={false} />
        </div>
        {isMe && (
          <div style={{ position: 'absolute', top: -2, left: -4, zIndex: 2, background: CHALL, borderRadius: '50%', width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, color: '#fff', fontWeight: 900 }}>я</div>
        )}
      </div>

      {/* Name */}
      <div style={{ fontSize: pos === 1 ? 12 : 11, fontWeight: 900, color: '#fff', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center' }}>
        {p.region && <Flag code={p.region} size={10} />}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.gameNickname || p.firstName}</span>
        {p.isVerified && <Icon name="verified" size={11} style={{ flexShrink: 0 }} />}
      </div>

      {/* ELO */}
      <div style={{ fontSize: pos === 1 ? 15 : 13, fontWeight: 900, color: m.color, marginBottom: 6, letterSpacing: '-0.5px', textShadow: isChallenger ? `0 0 10px ${CHALL}88` : 'none' }}>
        {p.elo.toLocaleString()}
      </div>

      {/* Platform */}
      <div style={{
        width: '100%', height: m.height, borderRadius: '12px 12px 0 0',
        background: `linear-gradient(180deg, ${m.color}1c 0%, ${m.color}05 100%)`,
        border: `1px solid ${m.color}28`, borderBottom: 'none',
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 -6px 28px ${m.glow}, inset 0 1px 0 ${m.color}30`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 9, gap: 2,
      }}>
        <motion.div
          animate={{ x: ['-100%', '260%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 3 + pos }}
          style={{ position: 'absolute', top: 0, bottom: 0, width: '35%', background: `linear-gradient(90deg, transparent, ${m.color}14, transparent)` }}
        />
        <span style={{ fontSize: 22, fontWeight: 900, color: m.color, opacity: 0.55, letterSpacing: '-1px' }}>{pos}</span>
        <span style={{ fontSize: 8, fontWeight: 900, color: m.color, opacity: 0.5, letterSpacing: '0.1em' }}>{m.label}</span>
      </div>
    </motion.button>
  )
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({ p, delay, isMe, isChallenger }: { p: Entry; delay: number; isMe: boolean; isChallenger: boolean }) {
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)
  const rank = getEloRank(p.elo)
  const accent = isChallenger ? CHALL : (isMe ? CHALL : rank.color)

  const track = (cx: number, cy: number) => {
    const el = cardRef.current; const sh = shineRef.current
    if (!el || !sh) return
    const r = el.getBoundingClientRect()
    const x = (cx - r.left) / r.width - 0.5, y = (cy - r.top) / r.height - 0.5
    el.style.transform = `perspective(500px) rotateX(${-y * 5}deg) rotateY(${x * 5}deg) scale(1.01)`
    sh.style.background = `radial-gradient(circle at ${(x + .5) * 100}% ${(y + .5) * 100}%, rgba(255,255,255,0.07) 0%, transparent 55%)`
  }
  const reset = () => {
    const el = cardRef.current; const sh = shineRef.current
    if (el) el.style.transform = 'perspective(500px) rotateX(0) rotateY(0) scale(1)'
    if (sh) sh.style.background = 'none'
  }

  const isMaxRank = rank.max === Infinity
  // Прогресс внутри текущего ранга. Для макс. ранга (Level 10) — 100%.
  const segPct = isMaxRank ? 100 : Math.round(getRankProgress(p.elo) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, x: -18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 26 }}
      onMouseMove={e => track(e.clientX, e.clientY)}
      onMouseLeave={reset}
      onTouchMove={e => { const t = e.touches[0]; track(t.clientX, t.clientY) }}
      onTouchEnd={reset}
    >
      <div
        ref={cardRef}
        onClick={() => router.push(`/player/${p.id}`)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 13px', borderRadius: 16, cursor: 'pointer',
          background: '#0f0f15',
          border: `1px solid ${isMe ? 'rgba(232,9,46,0.3)' : `${accent}1c`}`,
          borderLeft: `3px solid ${accent}`,
          position: 'relative', overflow: 'hidden',
          transition: 'transform 0.14s ease', willChange: 'transform',
          boxShadow: isChallenger ? `0 6px 22px ${CHALL}14` : (isMe ? '0 0 18px rgba(232,9,46,0.08)' : 'none'),
        }}
      >
        <div ref={shineRef} style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', transition: 'background 0.08s' }} />

        {/* Rank number */}
        <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
          {isChallenger ? (
            <motion.span
              animate={{ textShadow: [`0 0 6px ${CHALL}`, `0 0 14px ${CHALL}`, `0 0 6px ${CHALL}`] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ fontSize: 13, fontWeight: 900, color: CHALL }}
            >#{p.rank}</motion.span>
          ) : (
            <span style={{ color: isMe ? CHALL : '#4B5563', fontSize: 12, fontWeight: 800 }}>#{p.rank}</span>
          )}
        </div>

        {/* Rank orb */}
        <div style={{ flexShrink: 0 }}>
          <EloRing elo={p.elo} size={36} isChallenger={isChallenger} showLabel={false} />
        </div>

        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar avatarUrl={p.avatarUrl} name={p.gameNickname || p.firstName} size={40} style={{ border: `1.5px solid ${accent}33`, borderRadius: '50%' }} />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
            {p.region && <Flag code={p.region} size={11} />}
            <span style={{ fontWeight: 800, fontSize: 13, color: isMe ? '#fff' : '#E5E7EB', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.gameNickname || p.firstName}</span>
            {p.isVerified && <Icon name="verified" size={13} style={{ flexShrink: 0 }} />}
            {isMe && <span style={{ fontSize: 9, color: CHALL, fontWeight: 800, background: 'rgba(232,9,46,0.12)', padding: '1px 5px', borderRadius: 8, flexShrink: 0 }}>ВЫ</span>}
          </div>

          {/* Шкала прогресса ранга (макс. ранг → 100%) */}
          <div style={{ height: 4, background: 'rgba(255,255,255,0.07)', borderRadius: 2, overflow: 'hidden', marginBottom: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${segPct}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay }}
              style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${accent}88, ${accent})`, boxShadow: `0 0 6px ${accent}70` }}
            />
          </div>

          {/* Stats */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMaxRank && (
              <span style={{ fontSize: 8, fontWeight: 900, color: accent, letterSpacing: '0.08em', background: `${accent}16`, border: `1px solid ${accent}33`, padding: '1px 6px', borderRadius: 7, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Icon name="bolt" size={8} />МАКС
              </span>
            )}
            <span style={{ fontSize: 9, color: '#4B5563' }}>{p.winRate}% WR</span>
            <span style={{ fontSize: 9, color: '#374151' }}>{p.matchesPlayed} игр</span>
          </div>
        </div>

        {/* ELO — фиксированная ширина, чтобы длина шкалы слева не зависела от числа */}
        <div style={{ width: 64, textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: accent, letterSpacing: '-0.5px', lineHeight: 1, textShadow: isChallenger ? `0 0 10px ${CHALL}` : 'none' }}>
            {p.elo.toLocaleString()}
          </div>
          <div style={{ fontSize: 8, color: '#374151', fontWeight: 700, marginTop: 3, letterSpacing: '0.08em' }}>ELO</div>
        </div>
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [view, setView] = useState<'normal' | 'cplq' | 'cpl'>('normal')
  const [tab, setTab] = useState<'global' | 'regional'>('global')
  const [players, setPlayers]     = useState<Entry[]>(() => getCached<Entry[]>('leaderboard') ?? [])
  const [regional, setRegional]   = useState<Entry[]>([])
  const [myRank, setMyRank]       = useState<number | null>(() => getCached<number>('leaderboard-rank'))
  const [loading, setLoading]     = useState(!players.length)
  const { user } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    api.get('/leaderboard').then(r => { setPlayers(r.data); setCached('leaderboard', r.data); setLoading(false) })
    api.get('/leaderboard/rank').then(r => { setMyRank(r.data); setCached('leaderboard-rank', r.data) })
  }, [])

  useEffect(() => {
    if (tab === 'regional' && user?.region)
      api.get(`/leaderboard/regional?region=${user.region}`).then(r => setRegional(r.data)).catch(() => {})
  }, [tab, user?.region])

  // Challenger — строго по ГЛОБАЛЬНОМУ топ-5 (2000+ ELO). Один набор id на всё,
  // чтобы в региональной вкладке тоже определялось по глобальному рейтингу.
  const challengerIds = new Set(players.filter(p => qualifiesChallenger(p.elo, p.rank)).map(p => p.id))
  const isChall = (p: Entry) => challengerIds.has(p.id)

  const list = tab === 'regional' ? regional : players
  const podium = [list.find(p => p.rank === 1), list.find(p => p.rank === 2), list.find(p => p.rank === 3)]
  const rest   = list.filter(p => p.rank > 3)

  const myElo = user?.elo ?? 0
  const meChallenger = !!user && qualifiesChallenger(myElo, myRank)
  const myTheme = meChallenger ? CHALLENGER_RANK : getEloRank(myElo)

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 96 }}>
        <div style={{ padding: '0 16px', position: 'relative', zIndex: 1 }}>

          {/* ── HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{ paddingTop: 24, marginBottom: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <motion.div
                animate={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                  width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(234,179,8,0.15))',
                  border: '1px solid rgba(245,158,11,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B',
                }}
              ><Icon name="trophy" size={20} /></motion.div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.8px', lineHeight: 1 }}>Рейтинг</h1>
                {players.length > 0 && (
                  <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>{players.length} игроков · сезон 1</div>
                )}
              </div>
            </div>

            {/* League view selector — sliding highlight */}
            {(() => {
              const tabs = ([
                { key: 'normal', label: 'Обычный', g1: '#F59E0B', g2: '#ca8a04' },
                { key: 'cplq',   label: 'CPL-Q',   g1: '#F59E0B', g2: '#EF4444' },
                { key: 'cpl',    label: 'CPL',     g1: '#E8092E', g2: '#A855F7' },
              ] as { key: typeof view; label: string; g1: string; g2: string }[])
              const idx = Math.max(0, tabs.findIndex(t => t.key === view))
              const at = tabs[idx]
              return (
                <div style={{ position: 'relative', display: 'flex', background: '#0f0f15', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 4, marginBottom: user && myRank && view === 'normal' ? 12 : 0 }}>
                  <motion.div
                    initial={false}
                    animate={{ x: `${idx * 100}%` }}
                    transition={{ type: 'spring', stiffness: 360, damping: 32 }}
                    style={{ position: 'absolute', top: 4, bottom: 4, left: 4, width: 'calc((100% - 8px) / 3)', borderRadius: 10, background: `linear-gradient(135deg, ${at.g1}cc, ${at.g2}cc)`, boxShadow: `0 2px 10px ${at.g1}55`, zIndex: 0, willChange: 'transform', backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
                  />
                  {tabs.map(v => (
                    <button key={v.key} onClick={() => setView(v.key)} style={{ flex: 1, position: 'relative', zIndex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, background: 'none', color: view === v.key ? '#fff' : '#4B5563', transition: 'color .25s ease' }}>
                      {v.label}
                    </button>
                  ))}
                </div>
              )
            })()}

            {/* My rank card */}
            {view === 'normal' && user && myRank && (
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, type: 'spring', stiffness: 300, damping: 24 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push('/profile')}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
                  background: `linear-gradient(135deg, ${myTheme.color}18, #0f0f15 65%)`,
                  border: `1px solid ${myTheme.color}33`, borderRadius: 18, padding: '12px 16px', marginBottom: 4,
                  position: 'relative', overflow: 'hidden', boxShadow: `0 8px 26px ${myTheme.color}12`,
                }}
              >
                <div style={{ position: 'absolute', right: -24, top: -24, width: 120, height: 120, background: `radial-gradient(circle, ${myTheme.color}22, transparent 70%)`, pointerEvents: 'none' }} />
                <div style={{ filter: `drop-shadow(0 0 12px ${myTheme.color}66)`, position: 'relative', flexShrink: 0 }}>
                  <EloRing elo={myElo} size={50} isChallenger={meChallenger} showLabel={false} />
                </div>
                <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                  <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>Ваше место</div>
                  <div style={{ fontSize: 13, fontWeight: 900, color: myTheme.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {meChallenger ? <><Icon name="crown" size={13} />Challenger</> : myTheme.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 3 }}>
                    <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.6px' }}>{myElo.toLocaleString()}</span>
                    <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 700 }}>ELO</span>
                  </div>
                </div>
                <div style={{ textAlign: 'center', position: 'relative', flexShrink: 0 }}>
                  <div style={{ fontSize: 26, fontWeight: 900, color: myTheme.color, letterSpacing: '-1.5px', lineHeight: 1 }}>#{myRank}</div>
                  <div style={{ fontSize: 8, color: '#6B7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>В мире</div>
                </div>
              </motion.button>
            )}
          </motion.div>

          {/* ── LEAGUE BOARDS ── */}
          {view !== 'normal' && <LeagueBoard league={view} />}

          {view === 'normal' && (<>
          {/* Tabs */}
          <div style={{
            display: 'flex', gap: 5,
            background: '#0f0f15', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 14, padding: 4, marginBottom: 6,
          }}>
            <button onClick={() => setTab('global')} style={{
              flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
              background: tab === 'global' ? 'linear-gradient(135deg, rgba(245,158,11,0.85), rgba(202,138,4,0.9))' : 'transparent',
              color: tab === 'global' ? '#fff' : '#4B5563',
              boxShadow: tab === 'global' ? '0 2px 12px rgba(245,158,11,0.35)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}><Icon name="globe" size={13} />Глобальный</button>
            <button onClick={() => setTab('regional')} style={{
              flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
              background: tab === 'regional' ? 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(79,70,229,0.9))' : 'transparent',
              color: tab === 'regional' ? '#fff' : '#4B5563',
              boxShadow: tab === 'regional' ? '0 2px 12px rgba(99,102,241,0.3)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
              {user?.region ? <><Flag code={user.region} size={11} />Региональный</> : <><Icon name="pin" size={13} />Региональный</>}
            </button>
          </div>

          {/* ── NO REGION ── */}
          {tab === 'regional' && !user?.region && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ marginBottom: 10, color: '#4B5563', display: 'flex', justifyContent: 'center' }}><Icon name="pin" size={44} strokeWidth={1.5} /></div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Регион не выбран</div>
              <div style={{ fontSize: 12, color: '#4B5563' }}>Выбери регион в настройках профиля</div>
            </motion.div>
          )}

          {/* ── PODIUM ── */}
          {(tab === 'global' || (tab === 'regional' && user?.region)) && podium[0] && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.04 }}>
              <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3))' }} />
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="trophy" size={12} color="#F59E0B" />ТОП-3</span>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(245,158,11,0.3), transparent)' }} />
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                {podium[1] && <PodiumCard p={podium[1]} pos={2} delay={0.12} isChallenger={isChall(podium[1])} />}
                {podium[0] && <PodiumCard p={podium[0]} pos={1} delay={0.06} isChallenger={isChall(podium[0])} />}
                {podium[2] && <PodiumCard p={podium[2]} pos={3} delay={0.18} isChallenger={isChall(podium[2])} />}
              </div>
            </motion.div>
          )}

          {/* ── REST ── */}
          {rest.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                Остальные игроки
                <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {rest.map((p, i) => (
                  <PlayerRow key={p.id} p={p} delay={0.01 + Math.min(i, 14) * 0.02} isMe={p.id === user?.id} isChallenger={isChall(p)} />
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div style={{ marginTop: 20 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <motion.div key={i}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
                  style={{ height: 68, borderRadius: 16, marginBottom: 7, background: '#0f0f15', border: '1px solid rgba(255,255,255,0.06)' }}
                />
              ))}
            </div>
          )}
          </>)}

        </div>
      </div>
    </RequireRegistration>
  )
}
