'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion'

import { useRouter } from 'next/navigation'
import { EloChart } from '@/components/ui/EloChart'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { getCached, setCached } from '@/lib/cache'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Avatar } from '@/components/ui/Avatar'
import { EloRing } from '@/components/ui/EloRing'
import { MatchCard } from '@/components/ui/MatchCard'
import { useSheetDrag } from '@/lib/useSheetDrag'
import { getEloRank, getRankProgress, ELO_RANKS, CHALLENGER_RANK, qualifiesChallenger } from '@/lib/eloRank'
import { Flag } from '@/components/ui/Flag'
import { RegionPicker } from '@/components/ui/RegionPicker'
import { StreamerSettings } from '@/components/streamer/StreamerSettings'
import { NotifSettings } from '@/components/settings/NotifSettings'
import { Icon, IconName } from '@/components/ui/Icon'
import { useUiStore } from '@/store/uiStore'

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
  label: string; value: string | number; color: string; icon: IconName; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: '#0f0f15',
        border: `1px solid ${color}20`,
        borderRadius: 14, padding: '12px 10px',
        textAlign: 'center', position: 'relative',
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }} />
      <div style={{ marginBottom: 5, display: 'flex', justifyContent: 'center' }}><Icon name={icon} size={15} color={color} /></div>
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
      <Icon name="pencil" size={13} />Сменить никнейм
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
                <div style={{ fontSize: 10, color: '#22C55E', display: 'flex', alignItems: 'center', gap: 3 }}><Icon name="check" size={11} />Привязан</div>
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

// ── League rank badge (CPL / CPL-Q) — Challenger emblem tinted to league color ──
function LeagueRankBadge({ league, rank, delay = 0 }: { league: 'cplq' | 'cpl'; rank: number | null; delay?: number }) {
  const c1 = league === 'cpl' ? '#E8092E' : '#F59E0B'
  const c2 = league === 'cpl' ? '#ff4d63' : '#FBBF24'
  const label = league === 'cpl' ? 'CPL' : 'CPL-Q'
  const feather = 'radial-gradient(circle closest-side, #000 78%, transparent 100%)'
  const isCpl = league === 'cpl'
  // Одна эмблема для обеих лиг → идентичный масштаб/кадрирование. CPL тонируется в красный.
  const emblemSrc = '/ranks/challenger_cplq.jpg?v=1'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 22 }}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 12,
        padding: '7px 9px 7px 15px', borderRadius: 18, overflow: 'hidden',
        background: `linear-gradient(135deg, ${c1}2e 0%, ${c1}10 55%, rgba(12,12,17,0.6) 100%)`,
        border: `1px solid ${c1}55`,
        boxShadow: `0 8px 24px ${c1}22, inset 0 1px 0 rgba(255,255,255,0.07)`,
      }}
    >
      {/* top hairline accent */}
      <div style={{ position: 'absolute', top: 0, left: '16%', right: '16%', height: 1, background: `linear-gradient(90deg, transparent, ${c1}, transparent)` }} />
      {/* corner glow */}
      <div style={{ position: 'absolute', top: -18, right: 18, width: 80, height: 80, background: `radial-gradient(circle, ${c1}33, transparent 70%)`, pointerEvents: 'none' }} />

      {/* LEFT — rank + league */}
      <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1, position: 'relative' }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', color: c1, marginBottom: 4 }}>{label}</span>
        <span style={{ fontSize: 21, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', textShadow: `0 0 16px ${c1}99` }}>{rank ? `#${rank}` : '—'}</span>
      </div>

      {/* RIGHT — Challenger emblem recolored to league hue */}
      <div style={{
        position: 'relative', width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
        background: `conic-gradient(from 210deg, ${c1}, ${c1}30 28%, ${c1}cc 50%, ${c1}26 74%, ${c1})`,
        padding: 2, boxShadow: `0 0 16px ${c1}66`,
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#08080b', overflow: 'hidden', position: 'relative', isolation: 'isolate' }}>
          <img
            src={emblemSrc}
            width={44} height={44} draggable={false} alt="Challenger"
            style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.4)', filter: 'saturate(1.15) contrast(1.05)', WebkitMaskImage: feather, maskImage: feather }}
          />
          {/* CPL: перекрас в красный (CPL-Q уже оранжевая — не трогаем) */}
          {isCpl && <div style={{ position: 'absolute', inset: 0, background: c1, mixBlendMode: 'color', pointerEvents: 'none' }} />}
          {/* Внутреннее свечение в цвет лиги (одинаковое для обеих) */}
          <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 50% 42%, ${c2}55, transparent 62%)`, mixBlendMode: 'screen', pointerEvents: 'none' }} />
          {/* Тёмная кромка — перекрывает остаток белого фона исходника, делает край чисто-чёрным (идентично у обеих) */}
          <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'radial-gradient(circle closest-side, transparent 79%, #08080b 95%)', pointerEvents: 'none' }} />
        </div>
      </div>
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const { user, refreshUser } = useAuthStore()
  const router = useRouter()
  const [achievements, setAchievements] = useState<any[]>([])
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [myRank, setMyRank] = useState<number | null>(() => getCached<number>('leaderboard-rank'))
  const [showRegionPicker, setShowRegionPicker] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const settingsSheet = useSheetDrag(() => setShowSettings(false))
  const [recentMatches, setRecentMatches] = useState<any[]>([])
  const [statLeague, setStatLeague] = useState<'normal' | 'cplq' | 'cpl'>('normal')
  const [leagueStats, setLeagueStats] = useState<any>(null)
  const [cplMe, setCplMe] = useState<any>(null)
  const setHideNav = useUiStore(s => s.setHideNav)
  useEffect(() => { setHideNav(showSettings); return () => setHideNav(false) }, [showSettings])

  useEffect(() => {
    refreshUser()
    api.get('/achievements').then(r => setAchievements(Array.isArray(r.data) ? r.data : (r.data?.achievements ?? []))).catch(() => {})
    api.get('/leaderboard/rank').then(r => { setMyRank(r.data); setCached('leaderboard-rank', r.data) }).catch(() => {})
    api.get('/cpl/me').then(r => setCplMe(r.data)).catch(() => {})
  }, [])

  // История и стата по выбранной лиге (отдельно для каждой)
  useEffect(() => {
    const lg = statLeague === 'normal' ? '' : `&league=${statLeague}`
    api.get(`/matches/history?page=1&limit=5${lg}`).then(r => setRecentMatches(r.data.matches || [])).catch(() => setRecentMatches([]))
    if (statLeague !== 'normal') api.get(`/cpl/stats?league=${statLeague}`).then(r => setLeagueStats(r.data)).catch(() => setLeagueStats(null))
  }, [statLeague])

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
  const calibrating = (user.matchesPlayed ?? 0) < 10
  const isChallenger = !calibrating && qualifiesChallenger(user.elo, myRank)
  const theme = isChallenger ? CHALLENGER_RANK : rank
  const accent = calibrating ? '#EAB308' : theme.color
  const rankProg = Math.round(getRankProgress(user.elo) * 100)
  const nextRank = ELO_RANKS.find(r => r.min > user.elo) || null
  const eloToNext = nextRank ? nextRank.min - user.elo : 0
  const warns = user.warns ?? 0

  // ── Stat colors by thresholds ──
  const GREEN = '#22C55E', YELLOW = '#EAB308', RED = '#EF4444', GREY = '#6B7280'
  const ratingVal = Number(user.ratingOverall ?? 0)
  const kdVal = Number(user.kdr ?? 0)
  const avgVal = Number(user.avgKills ?? 0)
  const ratingColor = ratingVal > 1.1 ? GREEN : ratingVal >= 0.9 ? YELLOW : RED
  const kdColor = kdVal > 1.1 ? GREEN : kdVal >= 0.9 ? YELLOW : RED
  const avgColor = avgVal > 16 ? GREEN : avgVal >= 11 ? YELLOW : RED
  const ratingLabel = ratingColor === GREEN ? 'Отличная форма' : ratingColor === YELLOW ? 'Стабильно' : 'Можно лучше'

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

            {/* Centered identity */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <label style={{ position: 'relative', cursor: 'pointer' }}>
                <div style={{ position: 'relative', width: 112, height: 112 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
                    style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(from 0deg, ${theme.color}, ${theme.color}1f, ${theme.color}, ${theme.color}1f, ${theme.color})`, boxShadow: `0 0 22px ${theme.color}44` }}
                  />
                  <div style={{ position: 'absolute', inset: 4, borderRadius: '50%', overflow: 'hidden', background: '#0a0a0e' }}>
                    <Avatar
                      avatarUrl={user.avatarUrl}
                      name={user.gameNickname || user.firstName}
                      size={104}
                      style={{ borderRadius: '50%' }}
                    />
                    <div style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: uploadingAvatar ? 1 : 0, transition: 'opacity 0.2s', zIndex: 2,
                    }}>
                      {uploadingAvatar
                        ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ display: 'flex', color: '#fff' }}><Icon name="timer" size={22} /></motion.span>
                        : <Icon name="camera" size={24} color="#fff" />}
                    </div>
                  </div>
                </div>
                <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} disabled={uploadingAvatar} />
              </label>

              {/* Name */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 18, justifyContent: 'center', maxWidth: '100%' }}>
                {user.region && <Flag code={user.region} size={16} />}
                <h1 style={{
                  fontSize: 24, fontWeight: 900, color: '#fff', margin: 0,
                  letterSpacing: '-0.6px', lineHeight: 1.1, textAlign: 'center',
                  overflowWrap: 'anywhere', wordBreak: 'break-word',
                  textShadow: `0 2px 24px ${theme.color}55`,
                }}>
                  {user.gameNickname || user.firstName}
                </h1>
                {user.isVerified && <Icon name="verified" size={20} style={{ flexShrink: 0 }} />}
              </div>

              {/* username + ADM */}
              {(user.username || user.isAdmin) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
                  {user.username && <span style={{ fontSize: 12, color: '#4B5563' }}>@{user.username}</span>}
                  {user.isAdmin && <span style={{ fontSize: 9, background: 'rgba(232,9,46,0.2)', color: '#E8092E', padding: '2px 6px', borderRadius: 6, fontWeight: 800 }}>ADM</span>}
                </div>
              )}

              {/* Rank emblem — большой ранг-орб как центр внимания */}
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
                  <EloRing elo={user.elo} size={72} isChallenger={isChallenger} showLabel={false} calibrating={calibrating} />
                </motion.div>
                <div style={{ textAlign: 'left', position: 'relative' }}>
                  <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 3 }}>Ваш ранг</div>
                  {calibrating ? (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 900, color: accent, lineHeight: 1 }}>
                        Калибровка
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 6 }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1 }}>{user.matchesPlayed}<span style={{ fontSize: 14, color: '#6B7280' }}>/10</span></span>
                        <span style={{ fontSize: 11, color: accent, fontWeight: 800, textTransform: 'uppercase' }}>матчей</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 900, color: theme.color, lineHeight: 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        {isChallenger ? <><Icon name="crown" size={16} />Challenger</> : theme.label}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 6 }}>
                        <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.8px', lineHeight: 1 }}><AnimatedNumber value={user.elo} /></span>
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>ELO</span>
                        {myRank && <span style={{ fontSize: 11, color: theme.color, fontWeight: 800 }}>#{myRank}</span>}
                      </div>
                    </>
                  )}
                </div>
              </motion.div>

              {/* Warns */}
              {warns > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
                  {[1,2,3].map(n => (
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

              {/* CPL / CPL-Q rank badges (только если лига разблокирована) */}
              {cplMe && (cplMe.cplAccess || cplMe.cplqAccess) && (
                <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
                  {cplMe.cplqAccess && <LeagueRankBadge league="cplq" rank={cplMe.leagues?.cplq?.rank ?? null} delay={0.3} />}
                  {cplMe.cplAccess && <LeagueRankBadge league="cpl" rank={cplMe.leagues?.cpl?.rank ?? null} delay={0.36} />}
                </div>
              )}
            </div>

            {/* Прогресс: ранг или калибровка */}
            <div style={{ marginTop: 18, position: 'relative' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 10, color: '#6B7280', fontWeight: 600 }}>
                {calibrating ? (
                  <>
                    <span style={{ color: accent }}>Калибровка</span>
                    <span>Осталось матчей: {10 - user.matchesPlayed}</span>
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
              <div style={{ height: 7, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${calibrating ? Math.round((user.matchesPlayed / 10) * 100) : (nextRank ? rankProg : 100)}%` }}
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

          {/* League switcher (Обычная / CPL-Q / CPL) */}
          <div style={{ display: 'flex', gap: 5, background: '#0f0f15', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 4, marginBottom: 10 }}>
            {([
              { key: 'normal', label: 'Обычная', g1: '#60A5FA', g2: '#3B82F6', locked: false },
              { key: 'cplq',   label: 'CPL-Q',   g1: '#F59E0B', g2: '#EF4444', locked: !user.cplqAccess },
              { key: 'cpl',    label: 'CPL',     g1: '#E8092E', g2: '#A855F7', locked: !user.cplAccess },
            ] as { key: typeof statLeague; label: string; g1: string; g2: string; locked: boolean }[]).map(v => (
              <button key={v.key} onClick={() => v.locked ? alert('Лига заблокирована — доступ выдаёт администрация (или покупка в магазине)') : setStatLeague(v.key)}
                style={{ flex: 1, position: 'relative', padding: '8px 0', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 800, background: 'none', color: statLeague === v.key ? '#fff' : v.locked ? '#374151' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                {statLeague === v.key && <div style={{ position: 'absolute', inset: 0, borderRadius: 9, background: `linear-gradient(135deg, ${v.g1}cc, ${v.g2}cc)`, zIndex: -1 }} />}
                {v.locked && <Icon name="lock" size={11} color="#374151" />}{v.label}
              </button>
            ))}
          </div>

          {/* ── LEAGUE STATS (текущий сезон) ── */}
          {statLeague !== 'normal' && (() => {
            const lc = statLeague === 'cpl' ? '#E8092E' : '#F59E0B'
            const ls = leagueStats
            return (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 14 }}>
                <div style={{ borderRadius: 18, padding: '16px 18px', marginBottom: 8, position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${lc}1f, #0f0f15 60%)`, border: `1px solid ${lc}44`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ position: 'absolute', right: -30, top: -30, width: 130, height: 130, background: `radial-gradient(circle, ${lc}22, transparent 70%)`, pointerEvents: 'none' }} />
                  <div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="trophy" size={13} color={lc} />Season Points</div>
                    <div style={{ fontSize: 38, fontWeight: 900, color: lc, letterSpacing: '-1.5px', lineHeight: 1.05, marginTop: 4 }}>{ls?.seasonPoints ?? 0}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{ls?.rank ? `#${ls.rank}` : '—'}</div>
                    <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>{ls?.total ? `из ${ls.total}` : 'место'}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                  <StatCard label="Матчи" value={ls?.matches ?? 0} color={GREY} icon="gamepad" delay={0.05} />
                  <StatCard label="Победы" value={ls?.wins ?? 0} color="#22C55E" icon="trophy" delay={0.08} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <StatCard label="Винрейт" value={`${ls?.winRate ?? 0}%`} color={(ls?.winRate ?? 0) >= 50 ? '#22C55E' : '#F59E0B'} icon="trendingUp" delay={0.11} />
                  <StatCard label="Ср. рейтинг" value={(ls?.avgRating ?? 0).toFixed(2)} color={(ls?.avgRating ?? 0) >= 1 ? '#22C55E' : '#F59E0B'} icon="star" delay={0.14} />
                </div>
                <div style={{ fontSize: 10.5, color: '#4B5563', textAlign: 'center', marginTop: 10 }}>Статистика лиги — только за текущий сезон</div>
              </motion.div>
            )
          })()}

          {statLeague === 'normal' && (<>
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
            <div style={{
              fontSize: 11, fontWeight: 800, color: ratingColor,
              background: `${ratingColor}1a`, border: `1px solid ${ratingColor}33`,
              padding: '6px 12px', borderRadius: 20, whiteSpace: 'nowrap',
            }}>
              {ratingLabel}
            </div>
          </motion.div>

          {/* Skill tiles (colored by value) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <StatCard label="K/D" value={kdVal.toFixed(2)}  color={kdColor}  icon="swords" delay={0.08} />
            <StatCard label="AVG" value={String(Math.round(avgVal))} color={avgColor} icon="skull"  delay={0.11} />
          </div>

          {/* Volume tiles (neutral grey) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
            <StatCard label="Матчи"   value={user.matchesPlayed} color={GREY} icon="gamepad" delay={0.14} />
            <StatCard label="Победы"  value={user.matchesWon}    color={GREY} icon="trophy" delay={0.17} />
            <StatCard label="Винрейт" value={`${user.winRate}%`} color={GREY} icon="trendingUp" delay={0.20} />
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
                style={{ marginBottom: 14, background: '#0f0f15', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: '12px 14px', transform: 'translateZ(0)', isolation: 'isolate' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 8 }}>
                  <span style={{ color: '#22C55E', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Icon name="trophy" size={12} />{user.matchesWon} побед</span>
                  <span style={{ fontWeight: 600 }}>{user.winRate}% WR</span>
                  <span style={{ color: '#EF4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>{user.matchesLost} поражений<Icon name="skull" size={12} /></span>
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
          </>)}

          {/* ── RECENT MATCHES ── */}
          {recentMatches.length > 0 && (
            <div style={{ marginTop: 16, marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                Последние матчи
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recentMatches.map((m, i) => (
                  <MatchCard key={m.matchId} m={m} fallbackElo={user.elo} delay={i * 0.05} />
                ))}
              </div>

              {/* View all */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push(statLeague === 'normal' ? '/history' : `/history?league=${statLeague}`)}
                style={{
                  width: '100%', marginTop: 10, padding: '13px 0', borderRadius: 14, border: 'none',
                  background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)',
                  color: '#60A5FA', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                } as any}
              >
                <Icon name="barChart" size={15} />Посмотреть все матчи
              </motion.button>

              {/* Map stats */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => router.push(statLeague === 'normal' ? '/map-stats' : `/map-stats?league=${statLeague}`)}
                style={{
                  width: '100%', marginTop: 8, padding: '13px 0', borderRadius: 14, border: 'none',
                  background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)',
                  color: '#C084FC', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                } as any}
              >
                <Icon name="target" size={15} />Статистика по картам
              </motion.button>
            </div>
          )}

          {/* ── SETTINGS SHEET ── */}
          <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(6,6,8,0.72)', backdropFilter: 'blur(6px)' }}
            >
              <motion.div
                {...settingsSheet.panelProps}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 320, damping: 32 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, maxHeight: '92vh', overflowY: 'auto',
                  background: '#0b0b0f', borderTopLeftRadius: 24, borderTopRightRadius: 24,
                  border: '1px solid rgba(255,255,255,0.08)', borderBottom: 'none', padding: '8px 16px 36px',
                }}
              >
                <div {...settingsSheet.handleProps} style={{ ...settingsSheet.handleProps.style, padding: '6px 0 14px' }}>
                  <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                  <h2 style={{ fontSize: 19, fontWeight: 900, color: '#fff', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Icon name="settings" size={18} />Настройки
                  </h2>
                  <button
                    onClick={() => setShowSettings(false)}
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, width: 32, height: 32, color: '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Icon name="x" size={16} />
                  </button>
                </div>

          {/* ── GAME INFO ── */}
          {user.gameNickname && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 }}
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
              <div style={{ marginTop: 6, fontSize: 10, color: '#374151', display: 'flex', alignItems: 'center', gap: 4 }}>
                {user.freeNicknameChangeAvailable
                  ? <><Icon name="check" size={11} color="#22C55E" />Бесплатная смена доступна</>
                  : <><Icon name="coins" size={11} />Смена стоит 500 монет</>}
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
                    <div style={{ marginBottom: 4 }}><Flag code={user.region} size={20} /></div>
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

          {/* ── УВЕДОМЛЕНИЯ В TELEGRAM ── */}
          <NotifSettings />

          {/* ── ДЛЯ СТРИМЕРОВ (OBS-виджет) ── */}
          <StreamerSettings />

          {/* ── ADMIN / MOD PANEL ── */}
          {(user.isAdmin || user.isModerator) && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/admin')}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
                background: 'rgba(232,9,46,0.08)', border: '1px solid rgba(232,9,46,0.2)',
                color: '#E8092E', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14,
              } as any}
            >
              {user.isAdmin
                ? <><Icon name="crown" size={15} />Панель администратора</>
                : <><Icon name="shield" size={15} />Панель модератора</>}
            </motion.button>
          )}

              </motion.div>
            </motion.div>
          )}
          </AnimatePresence>

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
                {achievements.filter(a => a.unlocked).map((a, i) => {
                  const c = a.color || '#A855F7'
                  return (
                  <motion.div
                    key={a.key ?? a.id ?? i}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.34 + i * 0.04, type: 'spring', stiffness: 300, damping: 20 }}
                    style={{
                      background: `${c}10`, border: `1px solid ${c}30`,
                      borderRadius: 12, padding: '10px 6px', textAlign: 'center',
                    }}
                    title={a.title}
                  >
                    <div style={{ width: 30, height: 30, margin: '0 auto 5px', borderRadius: 9, background: `linear-gradient(135deg, ${c}, ${c}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 10px ${c}44` }}>
                      <Icon name={(a.icon || 'medal') as IconName} size={16} color="#fff" />
                    </div>
                    <div style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 700, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.title}</div>
                  </motion.div>
                )})}
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
              onClick={() => setShowSettings(true)}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14, border: 'none',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#D1D5DB', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              } as any}
            >
              <Icon name="settings" size={15} />Настройки
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push('/link-site')}
              style={{
                width: '100%', padding: '13px 0', borderRadius: 14,
                background: 'rgba(232,9,46,0.06)', border: '1px solid rgba(232,9,46,0.2)',
                color: '#fca5a5', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              } as any}
            >
              <Icon name="link" size={15} color="#fca5a5" />Вход на сайт
            </motion.button>
          </motion.div>

        </div>

        <AnimatePresence>
          {showRegionPicker && <RegionPicker onClose={() => setShowRegionPicker(false)} />}
        </AnimatePresence>
      </div>
    </RequireRegistration>
  )
}
