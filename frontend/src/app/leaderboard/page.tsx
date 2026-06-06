'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence, useSpring, useMotionValue, useTransform } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCached, setCached } from '@/lib/cache'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Avatar } from '@/components/ui/Avatar'
import { EloRing } from '@/components/ui/EloRing'
import { getEloRank } from '@/lib/eloRank'
import { countryFlag } from '@/lib/regions'

interface Entry {
  rank: number; id: number
  gameNickname: string | null; username: string | null; firstName: string
  avatarUrl: string | null; elo: number; matchesPlayed: number
  winRate: number; level: number; isPremium: boolean; region?: string | null
}

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
  1: { color: '#FFD700', dim: '#B8860B', glow: 'rgba(255,215,0,0.5)', height: 110, icon: '👑', label: '1ST' },
  2: { color: '#E2E8F0', dim: '#94A3B8', glow: 'rgba(226,232,240,0.35)', height: 82, icon: '🥈', label: '2ND' },
  3: { color: '#F97316', dim: '#C2410C', glow: 'rgba(249,115,22,0.35)', height: 64, icon: '🥉', label: '3RD' },
} as const

// ── Podium card ───────────────────────────────────────────────────────────────
function PodiumCard({ p, pos, delay }: { p: Entry; pos: 1 | 2 | 3; delay: number }) {
  const router = useRouter()
  const { user } = useAuthStore()
  const isMe = p.id === user?.id
  const m = MEDALS[pos]
  const rank = getEloRank(p.elo)

  return (
    <motion.button
      initial={{ opacity: 0, y: 40 + (pos === 1 ? 0 : 20) }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 220, damping: 22 }}
      whileTap={{ scale: 0.95 }}
      onClick={() => router.push(`/player/${p.id}`)}
      style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}
    >
      {/* Crown for #1 */}
      {pos === 1 && (
        <motion.div
          animate={{ y: [0, -5, 0], rotate: [-3, 3, -3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          style={{ fontSize: 22, marginBottom: 2 }}
        >👑</motion.div>
      )}
      {pos !== 1 && <div style={{ height: 28 }} />}

      {/* Avatar with spinning ring — outer div for badge, inner for clip */}
      <div style={{ position: 'relative', marginBottom: 8, display: 'inline-block' }}>
        {/* Clipping container — clips the conic ring to a perfect circle */}
        <motion.div
          animate={{ boxShadow: [`0 0 12px ${m.glow}`, `0 0 28px ${m.glow}`, `0 0 12px ${m.glow}`] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{
            position: 'relative',
            width: pos === 1 ? 64 : 52,
            height: pos === 1 ? 64 : 52,
            borderRadius: '50%',
            overflow: 'hidden',
          }}
        >
          {/* Spinning ring inside clip */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 12 - pos * 2, repeat: Infinity, ease: 'linear' }}
            style={{
              position: 'absolute', inset: -3,
              background: `conic-gradient(${m.color} 0deg, ${m.dim} 120deg, ${m.color} 240deg, transparent 280deg, ${m.color} 360deg)`,
              opacity: 0.6,
            }}
          />
          {/* Avatar on top */}
          <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', overflow: 'hidden' }}>
            <Avatar
              avatarUrl={p.avatarUrl} name={p.gameNickname || p.firstName}
              size={pos === 1 ? 58 : 46}
              style={{ width: '100%', height: '100%', borderRadius: '50%' }}
            />
          </div>
        </motion.div>

        {/* "Я" badge outside clip so it's not cropped */}
        {isMe && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0, zIndex: 2,
            background: '#E8092E', borderRadius: '50%',
            width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7, color: '#fff', fontWeight: 900,
          }}>я</div>
        )}
      </div>

      {/* Name */}
      <div style={{
        fontSize: pos === 1 ? 12 : 11, fontWeight: 900, color: '#fff',
        maxWidth: 84, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        marginBottom: 2, display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center',
      }}>
        {p.region && <span style={{ flexShrink: 0 }}>{countryFlag(p.region)}</span>}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.gameNickname || p.firstName}</span>
        {p.isPremium && <span style={{ flexShrink: 0, fontSize: 10 }}>⭐</span>}
      </div>

      {/* ELO */}
      <div style={{ fontSize: pos === 1 ? 14 : 12, fontWeight: 900, color: m.color, marginBottom: 6, letterSpacing: '-0.5px' }}>
        {p.elo.toLocaleString()}
      </div>

      {/* Podium block */}
      <div style={{
        width: '100%', height: m.height, borderRadius: '12px 12px 0 0',
        background: `linear-gradient(180deg, ${m.color}1a 0%, ${m.color}06 100%)`,
        border: `1px solid ${m.color}25`, borderBottom: 'none',
        position: 'relative', overflow: 'hidden',
        boxShadow: `0 -6px 30px ${m.glow}, inset 0 1px 0 ${m.color}30`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10, gap: 2,
      }}>
        {/* Shimmer */}
        <motion.div
          animate={{ x: ['-100%', '250%'] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 3 + pos }}
          style={{
            position: 'absolute', top: 0, bottom: 0, width: '35%',
            background: `linear-gradient(90deg, transparent, ${m.color}12, transparent)`,
          }}
        />
        <span style={{ fontSize: 20, fontWeight: 900, color: m.color, opacity: 0.5, letterSpacing: '-1px' }}>{pos}</span>
        <span style={{ fontSize: 8, fontWeight: 900, color: m.color, opacity: 0.5, letterSpacing: '0.1em' }}>{m.label}</span>
      </div>
    </motion.button>
  )
}

// ── Player row ────────────────────────────────────────────────────────────────
function PlayerRow({ p, delay, isMe }: { p: Entry; delay: number; isMe: boolean }) {
  const router = useRouter()
  const cardRef = useRef<HTMLDivElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)
  const rank = getEloRank(p.elo)
  const isChallenger = p.rank <= 5

  const track = (cx: number, cy: number) => {
    const el = cardRef.current; const sh = shineRef.current
    if (!el || !sh) return
    const r = el.getBoundingClientRect()
    const x = (cx - r.left) / r.width - 0.5, y = (cy - r.top) / r.height - 0.5
    el.style.transform = `perspective(500px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg) scale(1.01)`
    sh.style.background = `radial-gradient(circle at ${(x+.5)*100}% ${(y+.5)*100}%, rgba(255,255,255,0.09) 0%, transparent 55%)`
  }
  const reset = () => {
    const el = cardRef.current; const sh = shineRef.current
    if (el) el.style.transform = 'perspective(500px) rotateX(0) rotateY(0) scale(1)'
    if (sh) sh.style.background = 'none'
  }

  const accentColor = isMe ? '#E8092E' : rank.color
  const eloBarPct = Math.min(100, ((p.elo - 100) / (3000 - 100)) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
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
          background: isMe ? 'rgba(232,9,46,0.07)' : 'rgba(255,255,255,0.03)',
          border: `1px solid ${isMe ? 'rgba(232,9,46,0.28)' : `${rank.color}12`}`,
          position: 'relative', overflow: 'hidden',
          transition: 'transform 0.14s ease', willChange: 'transform',
          boxShadow: isMe ? '0 0 20px rgba(232,9,46,0.08)' : 'none',
        }}
      >
        {/* Shine overlay */}
        <div ref={shineRef} style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', transition: 'background 0.08s' }} />

        {/* Top color line */}
        <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, background: `linear-gradient(90deg, transparent, ${accentColor}44, transparent)` }} />

        {/* Rank number */}
        <div style={{ width: 26, textAlign: 'center', flexShrink: 0 }}>
          {isChallenger ? (
            <motion.span
              animate={{ textShadow: [`0 0 6px ${rank.color}`, `0 0 14px ${rank.color}`, `0 0 6px ${rank.color}`] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ fontSize: 12, fontWeight: 900, color: rank.color }}
            >#{p.rank}</motion.span>
          ) : (
            <span style={{ color: '#374151', fontSize: 11, fontWeight: 700 }}>#{p.rank}</span>
          )}
        </div>

        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar
            avatarUrl={p.avatarUrl} name={p.gameNickname || p.firstName} size={40}
            style={{ border: `1.5px solid ${accentColor}30`, borderRadius: '50%' }}
          />
          {/* ELO level pip */}
          <div style={{
            position: 'absolute', bottom: -2, right: -2,
            width: 16, height: 16, borderRadius: '50%',
            background: 'rgba(6,6,8,0.85)', border: `1.5px solid ${rank.color}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 900, color: rank.color,
            backdropFilter: 'blur(4px)',
          }}>{rank.level}</div>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            {p.region && <span style={{ fontSize: 12, flexShrink: 0 }}>{countryFlag(p.region)}</span>}
            <span style={{
              fontWeight: 800, fontSize: 13, color: isMe ? '#fff' : '#E5E7EB',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{p.gameNickname || p.firstName}</span>
            {p.isPremium && <span style={{ fontSize: 10, flexShrink: 0, color: '#EAB308' }}>⭐</span>}
            {isMe && <span style={{ fontSize: 9, color: '#E8092E', fontWeight: 800, background: 'rgba(232,9,46,0.12)', padding: '1px 5px', borderRadius: 8, flexShrink: 0 }}>ВЫ</span>}
          </div>

          {/* ELO progress bar */}
          <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 3 }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${eloBarPct}%` }}
              transition={{ duration: 0.9, ease: 'easeOut', delay }}
              style={{
                height: '100%', borderRadius: 2,
                background: `linear-gradient(90deg, ${rank.color}88, ${rank.color})`,
                boxShadow: `0 0 6px ${rank.color}60`,
              }}
            />
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 9, fontWeight: 800, color: rank.color,
              background: `${rank.color}12`, padding: '1px 6px', borderRadius: 8,
              border: `1px solid ${rank.color}22`,
            }}>{rank.label}</span>
            <span style={{ fontSize: 9, color: '#4B5563' }}>{p.winRate}% WR</span>
            <span style={{ fontSize: 9, color: '#374151' }}>{p.matchesPlayed} игр</span>
          </div>
        </div>

        {/* ELO + Ring */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 900, color: accentColor,
            letterSpacing: '-0.5px', lineHeight: 1, marginBottom: 3,
            textShadow: isChallenger ? `0 0 10px ${rank.color}` : 'none',
          }}>
            {p.elo.toLocaleString()}
          </div>
          <EloRing elo={p.elo} size={30} isChallenger={isChallenger} showLabel={false} />
        </div>
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function LeaderboardPage() {
  const [tab, setTab] = useState<'global' | 'regional'>('global')
  const [players, setPlayers]     = useState<Entry[]>(() => getCached<Entry[]>('leaderboard') ?? [])
  const [regional, setRegional]   = useState<Entry[]>([])
  const [myRank, setMyRank]       = useState<number | null>(() => getCached<number>('leaderboard-rank'))
  const [loading, setLoading]     = useState(!players.length)
  const { user } = useAuthStore()

  useEffect(() => {
    api.get('/leaderboard').then(r => { setPlayers(r.data); setCached('leaderboard', r.data); setLoading(false) })
    api.get('/leaderboard/rank').then(r => { setMyRank(r.data); setCached('leaderboard-rank', r.data) })
  }, [])

  useEffect(() => {
    if (tab === 'regional' && user?.region)
      api.get(`/leaderboard/regional?region=${user.region}`).then(r => setRegional(r.data)).catch(() => {})
  }, [tab, user?.region])

  const list = tab === 'regional' ? regional : players
  const podium = [list.find(p => p.rank === 1), list.find(p => p.rank === 2), list.find(p => p.rank === 3)]
  const rest   = list.filter(p => p.rank > 3)

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 96 }}>
        <div style={{ padding: '0 16px', position: 'relative', zIndex: 1 }}>

          {/* ── HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{ paddingTop: 24, marginBottom: 6 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <motion.div
                  animate={{ rotate: [0, -5, 5, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                    background: 'linear-gradient(135deg, rgba(245,158,11,0.3), rgba(234,179,8,0.15))',
                    border: '1px solid rgba(245,158,11,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}
                >🏆</motion.div>
                <div>
                  <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.8px', lineHeight: 1 }}>
                    Рейтинг
                  </h1>
                  {players.length > 0 && (
                    <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>
                      {players.length} игроков · сезон 1
                    </div>
                  )}
                </div>
              </div>

              {/* My rank */}
              {myRank && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7, rotate: -10 }}
                  animate={{ opacity: 1, scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: 'spring', stiffness: 350, damping: 22 }}
                  style={{
                    textAlign: 'center',
                    background: 'rgba(232,9,46,0.1)',
                    border: '1px solid rgba(232,9,46,0.3)',
                    borderRadius: 14, padding: '8px 16px',
                    boxShadow: '0 0 20px rgba(232,9,46,0.12)',
                  }}
                >
                  <div style={{ fontSize: 9, color: '#E8092E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Ваш ранг</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#E8092E', lineHeight: 1.1, letterSpacing: '-1px' }}>
                    #{myRank}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 5,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, padding: 4,
            }}>
              <button onClick={() => setTab('global')} style={{
                flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
                background: tab === 'global' ? 'linear-gradient(135deg, rgba(245,158,11,0.85), rgba(202,138,4,0.9))' : 'transparent',
                color: tab === 'global' ? '#fff' : '#4B5563',
                boxShadow: tab === 'global' ? '0 2px 12px rgba(245,158,11,0.35)' : 'none',
              }}>🌍 Глобальный</button>
              <button onClick={() => setTab('regional')} style={{
                flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, transition: 'all 0.2s',
                background: tab === 'regional' ? 'linear-gradient(135deg, rgba(99,102,241,0.85), rgba(79,70,229,0.9))' : 'transparent',
                color: tab === 'regional' ? '#fff' : '#4B5563',
                boxShadow: tab === 'regional' ? '0 2px 12px rgba(99,102,241,0.3)' : 'none',
              }}>
                {user?.region ? `${countryFlag(user.region)} Региональный` : '📍 Региональный'}
              </button>
            </div>
          </motion.div>

          {/* ── NO REGION ── */}
          {tab === 'regional' && !user?.region && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ textAlign: 'center', padding: '60px 20px' }}
            >
              <div style={{ fontSize: 44, marginBottom: 10 }}>📍</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6 }}>Регион не выбран</div>
              <div style={{ fontSize: 12, color: '#4B5563' }}>Выбери регион в настройках профиля</div>
            </motion.div>
          )}

          {/* ── PODIUM ── */}
          {(tab === 'global' || (tab === 'regional' && user?.region)) && podium[0] && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.04 }}
            >
              <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, marginTop: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(245,158,11,0.3))' }} />
                🏆 ТОП-3
                <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(245,158,11,0.3), transparent)' }} />
              </div>

              {/* Podium: 2 | 1 | 3 */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, paddingBottom: 0 }}>
                {podium[1] && <PodiumCard p={podium[1]} pos={2} delay={0.12} />}
                {podium[0] && <PodiumCard p={podium[0]} pos={1} delay={0.06} />}
                {podium[2] && <PodiumCard p={podium[2]} pos={3} delay={0.18} />}
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

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rest.map((p, i) => (
                  <PlayerRow
                    key={p.id} p={p}
                    delay={0.01 + Math.min(i, 14) * 0.02}
                    isMe={p.id === user?.id}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div style={{ marginTop: 20 }}>
              {Array.from({ length: 7 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12 }}
                  style={{
                    height: 66, borderRadius: 16, marginBottom: 6,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}
                />
              ))}
            </div>
          )}

        </div>
      </div>
    </RequireRegistration>
  )
}
