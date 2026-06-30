'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { EloRing } from '@/components/ui/EloRing'
import { EloChart } from '@/components/ui/EloChart'
import { ReportModal } from '@/components/reports/ReportModal'
import { MatchCard } from '@/components/ui/MatchCard'
import { getEloRank, getRankProgress, ELO_RANKS, CHALLENGER_RANK, qualifiesChallenger } from '@/lib/eloRank'
import { Flag } from '@/components/ui/Flag'
import { Icon, IconName } from '@/components/ui/Icon'

interface PublicProfile {
  id: number
  gameNickname: string | null
  gameId: string | null
  firstName: string
  username: string | null
  avatarUrl: string | null
  elo: number
  level: number
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  kdr: number
  winRate: number
  avgKills: number
  ratingOverall: number
  isPremium: boolean
  isVerified: boolean
  isAdmin: boolean
  warns: number
  friendStatus: 'none' | 'friends' | 'pending_sent' | 'pending_received'
  region?: string | null
}

// ── Skeleton loader ───────────────────────────────────────────────────────────
function Skeleton({ w = '100%', h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <motion.div
      animate={{ opacity: [0.3, 0.6, 0.3] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{ width: w, height: h, borderRadius: r, background: 'rgba(255,255,255,0.07)' }}
    />
  )
}

function LoadingSkeleton() {
  return (
    <div style={{ padding: '0 16px', paddingTop: 20 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <Skeleton w={36} h={36} r={10} />
        <Skeleton w={120} h={36} r={10} />
      </div>
      <div style={{ borderRadius: 20, padding: 20, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 16 }}>
          <Skeleton w={80} h={80} r={40} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton w="60%" h={22} r={6} />
            <Skeleton w="40%" h={14} r={6} />
            <Skeleton w="50%" h={20} r={20} />
          </div>
          <Skeleton w={60} h={60} r={30} />
        </div>
        <Skeleton h={5} r={3} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
        {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={64} r={14} />)}
      </div>
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value, color, icon, delay = 0 }: {
  label: string; value: string | number; color: string; icon: IconName; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        background: 'rgba(255,255,255,0.04)', border: `1px solid ${color}18`,
        borderRadius: 14, padding: '12px 8px', textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: `linear-gradient(90deg, transparent, ${color}55, transparent)` }} />
      <div style={{ marginBottom: 4, display: 'flex', justifyContent: 'center' }}><Icon name={icon} size={15} color={color} /></div>
      <div style={{ fontSize: 15, fontWeight: 900, color, letterSpacing: '-0.3px', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PlayerPage() {
  const { id } = useParams()
  const router = useRouter()
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<PublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [playerRank, setPlayerRank] = useState<number | null>(null)
  const [showAvatar, setShowAvatar] = useState(false)
  const [recentMatches, setRecentMatches] = useState<any[]>([])

  const isMe = user?.id === Number(id)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.get(`/users/${id}/public`),
      api.get(`/users/${id}/rank`).catch(() => ({ data: null })),
    ]).then(([profileRes, rankRes]) => {
      setProfile(profileRes.data)
      setPlayerRank(rankRes.data)
    }).catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false))
    api.get(`/matches/history?page=1&limit=5&userId=${id}`).then(r => setRecentMatches(r.data.matches || [])).catch(() => {})
  }, [id])

  const sendRequest = async () => {
    setActionLoading(true)
    try { await api.post(`/users/${id}/friend/request`); setProfile(p => p ? { ...p, friendStatus: 'pending_sent' } : p) }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setActionLoading(false) }
  }

  const acceptRequest = async () => {
    setActionLoading(true)
    try { await api.post(`/users/${id}/friend/accept`); setProfile(p => p ? { ...p, friendStatus: 'friends' } : p) }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setActionLoading(false) }
  }

  const removeFriend = async () => {
    setActionLoading(true)
    try { await api.delete(`/users/${id}/friend`); setProfile(p => p ? { ...p, friendStatus: 'none' } : p) }
    catch {} finally { setActionLoading(false) }
  }

  if (loading) return <LoadingSkeleton />
  if (!profile) return null

  const rank = getEloRank(profile.elo)
  const calibrating = (profile.matchesPlayed ?? 0) < 10
  const isChallenger = !calibrating && qualifiesChallenger(profile.elo, playerRank)
  const theme = isChallenger ? CHALLENGER_RANK : rank
  const accent = calibrating ? '#EAB308' : theme.color
  const displayName = profile.gameNickname || profile.firstName
  const warns = profile.warns ?? 0
  const rankProg = Math.round(getRankProgress(profile.elo) * 100)
  const nextRank = ELO_RANKS.find(r => r.min > profile.elo) || null
  const eloToNext = nextRank ? nextRank.min - profile.elo : 0
  const GREEN = '#22C55E', YELLOW = '#EAB308', RED = '#EF4444', GREY = '#6B7280'
  const ratingVal = Number(profile.ratingOverall ?? 0)
  const kdVal = Number(profile.kdr ?? 0)
  const avgVal = Number(profile.avgKills ?? 0)
  const ratingColor = ratingVal > 1.1 ? GREEN : ratingVal >= 0.9 ? YELLOW : RED
  const kdColor = kdVal > 1.1 ? GREEN : kdVal >= 0.9 ? YELLOW : RED
  const avgColor = avgVal > 16 ? GREEN : avgVal >= 11 ? YELLOW : RED
  const ratingLabel = ratingColor === GREEN ? 'Отличная форма' : ratingColor === YELLOW ? 'Стабильно' : 'Можно лучше'

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 32 }}>
      <div style={{ padding: '0 16px', position: 'relative', zIndex: 1 }}>

        {/* ── TOP BAR ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20, marginBottom: 16 }}
        >
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => router.back()}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '7px 12px 7px 10px', color: '#9CA3AF', fontSize: 12,
              cursor: 'pointer', fontWeight: 700,
            }}
          >
            <Icon name="chevronLeft" size={15} />Назад
          </motion.button>
          <div style={{ fontSize: 11, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Профиль игрока
          </div>
        </motion.div>

        {/* ── HERO CARD ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 26, delay: 0.03 }}
          style={{
            borderRadius: 22, padding: 18, marginBottom: 14,
            background: `linear-gradient(150deg, ${theme.color}20 0%, rgba(8,8,11,0.96) 55%, ${theme.color}12 100%)`,
            border: `1px solid ${theme.color}30`,
            position: 'relative', overflow: 'hidden',
            boxShadow: `0 12px 44px ${theme.color}16`,
          }}
        >
          <div style={{ position: 'absolute', top: -70, left: -50, width: 200, height: 200, background: `radial-gradient(circle, ${theme.color}33, transparent 70%)`, pointerEvents: 'none' }} />
          <motion.div animate={{ x: ['-100%', '220%'] }} transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 7 }}
            style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: `linear-gradient(90deg, transparent, ${theme.color}14, transparent)`, pointerEvents: 'none' }} />

          {/* Centered identity */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
            <motion.div
              whileTap={{ scale: 0.93 }}
              onClick={() => profile.avatarUrl && setShowAvatar(true)}
              style={{ position: 'relative', width: 112, height: 112, cursor: profile.avatarUrl ? 'pointer' : 'default' }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from 0deg, ${theme.color}, ${theme.color}1f, ${theme.color}, ${theme.color}1f, ${theme.color})`, boxShadow: `0 0 22px ${theme.color}44` }}
              />
              <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', overflow: 'hidden', background: '#0a0a0e' }}>
                <Avatar avatarUrl={profile.avatarUrl} name={displayName} size={104} style={{ borderRadius: '50%' }} />
                {profile.avatarUrl && (
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', opacity: 0, transition: 'opacity 0.2s',
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.45)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)' }}
                  ><Icon name="search" size={22} /></div>
                )}
              </div>
            </motion.div>

            {/* Name */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 18, justifyContent: 'center', maxWidth: '100%' }}>
              {profile.region && <Flag code={profile.region} size={16} />}
              <h2 style={{
                fontSize: 24, fontWeight: 900, color: '#fff', margin: 0,
                letterSpacing: '-0.6px', lineHeight: 1.1, textAlign: 'center',
                overflowWrap: 'anywhere', wordBreak: 'break-word',
                textShadow: `0 2px 24px ${theme.color}55`,
              }}>
                {displayName}
              </h2>
              {profile.isVerified && <Icon name="verified" size={20} style={{ flexShrink: 0 }} />}
            </div>

            {/* Username / Game ID */}
            {(profile.username || profile.gameId) && (
              <div style={{ fontSize: 12, color: '#4B5563', marginTop: 5, display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {profile.username && (
                  <a href={`https://t.me/${profile.username}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: '#60A5FA', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.04 9.615c-.154.68-.555.847-1.124.527l-3.1-2.284-1.495 1.438c-.165.165-.304.304-.624.304l.222-3.168 5.76-5.202c.25-.222-.054-.346-.388-.124L7.26 14.294l-3.046-.95c-.662-.207-.675-.662.138-.98l11.9-4.59c.552-.2 1.035.135.31 1.474z"/>
                    </svg>
                    @{profile.username}
                  </a>
                )}
                {profile.username && profile.gameId && <span>·</span>}
                {profile.gameId && `ID: ${profile.gameId}`}
                {profile.isAdmin && <span style={{ fontSize: 9, background: 'rgba(232,9,46,0.2)', color: '#E8092E', padding: '2px 6px', borderRadius: 6, fontWeight: 800 }}>ADM</span>}
              </div>
            )}

            {/* Rank emblem — большой ранг-орб */}
            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 22 }}
              style={{
                marginTop: 14, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center',
                background: `linear-gradient(135deg, ${theme.color}16, rgba(255,255,255,0.02))`,
                border: `1px solid ${theme.color}33`, borderRadius: 18, padding: '12px 20px',
                position: 'relative', overflow: 'hidden', boxShadow: `0 8px 26px ${theme.color}1a`,
              }}
            >
              <div style={{ position: 'absolute', left: -24, top: -24, width: 130, height: 130, background: `radial-gradient(circle, ${theme.color}2e, transparent 70%)`, pointerEvents: 'none' }} />
              <motion.div
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ filter: `drop-shadow(0 0 14px ${theme.color}77)`, position: 'relative', flexShrink: 0 }}
              >
                <EloRing elo={profile.elo} size={72} isChallenger={isChallenger} showLabel={false} calibrating={calibrating} />
              </motion.div>
              <div style={{ textAlign: 'left', position: 'relative' }}>
                <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>Ранг игрока</div>
                {calibrating ? (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 900, color: accent, lineHeight: 1 }}>
                      Калибровка
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1 }}>{profile.matchesPlayed}<span style={{ fontSize: 14, color: '#6B7280' }}>/10</span></span>
                      <span style={{ fontSize: 11, color: accent, fontWeight: 800, textTransform: 'uppercase' }}>матчей</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 900, color: theme.color, lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {isChallenger ? <><Icon name="crown" size={16} />Challenger</> : theme.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1 }}>{profile.elo.toLocaleString()}</span>
                      <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>ELO</span>
                      {playerRank && <span style={{ fontSize: 11, color: theme.color, fontWeight: 800 }}>#{playerRank}</span>}
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Warns */}
            {warns > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
                {[1, 2, 3].map(n => (
                  <div key={n} style={{
                    width: 14, height: 14,
                    clipPath: 'polygon(50% 0%,0% 100%,100% 100%)',
                    background: n <= warns ? (warns >= 3 ? '#EF4444' : '#F59E0B') : 'rgba(255,255,255,0.07)',
                  }} />
                ))}
                <span style={{ fontSize: 10, color: warns >= 3 ? '#EF4444' : '#F59E0B', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {warns >= 3 ? <><Icon name="ban" size={11} />Забанен</> : `${warns}/3 варна`}
                </span>
              </div>
            )}
          </div>

          {/* Прогресс: ранг или калибровка */}
          <div style={{ marginTop: 18, position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 10, color: '#6B7280', fontWeight: 600 }}>
              {calibrating ? (
                <>
                  <span style={{ color: accent }}>Калибровка</span>
                  <span>Осталось матчей: {10 - profile.matchesPlayed}</span>
                </>
              ) : (
                <>
                  <span style={{ color: theme.color }}>{theme.label}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {nextRank ? `${eloToNext} ELO до ${nextRank.label}` : <><Icon name="crown" size={11} />Макс. ранг</>}
                  </span>
                </>
              )}
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${calibrating ? Math.round((profile.matchesPlayed / 10) * 100) : (nextRank ? rankProg : 100)}%` }}
                transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${accent}aa, ${accent})`, boxShadow: `0 0 10px ${accent}88` }}
              />
            </div>
          </div>
        </motion.div>

        {/* ── STATS ── */}
        <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          Статистика
        </div>

        {/* Wide rating tile */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.04 }}
          style={{
            position: 'relative', overflow: 'hidden',
            background: `linear-gradient(135deg, ${ratingColor}18, #0f0f15 60%)`,
            border: `1px solid ${ratingColor}40`, borderRadius: 18,
            padding: '16px 18px', marginBottom: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            boxShadow: `0 8px 30px ${ratingColor}14`,
          }}
        >
          <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: ratingColor }} />
          <div style={{ position: 'absolute', right: -30, top: -30, width: 130, height: 130, background: `radial-gradient(circle, ${ratingColor}22, transparent 70%)`, pointerEvents: 'none' }} />
          <div>
            <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="star" size={13} color={ratingColor} />Рейтинг
            </div>
            <div style={{ fontSize: 38, fontWeight: 900, color: ratingColor, letterSpacing: '-1.5px', lineHeight: 1.05, marginTop: 4 }}>
              {ratingVal.toFixed(2)}
            </div>
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, color: ratingColor, background: `${ratingColor}1a`, border: `1px solid ${ratingColor}33`, padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap' }}>
            {ratingLabel}
          </div>
        </motion.div>

        {/* Skill tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <StatChip label="K/D" value={kdVal.toFixed(2)}  color={kdColor}  icon="swords" delay={0.08} />
          <StatChip label="AVG" value={String(Math.round(avgVal))} color={avgColor} icon="skull"  delay={0.11} />
        </div>

        {/* Volume tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          <StatChip label="Матчи"   value={profile.matchesPlayed} color={GREY} icon="gamepad" delay={0.14} />
          <StatChip label="Победы"  value={profile.matchesWon}    color={GREY} icon="trophy" delay={0.17} />
          <StatChip label="Винрейт" value={`${profile.winRate}%`} color={GREY} icon="trendingUp" delay={0.20} />
        </div>

        {/* ── W/L BAR ── */}
        {(profile.matchesWon + profile.matchesLost) > 0 && (() => {
          const total = profile.matchesWon + profile.matchesLost
          const wPct  = (profile.matchesWon / total) * 100
          return (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              style={{
                marginBottom: 14, background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
                <span style={{ color: '#22C55E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="trophy" size={12} />{profile.matchesWon} побед</span>
                <span style={{ fontWeight: 600 }}>{profile.winRate}% WR</span>
                <span style={{ color: '#EF4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{profile.matchesLost} поражений<Icon name="skull" size={12} /></span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${wPct}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.35 }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, #16a34a, #22C55E)', borderRadius: '3px 0 0 3px' }}
                />
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${100 - wPct}%` }}
                  transition={{ duration: 0.9, ease: 'easeOut', delay: 0.35 }}
                  style={{ height: '100%', background: 'linear-gradient(90deg, #E8092E, #b91c1c)', borderRadius: '0 3px 3px 0' }}
                />
              </div>
            </motion.div>
          )
        })()}

        {/* ── ELO CHART ── */}
        <EloChart userId={profile.id} currentElo={profile.elo} />

        {/* ── RECENT MATCHES ── */}
        {recentMatches.length > 0 && (
          <div style={{ marginTop: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Последние матчи
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentMatches.map((m, i) => (
                <MatchCard key={m.matchId} m={m} fallbackElo={profile.elo} delay={i * 0.05} />
              ))}
            </div>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push(isMe ? '/history' : `/history?userId=${profile.id}`)}
              style={{
                width: '100%', marginTop: 10, padding: '13px 0', borderRadius: 14, border: 'none',
                background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
                color: '#60A5FA', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              } as any}
            >
              <Icon name="barChart" size={15} />Посмотреть все матчи
            </motion.button>
          </div>
        )}

        {/* ── ACTION BUTTONS ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >

          {/* Friend status */}
          <AnimatePresence mode="wait">
            {!isMe && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.97 }}
                key={profile.friendStatus}
              >
                {profile.friendStatus === 'none' && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={sendRequest}
                    disabled={actionLoading}
                    style={{
                      width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                      background: `linear-gradient(135deg, ${rank.color}cc, ${rank.color}99)`,
                      color: '#fff', fontWeight: 900, fontSize: 14, cursor: actionLoading ? 'default' : 'pointer',
                      opacity: actionLoading ? 0.5 : 1,
                      boxShadow: `0 4px 20px ${rank.color}40`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {actionLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                      />
                    ) : <Icon name="plus" size={16} />} Добавить в друзья
                  </motion.button>
                )}

                {profile.friendStatus === 'pending_sent' && (
                  <div style={{
                    width: '100%', padding: '14px 0', borderRadius: 14, textAlign: 'center',
                    fontWeight: 700, color: '#9CA3AF', fontSize: 13,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}>
                    <Icon name="hourglass" size={14} />Запрос отправлен
                  </div>
                )}

                {profile.friendStatus === 'pending_received' && (
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={acceptRequest}
                    disabled={actionLoading}
                    style={{
                      width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                      background: 'linear-gradient(135deg, #16a34a, #22C55E)',
                      color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(34,197,94,0.3)',
                      opacity: actionLoading ? 0.5 : 1,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    <Icon name="check" size={16} />Принять запрос в друзья
                  </motion.button>
                )}

                {profile.friendStatus === 'friends' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{
                      flex: 1, padding: '13px 0', borderRadius: 14, textAlign: 'center', fontWeight: 800,
                      background: 'rgba(34,197,94,0.1)', color: '#4ADE80',
                      border: '1px solid rgba(34,197,94,0.25)', fontSize: 13,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                      <Icon name="check" size={14} />В друзьях
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={removeFriend}
                      disabled={actionLoading}
                      style={{
                        padding: '13px 16px', borderRadius: 14,
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                        color: '#4B5563', fontSize: 12, cursor: 'pointer', fontWeight: 700,
                      }}
                    >
                      Удалить
                    </motion.button>
                  </div>
                )}
              </motion.div>
            )}

            {isMe && (
              <motion.button
                key="edit"
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push('/profile')}
                style={{
                  width: '100%', padding: '14px 0', borderRadius: 14, border: 'none',
                  background: 'linear-gradient(135deg, rgba(232,9,46,0.9), rgba(180,0,30,0.95))',
                  color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(232,9,46,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <Icon name="pencil" size={15} />Редактировать профиль
              </motion.button>
            )}
          </AnimatePresence>

          {/* Report */}
          {!isMe && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowReport(true)}
              style={{
                width: '100%', padding: '11px 0', borderRadius: 14,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: 'rgba(255,255,255,0.02)', color: '#374151',
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              <Icon name="warning" size={13} />Пожаловаться
            </motion.button>
          )}
        </motion.div>

      </div>

      {showReport && profile && (
        <ReportModal
          reportedId={profile.id}
          reportedName={displayName}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* Avatar fullscreen viewer */}
      <AnimatePresence>
        {showAvatar && profile?.avatarUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowAvatar(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100,
              background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(12px)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              onClick={e => e.stopPropagation()}
              style={{ position: 'relative', maxWidth: 320, width: '100%' }}
            >
              {/* Close */}
              <button
                onClick={() => setShowAvatar(false)}
                style={{
                  position: 'absolute', top: -40, right: 0,
                  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '50%', width: 32, height: 32,
                  color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              ><Icon name="x" size={16} /></button>

              {/* Full avatar */}
              <img
                src={profile.avatarUrl}
                alt={displayName}
                style={{ width: '100%', borderRadius: 16, display: 'block', border: `2px solid ${rank.color}40` }}
              />

              {/* Name */}
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 16, fontWeight: 800, color: '#fff' }}>
                {displayName}
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
