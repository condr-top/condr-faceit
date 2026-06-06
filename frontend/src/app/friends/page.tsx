'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { getEloRank } from '@/lib/eloRank'

type Tab = 'friends' | 'requests' | 'search'

interface Player {
  id: number
  gameNickname: string | null
  gameId: string | null
  firstName: string
  username: string | null
  avatarUrl: string | null
  elo: number
  level: number
  matchesPlayed: number
  winRate?: number
}

// ── Tilt card for friend ──────────────────────────────────────────────────────
function FriendCard({
  p, delay = 0, actions, onClick,
}: {
  p: Player; delay?: number; actions?: React.ReactNode; onClick: () => void
}) {
  const ref  = useRef<HTMLDivElement>(null)
  const rank = getEloRank(p.elo)

  const track = (cx: number, cy: number) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = (cx - r.left) / r.width - 0.5
    const y = (cy - r.top)  / r.height - 0.5
    el.style.transform = `perspective(600px) rotateX(${-y * 12}deg) rotateY(${x * 12}deg) scale(1.02)`
    const shine = el.querySelector('.friend-shine') as HTMLElement | null
    if (shine) shine.style.background =
      `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(34,197,94,0.15) 0%, transparent 60%)`
  }
  const reset = () => {
    const el = ref.current; if (!el) return
    el.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)'
    const shine = el.querySelector('.friend-shine') as HTMLElement | null
    if (shine) shine.style.background = 'none'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 280, damping: 24 }}
      onMouseMove={e => track(e.clientX, e.clientY)}
      onMouseLeave={reset}
      onTouchMove={e => { const t = e.touches[0]; track(t.clientX, t.clientY) }}
      onTouchEnd={reset}
      style={{ marginBottom: 10 }}
    >
      <div
        ref={ref}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px', borderRadius: 16,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${rank.color}18`,
          position: 'relative', overflow: 'hidden',
          transition: 'transform 0.15s ease',
          willChange: 'transform',
        }}
      >
        {/* Shine */}
        <div className="friend-shine" style={{
          position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none',
          transition: 'background 0.08s',
        }} />
        {/* Rank color strip top */}
        <div style={{
          position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
          background: `linear-gradient(90deg, transparent, ${rank.color}55, transparent)`,
        }} />

        {/* Avatar */}
        <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0 }}>
          <Avatar avatarUrl={p.avatarUrl} name={p.gameNickname || p.firstName} size={46} />
          {/* Level badge */}
          <div style={{
            position: 'absolute', bottom: -3, right: -3,
            width: 18, height: 18, borderRadius: '50%',
            background: '#060608', border: `1px solid ${rank.color}60`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 8, fontWeight: 900, color: rank.color,
          }}>
            {rank.level}
          </div>
        </button>

        {/* Info */}
        <button onClick={onClick} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
            {p.gameNickname || p.firstName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20,
              background: `${rank.color}18`, color: rank.color, border: `1px solid ${rank.color}30`,
            }}>
              {rank.label}
            </span>
            <span style={{ fontSize: 10, color: '#4B5563' }}>{p.elo} ELO</span>
            {p.matchesPlayed > 0 && (
              <span style={{ fontSize: 10, color: '#374151' }}>{p.matchesPlayed} матчей</span>
            )}
          </div>
        </button>

        {actions}
      </div>
    </motion.div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub, action }: {
  icon: string; title: string; sub: string; action?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 }}
      style={{ textAlign: 'center', padding: '60px 20px' }}
    >
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{ fontSize: 52, marginBottom: 16 }}
      >
        {icon}
      </motion.div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 20 }}>{sub}</div>
      {action}
    </motion.div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FriendsPage() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('friends')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [friends, setFriends] = useState<Player[]>([])
  const [requests, setRequests] = useState<Player[]>([])
  const [searching, setSearching] = useState(false)
  const debounce = useRef<NodeJS.Timeout>()

  useEffect(() => {
    api.get('/users/friends').then(r => setFriends(r.data)).catch(() => {})
    api.get('/users/friends/requests').then(r => setRequests(r.data)).catch(() => {})
  }, [])

  const handleSearch = (q: string) => {
    setQuery(q)
    clearTimeout(debounce.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      try {
        const r = await api.get(`/users/search?q=${encodeURIComponent(q)}`)
        setSearchResults(r.data)
      } finally { setSearching(false) }
    }, 350)
  }

  const acceptRequest = async (fromId: number) => {
    await api.post(`/users/${fromId}/friend/accept`)
    const accepted = requests.find(r => r.id === fromId)
    setRequests(p => p.filter(r => r.id !== fromId))
    if (accepted) setFriends(p => [...p, accepted])
  }

  const declineRequest = async (fromId: number) => {
    await api.delete(`/users/${fromId}/friend`)
    setRequests(p => p.filter(r => r.id !== fromId))
  }

  const removeFriend = async (id: number) => {
    await api.delete(`/users/${id}/friend`)
    setFriends(p => p.filter(f => f.id !== id))
  }

  const TABS: { key: Tab; label: string; badge?: number }[] = [
    { key: 'friends',  label: '👥 Друзья',  badge: friends.length  },
    { key: 'requests', label: '📬 Запросы', badge: requests.length },
    { key: 'search',   label: '🔍 Поиск'                           },
  ]

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 96 }}>
        <div style={{ padding: '0 16px', position: 'relative', zIndex: 1 }}>

          {/* ── HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{ paddingTop: 24, marginBottom: 18 }}
          >
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.15))',
                  border: '1px solid rgba(34,197,94,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>👥</div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.5px', lineHeight: 1 }}>
                    Друзья
                  </h1>
                  {friends.length > 0 && (
                    <div style={{ fontSize: 11, color: '#22C55E', fontWeight: 600, marginTop: 2 }}>
                      {friends.length} {friends.length === 1 ? 'игрок' : friends.length < 5 ? 'игрока' : 'игроков'}
                    </div>
                  )}
                </div>
              </div>

              {/* Friends count badge */}
              {friends.length > 0 && (
                <div style={{
                  background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                  borderRadius: 20, padding: '4px 12px',
                  fontSize: 12, fontWeight: 800, color: '#22C55E',
                }}>
                  {friends.length}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 6,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, padding: 4,
            }}>
              {TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 10,
                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    position: 'relative', transition: 'all 0.2s',
                    background: tab === t.key
                      ? 'linear-gradient(135deg, rgba(34,197,94,0.85), rgba(16,185,129,0.9))'
                      : 'transparent',
                    border: 'none',
                    color: tab === t.key ? '#fff' : '#4B5563',
                    boxShadow: tab === t.key ? '0 2px 12px rgba(34,197,94,0.3)' : 'none',
                  }}
                >
                  {t.label}
                  {t.badge !== undefined && t.badge > 0 && tab !== t.key && (
                    <span style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 14, height: 14, background: '#22C55E',
                      borderRadius: '50%', fontSize: 8, color: '#000',
                      fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {t.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── CONTENT ── */}
          <AnimatePresence mode="wait">

            {/* FRIENDS */}
            {tab === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18 }}
              >
                {friends.length === 0 ? (
                  <EmptyState
                    icon="👥"
                    title="Список друзей пуст"
                    sub="Найди игроков через поиск и добавь их в друзья"
                    action={
                      <motion.button
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setTab('search')}
                        style={{
                          padding: '11px 24px', borderRadius: 12, border: 'none',
                          background: 'linear-gradient(135deg, rgba(34,197,94,0.85), rgba(16,185,129,0.9))',
                          color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                          boxShadow: '0 2px 14px rgba(34,197,94,0.3)',
                        }}
                      >
                        🔍 Найти игроков
                      </motion.button>
                    }
                  />
                ) : (
                  friends.map((p, i) => (
                    <FriendCard
                      key={p.id}
                      p={p}
                      delay={i * 0.04}
                      onClick={() => router.push(`/player/${p.id}`)}
                      actions={
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={e => { e.stopPropagation(); removeFriend(p.id) }}
                          style={{
                            width: 32, height: 32, borderRadius: 8, border: 'none', flexShrink: 0,
                            background: 'rgba(239,68,68,0.08)',
                            color: '#EF444466', fontSize: 16, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => {
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)'
                            ;(e.currentTarget as HTMLButtonElement).style.color = '#EF4444'
                          }}
                          onMouseLeave={e => {
                            ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'
                            ;(e.currentTarget as HTMLButtonElement).style.color = '#EF444466'
                          }}
                        >
                          ✕
                        </motion.button>
                      }
                    />
                  ))
                )}
              </motion.div>
            )}

            {/* REQUESTS */}
            {tab === 'requests' && (
              <motion.div
                key="requests"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18 }}
              >
                {requests.length === 0 ? (
                  <EmptyState
                    icon="📬"
                    title="Нет входящих запросов"
                    sub="Когда кто-то добавит тебя в друзья — запрос появится здесь"
                  />
                ) : (
                  <>
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        marginBottom: 12, padding: '10px 14px', borderRadius: 12,
                        background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.2)',
                        display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <span>📬</span>
                      <span style={{ fontSize: 12, color: '#EAB308', fontWeight: 700 }}>
                        {requests.length} {requests.length === 1 ? 'входящий запрос' : 'входящих запроса'}
                      </span>
                    </motion.div>

                    {requests.map((p, i) => (
                      <FriendCard
                        key={p.id}
                        p={p}
                        delay={i * 0.04}
                        onClick={() => router.push(`/player/${p.id}`)}
                        actions={
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              onClick={e => { e.stopPropagation(); acceptRequest(p.id) }}
                              style={{
                                width: 36, height: 36, borderRadius: 10, border: 'none',
                                background: 'linear-gradient(135deg, rgba(34,197,94,0.8), rgba(16,185,129,0.9))',
                                color: '#fff', fontSize: 16, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                boxShadow: '0 2px 10px rgba(34,197,94,0.3)',
                              }}
                            >
                              ✓
                            </motion.button>
                            <motion.button
                              whileTap={{ scale: 0.92 }}
                              onClick={e => { e.stopPropagation(); declineRequest(p.id) }}
                              style={{
                                width: 36, height: 36, borderRadius: 10,
                                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)',
                                color: '#4B5563', fontSize: 16, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              ✕
                            </motion.button>
                          </div>
                        }
                      />
                    ))}
                  </>
                )}
              </motion.div>
            )}

            {/* SEARCH */}
            {tab === 'search' && (
              <motion.div
                key="search"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18 }}
              >
                {/* Search input */}
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <div style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 16, pointerEvents: 'none',
                  }}>🔍</div>
                  <input
                    type="text"
                    value={query}
                    onChange={e => handleSearch(e.target.value)}
                    placeholder="Ник или Game ID..."
                    autoFocus
                    style={{
                      width: '100%', borderRadius: 14,
                      padding: '14px 44px 14px 42px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(34,197,94,0.25)',
                      color: '#fff', fontSize: 14, outline: 'none',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)' }}
                    onBlur={e =>  { e.currentTarget.style.borderColor = 'rgba(34,197,94,0.25)' }}
                  />
                  {searching && (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        width: 16, height: 16, borderRadius: '50%',
                        border: '2px solid rgba(34,197,94,0.3)',
                        borderTopColor: '#22C55E',
                      }}
                    />
                  )}
                </div>

                {/* Results */}
                <AnimatePresence>
                  {query.length >= 2 && !searching && searchResults.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{ textAlign: 'center', padding: '40px 0', color: '#4B5563' }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
                      <div style={{ fontSize: 13 }}>Игроки не найдены</div>
                    </motion.div>
                  )}

                  {query.length < 2 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: '16px', borderRadius: 14, textAlign: 'center',
                        background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)',
                      }}
                    >
                      <div style={{ fontSize: 11, color: '#4B5563' }}>
                        Введи минимум 2 символа для поиска по нику или Game ID
                      </div>
                    </motion.div>
                  )}

                  {searchResults.map((p, i) => (
                    <FriendCard
                      key={p.id}
                      p={p}
                      delay={i * 0.03}
                      onClick={() => router.push(`/player/${p.id}`)}
                      actions={
                        <motion.button
                          whileTap={{ scale: 0.94 }}
                          onClick={e => { e.stopPropagation(); router.push(`/player/${p.id}`) }}
                          style={{
                            padding: '7px 12px', borderRadius: 10, border: 'none',
                            background: 'rgba(34,197,94,0.12)',
                            color: '#22C55E', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                            border: '1px solid rgba(34,197,94,0.25)',
                            whiteSpace: 'nowrap', flexShrink: 0,
                          } as any}
                        >
                          Профиль →
                        </motion.button>
                      }
                    />
                  ))}
                </AnimatePresence>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </RequireRegistration>
  )
}
