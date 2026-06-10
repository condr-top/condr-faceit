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
import { getEloRank } from '@/lib/eloRank'
import { Flag } from '@/components/ui/Flag'

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
  label: string; value: string | number; color: string; icon: string; delay?: number
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
      <div style={{ fontSize: 14, marginBottom: 3 }}>{icon}</div>
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
  const isChallenger = playerRank !== null && playerRank <= 5
  const displayName = profile.gameNickname || profile.firstName
  const warns = profile.warns ?? 0

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
              borderRadius: 10, padding: '7px 14px', color: '#9CA3AF', fontSize: 12,
              cursor: 'pointer', fontWeight: 700,
            }}
          >
            ← Назад
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
            borderRadius: 20, padding: '18px 16px 16px', marginBottom: 14,
            background: `linear-gradient(135deg, ${rank.color}12 0%, rgba(6,6,8,0.96) 55%, rgba(99,102,241,0.06) 100%)`,
            border: `1px solid ${rank.color}22`,
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Shimmer */}
          <motion.div
            animate={{ x: ['-100%', '220%'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 10 }}
            style={{
              position: 'absolute', top: 0, bottom: 0, width: '28%',
              background: `linear-gradient(90deg, transparent, ${rank.color}08, transparent)`,
              pointerEvents: 'none',
            }}
          />

          {/* Top row: avatar + info + EloRing */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <motion.div
              whileTap={{ scale: 0.92 }}
              style={{ position: 'relative', flexShrink: 0, cursor: 'pointer' }}
              onClick={() => profile.avatarUrl && setShowAvatar(true)}
            >
              <Avatar avatarUrl={profile.avatarUrl} name={displayName} size={64}
                style={{ border: `2px solid ${rank.color}40`, borderRadius: '50%' }} />
              {profile.avatarUrl && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(0,0,0,0)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, opacity: 0, transition: 'opacity 0.2s',
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.4)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0)' }}
                >🔍</div>
              )}
              <div style={{
                position: 'absolute', bottom: -4, right: -4,
                background: '#060608', border: `2px solid ${rank.color}60`,
                borderRadius: 20, padding: '1px 6px',
                fontSize: 9, fontWeight: 900, color: rank.color, whiteSpace: 'nowrap',
              }}>
                {rank.level}
              </div>
            </motion.div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Name row — badges wrap below if needed */}
              <div style={{ marginBottom: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                  {profile.region && <Flag code={profile.region} size={15} />}
                  <h2 style={{
                    fontSize: 20, fontWeight: 900, color: '#fff', margin: 0,
                    letterSpacing: '-0.5px', lineHeight: 1.2,
                    wordBreak: 'break-word',
                  }}>
                    {displayName}
                  </h2>
                  {profile.isPremium && <span style={{ fontSize: 14, flexShrink: 0 }}>⭐</span>}
                  {profile.isAdmin && (
                    <span style={{ fontSize: 9, background: 'rgba(232,9,46,0.2)', color: '#E8092E', padding: '2px 6px', borderRadius: 6, fontWeight: 800, flexShrink: 0 }}>
                      ADM
                    </span>
                  )}
                </div>
              </div>

              {/* Username / Game ID */}
              {(profile.username || profile.gameId) && (
                <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {profile.username && (
                    <a
                      href={`https://t.me/${profile.username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: '#60A5FA', fontWeight: 600, textDecoration: 'none',
                        display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.04 9.615c-.154.68-.555.847-1.124.527l-3.1-2.284-1.495 1.438c-.165.165-.304.304-.624.304l.222-3.168 5.76-5.202c.25-.222-.054-.346-.388-.124L7.26 14.294l-3.046-.95c-.662-.207-.675-.662.138-.98l11.9-4.59c.552-.2 1.035.135.31 1.474z"/>
                      </svg>
                      @{profile.username}
                    </a>
                  )}
                  {profile.username && profile.gameId && <span>·</span>}
                  {profile.gameId && `ID: ${profile.gameId}`}
                </div>
              )}

              {/* Rank + ELO + position */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                  background: `${rank.color}18`, color: rank.color, border: `1px solid ${rank.color}35`,
                }}>
                  {rank.label}
                </span>
                <span style={{ fontSize: 14, fontWeight: 900, color: rank.color, letterSpacing: '-0.5px' }}>
                  {profile.elo.toLocaleString()}
                </span>
                {playerRank && (
                  <span style={{
                    fontSize: 10, color: '#4B5563', fontWeight: 600,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                    padding: '1px 7px', borderRadius: 20,
                  }}>
                    #{playerRank}
                  </span>
                )}
              </div>

              {/* Warns */}
              {warns > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                  {[1, 2, 3].map(n => (
                    <div key={n} style={{
                      width: 12, height: 12,
                      clipPath: 'polygon(50% 0%,0% 100%,100% 100%)',
                      background: n <= warns ? (warns >= 3 ? '#EF4444' : '#F59E0B') : 'rgba(255,255,255,0.07)',
                    }} />
                  ))}
                  <span style={{ fontSize: 10, color: warns >= 3 ? '#EF4444' : '#F59E0B', fontWeight: 700 }}>
                    {warns >= 3 ? '🔴 Забанен' : `${warns}/3 варна`}
                  </span>
                </div>
              )}
            </div>

            <EloRing elo={profile.elo} size={52} isChallenger={isChallenger} />
          </div>
        </motion.div>

        {/* ── STATS GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
          <StatChip label="Матчи"   value={profile.matchesPlayed}              color="#60A5FA" icon="🎮" delay={0.06} />
          <StatChip label="Победы"  value={profile.matchesWon}                 color="#22C55E" icon="🏆" delay={0.09} />
          <StatChip label="Винрейт" value={`${profile.winRate}%`}              color="#34D399" icon="📈" delay={0.12} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
          <StatChip label="K/D"    value={Number(profile.kdr).toFixed(2)}                color="#F59E0B" icon="⚔️"  delay={0.15} />
          <StatChip label="AVG"    value={Number(profile.avgKills ?? 0).toFixed(1)}      color="#FBBF24" icon="💀"  delay={0.18} />
          <StatChip label="Rating" value={Number(profile.ratingOverall ?? 0).toFixed(2)} color="#A855F7" icon="⭐"  delay={0.21} />
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
                <span style={{ color: '#22C55E', fontWeight: 700 }}>🏆 {profile.matchesWon} побед</span>
                <span style={{ fontWeight: 600 }}>{profile.winRate}% WR</span>
                <span style={{ color: '#EF4444', fontWeight: 700 }}>{profile.matchesLost} поражений 💀</span>
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

        {/* ── ACTION BUTTONS ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {/* Match history */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => router.push(isMe ? '/history' : `/history?userId=${profile.id}`)}
            style={{
              width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)', color: '#C084FC',
              fontWeight: 800, fontSize: 13,
            } as any}
          >
            📊 История матчей
          </motion.button>

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
                    ) : '➕'} Добавить в друзья
                  </motion.button>
                )}

                {profile.friendStatus === 'pending_sent' && (
                  <div style={{
                    width: '100%', padding: '14px 0', borderRadius: 14, textAlign: 'center',
                    fontWeight: 700, color: '#9CA3AF', fontSize: 13,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                  }}>
                    ⏳ Запрос отправлен
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
                    }}
                  >
                    ✅ Принять запрос в друзья
                  </motion.button>
                )}

                {profile.friendStatus === 'friends' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{
                      flex: 1, padding: '13px 0', borderRadius: 14, textAlign: 'center', fontWeight: 800,
                      background: 'rgba(34,197,94,0.1)', color: '#4ADE80',
                      border: '1px solid rgba(34,197,94,0.25)', fontSize: 13,
                    }}>
                      ✓ В друзьях
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
                }}
              >
                ✏️ Редактировать профиль
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
              }}
            >
              🚨 Пожаловаться
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
                  color: '#fff', fontSize: 18, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>

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
