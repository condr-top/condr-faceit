'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion'

import { useRouter } from 'next/navigation'
import { EloRing } from '@/components/ui/EloRing'
import { EloChart } from '@/components/ui/EloChart'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Avatar } from '@/components/ui/Avatar'
import { CoinPurchaseModal } from '@/components/coins/CoinPurchaseModal'
import { getEloRank, getRankProgress, ELO_RANKS, CHALLENGER_RANK } from '@/lib/eloRank'
import { countryFlag } from '@/lib/regions'
import { RegionPicker } from '@/components/ui/RegionPicker'

// ── Animated counter ──────────────────────────────────────────────────────────
function AnimatedNumber({ value }: { value: number }) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { duration: 1200, bounce: 0 })
  const [display, setDisplay] = useState(0)
  useEffect(() => { mv.set(value) }, [value])
  useEffect(() => spring.on('change', v => setDisplay(Math.round(v))), [spring])
  return <>{display.toLocaleString()}</>
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, icon, delay = 0 }: {
  label: string; value: string | number; color: string; icon: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${color}20`,
        borderRadius: 14, padding: '12px 10px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }} />
      <div style={{ fontSize: 11, marginBottom: 4 }}>{icon}</div>
      <div style={{ fontSize: 17, fontWeight: 900, color, letterSpacing: '-0.5px', lineHeight: 1 }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
        {label}
      </div>
    </motion.div>
  )
}

// ── Nickname editor ───────────────────────────────────────────────────────────
function NicknameEditor({ current, onSave }: { current: string; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(current)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const save = async () => {
    if (!value.trim()) { setError('Введи никнейм'); return }
    setSaving(true); setError('')
    try { await onSave(value.trim()); setEditing(false) }
    catch (e: any) { setError(e?.response?.data?.message || 'Ошибка') }
    finally { setSaving(false) }
  }

  if (!editing) return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() => { setValue(current); setEditing(true); setTimeout(() => inputRef.current?.focus(), 50) }}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(168,85,247,0.08)',
        border: '1px solid rgba(168,85,247,0.2)', borderRadius: 10,
        padding: '8px 14px', cursor: 'pointer', color: '#A855F7', fontSize: 12, fontWeight: 700,
      }}
    >
      ✏️ Сменить никнейм
    </motion.button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <input
        ref={inputRef}
        value={value}
        onChange={e => { setValue(e.target.value); setError('') }}
        onKeyDown={e => { if (e.key === 'Enter') save() }}
        placeholder="Новый никнейм"
        style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(168,85,247,0.4)',
          borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none',
        }}
      />
      {error && <div style={{ fontSize: 11, color: '#EF4444' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <motion.button
          whileTap={{ scale: 0.96 }} onClick={save} disabled={saving}
          style={{
            flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
            background: 'linear-gradient(135deg, #7c3aed, #A855F7)',
            color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
            opacity: saving ? 0.5 : 1,
          }}
        >{saving ? '...' : 'Сохранить'}</motion.button>
        <motion.button
          whileTap={{ scale: 0.96 }} onClick={() => setEditing(false)}
          style={{
            padding: '10px 16px', borderRadius: 10,
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            color: '#6B7280', fontSize: 13, cursor: 'pointer',
          }}
        >Отмена</motion.button>
      </div>
    </div>
  )
}

// ── Discord connect ───────────────────────────────────────────────────────────
function DiscordConnect({ user, onSave }: { user: any; onSave: (name: string | null) => Promise<void> }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true); setError('')
    try {
      await onSave(value.trim() || null)
      setEditing(false)
    } catch (e: any) { setError(e?.response?.data?.message || 'Ошибка') }
    finally { setSaving(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.285 }}
      style={{ marginBottom: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 14 }}
    >
      <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
        Discord аккаунт
      </div>

      {!editing ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#5865F2">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            {user.discordUsername ? (
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>@{user.discordUsername}</div>
                <div style={{ fontSize: 10, color: '#22C55E' }}>✓ Привязан</div>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: '#4B5563' }}>Не привязан</div>
            )}
          </div>
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setValue(user.discordUsername || ''); setEditing(true) }}
            style={{ padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'rgba(88,101,242,0.12)', border: '1px solid rgba(88,101,242,0.25)',
              color: '#818cf8', fontSize: 12, fontWeight: 700 } as any}
          >{user.discordUsername ? 'Изменить' : 'Привязать'}</motion.button>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6 }}>Введи свой Discord username (без @)</div>
          <input
            value={value} onChange={e => { setValue(e.target.value); setError('') }}
            onKeyDown={e => e.key === 'Enter' && save()}
            placeholder="username (например: lordAlekss)"
            autoFocus
            style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(88,101,242,0.4)',
              borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, outline: 'none', marginBottom: 8 }}
          />
          {error && <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 8 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <motion.button whileTap={{ scale: 0.96 }} onClick={save} disabled={saving}
              style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                background: 'linear-gradient(135deg, #5865F2, #4752c4)',
                color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
            >{saving ? '...' : 'Сохранить'}</motion.button>
            {user.discordUsername && (
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => { onSave(null); setEditing(false) }}
                style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444', fontSize: 12, cursor: 'pointer' }}
              >Отвязать</motion.button>
            )}
            <motion.button whileTap={{ scale: 0.96 }} onClick={() => setEditing(false)}
              style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)', color: '#6B7280', fontSize: 12, cursor: 'pointer' }}
            >Отмена</motion.button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, logout, refreshUser } = useAuthStore()
  const router = useRouter()
  const [achievements, setAchievements] = useState<any[]>([])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [myRank, setMyRank] = useState<number | null>(null)
  const [showCoinPurchase, setShowCoinPurchase] = useState(false)
  const [showRegionPicker, setShowRegionPicker] = useState(false)

  useEffect(() => {
    refreshUser()
    api.get('/achievements').then(r => setAchievements(r.data)).catch(() => {})
    api.get('/leaderboard/rank').then(r => setMyRank(r.data)).catch(() => {})
  }, [])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append('avatar', file)
      const token = localStorage.getItem('condr_faceit_token')
      const res = await fetch('/api/users/avatar', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Ошибка')
      await refreshUser()
    } catch (e: any) {
      alert('Ошибка загрузки: ' + (e?.message || e))
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleNicknameSave = async (nickname: string) => {
    await api.post('/users/change-nickname', { nickname })
    await refreshUser()
  }

  if (!user) return null

  const rank = getEloRank(user.elo)
  const isChallenger = myRank !== null && myRank <= 5
  const theme = isChallenger ? CHALLENGER_RANK : rank
  const rankProg = Math.round(getRankProgress(user.elo) * 100)
  const nextRank = ELO_RANKS.find(r => r.min > user.elo) || null
  const eloToNext = nextRank ? nextRank.min - user.elo : 0
  const xpForNext = Math.pow(user.level, 2) * 100
  const xpPct = Math.min(100, ((user.xp % xpForNext) / xpForNext) * 100)
  const warns = user.warns ?? 0

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 96 }}>
        <div style={{ padding: '0 16px', position: 'relative', zIndex: 1 }}>

          {/* ── HERO ── */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            style={{
              paddingTop: 20, marginBottom: 14,
              background: `linear-gradient(150deg, ${theme.color}20 0%, rgba(8,8,11,0.96) 55%, ${theme.color}12 100%)`,
              border: `1px solid ${theme.color}30`, borderRadius: 22, padding: 18,
              position: 'relative', overflow: 'hidden',
              boxShadow: `0 12px 44px ${theme.color}16`,
            }}
          >
            {/* Ambient glow blobs */}
            <div style={{ position: 'absolute', top: -70, left: -50, width: 200, height: 200, background: `radial-gradient(circle, ${theme.color}33, transparent 70%)`, pointerEvents: 'none' }} />
            <motion.div animate={{ opacity: [0.35, 0.65, 0.35] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ position: 'absolute', bottom: -60, right: -40, width: 180, height: 180, background: `radial-gradient(circle, ${theme.color}26, transparent 70%)`, pointerEvents: 'none' }} />
            {/* Shimmer sweep */}
            <motion.div
              animate={{ x: ['-100%', '220%'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 7 }}
              style={{
                position: 'absolute', top: 0, bottom: 0, width: '30%',
                background: `linear-gradient(90deg, transparent, ${theme.color}14, transparent)`,
                pointerEvents: 'none',
              }}
            />

            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', position: 'relative' }}>
              {/* Avatar with rotating rank ring + level badge */}
              <label style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                <div style={{ position: 'relative', width: 84, height: 84 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from 0deg, ${theme.color}, ${theme.color}22, ${theme.color}, ${theme.color}22, ${theme.color})` }}
                  />
                  <div style={{ position: 'absolute', inset: 3, borderRadius: '50%', overflow: 'hidden', background: '#0a0a0e' }}>
                    <Avatar
                      avatarUrl={user.avatarUrl}
                      name={user.gameNickname || user.firstName}
                      size={78}
                      style={{ borderRadius: '50%' }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: uploadingAvatar ? 1 : 0, transition: 'opacity 0.2s', zIndex: 2,
                    }}>
                      <span style={{ fontSize: uploadingAvatar ? 12 : 18 }}>{uploadingAvatar ? '⏳' : '📷'}</span>
                    </div>
                  </div>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} disabled={uploadingAvatar} />
              </label>

              {/* Name + rank info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                  {user.region && <span style={{ fontSize: 20, flexShrink: 0 }}>{countryFlag(user.region)}</span>}
                  <h1 style={{
                    fontSize: 21, fontWeight: 900, color: '#fff', margin: 0,
                    letterSpacing: '-0.5px', lineHeight: 1.2, wordBreak: 'break-word',
                    textShadow: `0 2px 20px ${theme.color}44`,
                  }}>
                    {user.gameNickname || user.firstName}
                  </h1>
                  {user.isPremium && <span style={{ fontSize: 16, flexShrink: 0 }}>⭐</span>}
                  {user.isAdmin && (
                    <span style={{ fontSize: 9, background: 'rgba(232,9,46,0.2)', color: '#E8092E', padding: '2px 6px', borderRadius: 6, fontWeight: 800, flexShrink: 0 }}>ADM</span>
                  )}
                </div>
                {user.username && (
                  <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 6 }}>@{user.username}</div>
                )}

                {/* Rank + position */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 20,
                    background: `${theme.color}1e`, color: theme.color, border: `1px solid ${theme.color}3a`,
                  }}>{isChallenger ? '👑 Challenger' : theme.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: theme.color }}>
                    <AnimatedNumber value={user.elo} />
                  </span>
                  {myRank && (
                    <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>#{myRank}</span>
                  )}
                </div>

                {/* Warns */}
                {warns > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
                    {[1,2,3].map(n => (
                      <div key={n} style={{
                        width: 14, height: 14,
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

              {/* Rank emblem — кольцо + число (без подписи, чтобы не дублировать «Level X») */}
              <EloRing elo={user.elo} size={58} isChallenger={isChallenger} showLabel={false} />
            </div>

            {/* Rank progress to next */}
            <div style={{ marginTop: 16, position: 'relative' }}>
              <div style={{ textAlign: 'right', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: '#6B7280', fontWeight: 600 }}>
                  {nextRank ? `${eloToNext} ELO до ${nextRank.label}` : '👑 Макс. ранг'}
                </span>
              </div>
              <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${nextRank ? rankProg : 100}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                  style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${theme.color}aa, ${theme.color})`, boxShadow: `0 0 10px ${theme.color}88` }}
                />
              </div>
            </div>

            {/* XP bar */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Уровень {user.level}
                </span>
                <span style={{ fontSize: 10, color: '#4B5563' }}>{user.xp} / {xpForNext} XP</span>
              </div>
              <div style={{ height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpPct}%` }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.45 }}
                  style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #6366f1, #A855F7)' }}
                />
              </div>
            </div>
          </motion.div>

          {/* ── STATS GRID ── */}
          <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
            Статистика
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 8 }}>
            <StatCard label="Матчи"   value={user.matchesPlayed} color="#60A5FA" icon="🎮" delay={0.05} />
            <StatCard label="Победы"  value={user.matchesWon}    color="#22C55E" icon="🏆" delay={0.08} />
            <StatCard label="Винрейт" value={`${user.winRate}%`} color="#34D399" icon="📈" delay={0.11} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
            <StatCard label="K/D"    value={Number(user.kdr).toFixed(2)}               color="#F59E0B" icon="⚔️" delay={0.14} />
            <StatCard label="AVG"    value={Number(user.avgKills ?? 0).toFixed(1)}     color="#FBBF24" icon="💀" delay={0.17} />
            <StatCard label="Rating" value={Number(user.ratingOverall ?? 0).toFixed(2)} color="#A855F7" icon="⭐" delay={0.20} />
            <div style={{ position: 'relative' }}>
              <StatCard label="Монеты" value={user.coins} color="#EAB308" icon="🪙" delay={0.23} />
              <button
                onClick={() => setShowCoinPurchase(true)}
                style={{
                  position: 'absolute', top: 4, right: 4,
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#EAB308', border: 'none',
                  color: '#000', fontSize: 12, fontWeight: 900, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 8px rgba(234,179,8,0.5)',
                }}
              >+</button>
            </div>
          </div>

          {/* ── W/L BAR ── */}
          {(user.matchesWon + user.matchesLost) > 0 && (() => {
            const total = user.matchesWon + user.matchesLost
            const wPct = (user.matchesWon / total) * 100
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.26 }}
                style={{ marginBottom: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
                  <span style={{ color: '#22C55E', fontWeight: 700 }}>🏆 {user.matchesWon} побед</span>
                  <span style={{ fontWeight: 600 }}>{user.winRate}% WR</span>
                  <span style={{ color: '#EF4444', fontWeight: 700 }}>{user.matchesLost} поражений 💀</span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${wPct}%` }}
                    transition={{ duration: 1.0, ease: 'easeOut', delay: 0.4 }}
                    style={{ height: '100%', background: 'linear-gradient(90deg, #16a34a, #22C55E)', borderRadius: '3px 0 0 3px' }}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${100 - wPct}%` }}
                    transition={{ duration: 1.0, ease: 'easeOut', delay: 0.4 }}
                    style={{ height: '100%', background: 'linear-gradient(90deg, #E8092E, #b91c1c)', borderRadius: '0 3px 3px 0' }}
                  />
                </div>
              </motion.div>
            )
          })()}

          {/* ── ELO CHART ── */}
          <EloChart currentElo={user.elo} />

          {/* ── GAME INFO ── */}
          {user.gameNickname && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 }}
              style={{ marginBottom: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px' }}
            >
              <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Игровые данные
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 3 }}>Никнейм</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{user.gameNickname}</div>
                </div>
                {user.gameId && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 3 }}>Game ID</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#9CA3AF', fontFamily: 'monospace' }}>{user.gameId}</div>
                  </div>
                )}
              </div>
              <NicknameEditor
                current={user.gameNickname}
                onSave={handleNicknameSave}
              />
              <div style={{ marginTop: 6, fontSize: 10, color: '#374151' }}>
                {user.freeNicknameChangeAvailable ? '✅ Бесплатная смена доступна' : '💰 Смена стоит 500 монет'}
              </div>
            </motion.div>
          )}

          {/* ── DISCORD ── */}
          <DiscordConnect user={user} onSave={async (name) => {
            await api.post('/users/discord', { discordUsername: name })
            await refreshUser()
          }} />

          {/* ── REGION ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.29 }}
            style={{ marginBottom: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px' }}
          >
            <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Регион
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                {user.region ? (
                  <>
                    <div style={{ fontSize: 22, marginBottom: 2 }}>{countryFlag(user.region)}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {user.regionUpdatedAt && (() => {
                        const days = Math.ceil(Math.max(0, 7 - (Date.now() - new Date(user.regionUpdatedAt).getTime()) / 86_400_000))
                        return days > 0 ? <span style={{ color: '#F59E0B' }}>Смена через {days} дн.</span> : null
                      })()}
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: '#4B5563' }}>Регион не выбран</div>
                )}
              </div>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => setShowRegionPicker(true)}
                style={{
                  padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
                  color: '#818cf8', fontSize: 12, fontWeight: 700,
                } as any}
              >
                {user.region ? 'Изменить' : 'Выбрать'}
              </motion.button>
            </div>
          </motion.div>

          {/* ── PRIVACY ── */}
          {user.username && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.30 }}
              style={{ marginBottom: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '14px' }}
            >
              <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
                Конфиденциальность
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Скрыть Telegram ник</div>
                  <div style={{ fontSize: 11, color: '#4B5563' }}>
                    {user.hideUsername ? 'Другие игроки не видят @' + user.username : '@' + user.username + ' виден всем'}
                  </div>
                </div>
                <button
                  onClick={async () => {
                    const next = !user.hideUsername
                    try {
                      await api.post('/users/privacy', { hideUsername: next })
                      await refreshUser()
                    } catch {}
                  }}
                  style={{
                    width: 48, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer',
                    background: user.hideUsername ? '#E8092E' : 'rgba(255,255,255,0.12)',
                    position: 'relative', transition: 'background 0.25s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: 3,
                    left: user.hideUsername ? 26 : 4,
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#fff', transition: 'left 0.25s',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                  }} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ── ACHIEVEMENTS ── */}
          {achievements.filter(a => a.unlocked).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              style={{ marginBottom: 14 }}
            >
              <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Достижения
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {achievements.filter(a => a.unlocked).map((a, i) => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.34 + i * 0.04, type: 'spring', stiffness: 300, damping: 20 }}
                    style={{
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12, padding: '10px 6px', textAlign: 'center',
                    }}
                    title={a.title}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{a.icon}</div>
                    <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 600, lineHeight: 1.2 }}>{a.title}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── ACTIONS ── */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
          >
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/history')}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
                background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
                color: '#60A5FA', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              } as any}
            >
              📊 История матчей
            </motion.button>

            {(user.isAdmin || user.isModerator) && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push('/admin')}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
                  background: 'rgba(232,9,46,0.08)', border: '1px solid rgba(232,9,46,0.2)',
                  color: '#E8092E', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                } as any}
              >
                {user.isAdmin ? '👑 Панель администратора' : '🛡️ Панель модератора'}
              </motion.button>
            )}

            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => { logout(); router.replace('/auth') }}
              style={{
                width: '100%', padding: '12px 0', borderRadius: 14,
                background: 'transparent', border: '1px solid rgba(255,255,255,0.06)',
                color: '#374151', fontWeight: 700, fontSize: 12, cursor: 'pointer',
              }}
            >
              Выйти из аккаунта
            </motion.button>
          </motion.div>

        </div>

        {showCoinPurchase && <CoinPurchaseModal onClose={() => setShowCoinPurchase(false)} />}
        <AnimatePresence>
          {showRegionPicker && <RegionPicker onClose={() => setShowRegionPicker(false)} />}
        </AnimatePresence>
      </div>
    </RequireRegistration>
  )
}
