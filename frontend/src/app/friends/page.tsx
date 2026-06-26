'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { useAuthStore } from '@/store/authStore'
import { getEloRank } from '@/lib/eloRank'
import { Icon, IconName } from '@/components/ui/Icon'
import { connectSocket } from '@/lib/socket'

const GREEN = '#22C55E'
const PARTY = '#A855F7'
const CARD_BG = 'rgba(255,255,255,0.04)'

type Tab = 'friends' | 'requests' | 'search'

interface Player {
  id: number
  gameNickname: string | null
  firstName: string
  username: string | null
  avatarUrl: string | null
  elo: number
  matchesPlayed: number
  winRate?: number
  online?: boolean
}

type PartyLite = { maxSize: number; members: { id: number }[]; invites: { id: number }[] } | null

// ── Party invite button ──────────────────────────────────────────────────────────
function PartyInviteButton({ p, party, locallyInvited, full, onInvite }: {
  p: Player; party: PartyLite; locallyInvited: boolean; full: boolean; onInvite: () => void
}) {
  const inParty = party?.members?.some(m => m.id === p.id)
  const invited = locallyInvited || party?.invites?.some(m => m.id === p.id)

  if (inParty) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 10, background: `${PARTY}1a`, border: `1px solid ${PARTY}33`, color: PARTY, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
      <Icon name="check" size={12} color={PARTY} />В отряде
    </div>
  )
  if (invited) return (
    <div style={{ padding: '7px 11px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>Позван</div>
  )
  return (
    <motion.button whileTap={{ scale: 0.92 }} onClick={e => { e.stopPropagation(); if (!full) onInvite() }} disabled={full}
      title={full ? 'Отряд заполнен' : 'Пригласить в отряд'}
      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 11px', borderRadius: 10, border: 'none', cursor: full ? 'not-allowed' : 'pointer', fontSize: 11, fontWeight: 800, color: '#fff', background: full ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${PARTY}, #7c3aed)`, boxShadow: full ? 'none' : `0 3px 12px ${PARTY}44`, opacity: full ? 0.5 : 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <Icon name="users" size={13} color="#fff" />В отряд
    </motion.button>
  )
}

// ── Friend card ───────────────────────────────────────────────────────────────────
function FriendCard({ p, delay = 0, actions, onClick }: { p: Player; delay?: number; actions?: React.ReactNode; onClick: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const rank = getEloRank(p.elo)

  const track = (cx: number, cy: number) => {
    const el = ref.current; if (!el) return
    const r = el.getBoundingClientRect()
    const x = (cx - r.left) / r.width - 0.5
    const y = (cy - r.top) / r.height - 0.5
    el.style.transform = `perspective(700px) rotateX(${-y * 9}deg) rotateY(${x * 9}deg) scale(1.015)`
    const shine = el.querySelector('.fshine') as HTMLElement | null
    if (shine) shine.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, ${rank.color}22 0%, transparent 60%)`
  }
  const reset = () => {
    const el = ref.current; if (!el) return
    el.style.transform = 'perspective(700px) rotateX(0) rotateY(0) scale(1)'
    const shine = el.querySelector('.fshine') as HTMLElement | null
    if (shine) shine.style.background = 'none'
  }

  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 280, damping: 24 }}
      onMouseMove={e => track(e.clientX, e.clientY)} onMouseLeave={reset}
      onTouchMove={e => { const t = e.touches[0]; track(t.clientX, t.clientY) }} onTouchEnd={reset}
      style={{ marginBottom: 10 }}>
      <div ref={ref} style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 14, borderRadius: 16, background: `radial-gradient(130% 130% at 0% 0%, ${rank.color}12, transparent 52%), ${CARD_BG}`, border: `1px solid ${rank.color}26`, boxShadow: `0 6px 22px ${rank.color}0d`, position: 'relative', overflow: 'hidden', transition: 'transform 0.15s ease', willChange: 'transform' }}>
        <div className="fshine" style={{ position: 'absolute', inset: 0, borderRadius: 16, pointerEvents: 'none', transition: 'background 0.08s' }} />
        <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg, transparent, ${rank.color}55, transparent)` }} />

        {/* avatar */}
        <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0 }}>
          <Avatar avatarUrl={p.avatarUrl} name={p.gameNickname || p.firstName} size={48} style={{ border: `2px solid ${rank.color}40` }} />
          {/* online dot */}
          {p.online !== undefined && (
            <div style={{ position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: '50%', background: p.online ? GREEN : '#4B5563', border: '2.5px solid #0c0c11', boxShadow: p.online ? `0 0 6px ${GREEN}` : 'none' }} />
          )}
          {/* rank emblem (jpg orb) */}
          <div style={{ position: 'absolute', top: -5, left: -5, width: 24, height: 24, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${rank.color}`, background: '#060608', boxShadow: `0 0 9px ${rank.color}88, 0 2px 6px rgba(0,0,0,0.5)` }}>
            <img src={`/ranks/${rank.level}.jpg?v=2`} alt="" width={24} height={24} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>
        </button>

        {/* info */}
        <button onClick={onClick} style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 15, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 4 }}>{p.gameNickname || p.firstName}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
            <span style={{ fontSize: 13, fontWeight: 900, color: rank.color, letterSpacing: '-0.02em' }}>{p.elo.toLocaleString()}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.06em' }}>ELO</span>
          </div>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, position: 'relative' }}>{actions}</div>
      </div>
    </motion.div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub, action }: { icon: IconName; title: string; sub: string; action?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }} style={{ textAlign: 'center', padding: '54px 20px' }}>
      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }} style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', color: '#374151' }}>
        <Icon name={icon} size={50} strokeWidth={1.5} />
      </motion.div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 20 }}>{sub}</div>
      {action}
    </motion.div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────────
export default function FriendsPage() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('friends')
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Player[]>([])
  const [friends, setFriends] = useState<Player[]>([])
  const [requests, setRequests] = useState<Player[]>([])
  const [searching, setSearching] = useState(false)
  const [party, setParty] = useState<PartyLite>(null)
  const [partyInvited, setPartyInvited] = useState<Set<number>>(new Set())
  const debounce = useRef<NodeJS.Timeout>()

  const loadParty = useCallback(() => { api.get('/party').then(r => setParty(r.data?.party ?? null)).catch(() => {}) }, [])

  useEffect(() => {
    api.get('/users/friends').then(r => setFriends(r.data)).catch(() => {})
    api.get('/users/friends/requests').then(r => setRequests(r.data)).catch(() => {})
    loadParty()
    const s = connectSocket()
    const h = () => loadParty()
    s.on('party_updated', h); s.on('party_invite', h)
    return () => { s.off('party_updated', h); s.off('party_invite', h) }
  }, [loadParty])

  const maxSize = party?.maxSize ?? (user?.isPremium ? 5 : 3)
  const partyTotal = (party?.members?.length ?? 1) + (party?.invites?.length ?? 0)
  const partyFull = partyTotal >= maxSize

  const inviteToParty = async (id: number) => {
    try { await api.post('/party/invite', { userId: id }); setPartyInvited(s => new Set(s).add(id)); loadParty() }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }

  const handleSearch = (q: string) => {
    setQuery(q)
    clearTimeout(debounce.current)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    debounce.current = setTimeout(async () => {
      try { const r = await api.get(`/users/search?q=${encodeURIComponent(q)}`); setSearchResults(r.data) }
      finally { setSearching(false) }
    }, 350)
  }

  const acceptRequest = async (fromId: number) => {
    await api.post(`/users/${fromId}/friend/accept`)
    const accepted = requests.find(r => r.id === fromId)
    setRequests(p => p.filter(r => r.id !== fromId))
    if (accepted) setFriends(p => [...p, accepted])
  }
  const declineRequest = async (fromId: number) => { await api.delete(`/users/${fromId}/friend`); setRequests(p => p.filter(r => r.id !== fromId)) }
  const removeFriend = async (id: number) => { await api.delete(`/users/${id}/friend`); setFriends(p => p.filter(f => f.id !== id)) }

  const sortedFriends = [...friends].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))
  const onlineCount = friends.filter(f => f.online).length

  const TABS: { key: Tab; icon: IconName; label: string; badge?: number }[] = [
    { key: 'friends', icon: 'users', label: 'Друзья', badge: friends.length },
    { key: 'requests', icon: 'mail', label: 'Запросы', badge: requests.length },
    { key: 'search', icon: 'search', label: 'Поиск' },
  ]

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 96 }}>
        <div style={{ padding: '0 16px', position: 'relative', zIndex: 1 }}>

          {/* HEADER */}
          <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }} style={{ paddingTop: 24, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${GREEN}, #10B981)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 22px ${GREEN}55` }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
                <Icon name="users" size={23} color="#fff" />
              </div>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>Друзья</h1>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                  {friends.length > 0 ? <>{friends.length} в списке{onlineCount > 0 && <span style={{ color: GREEN, fontWeight: 700 }}> · {onlineCount} в сети</span>}</> : 'Собирай команду мечты'}
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 4 }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  style={{ flex: 1, position: 'relative', padding: '10px 4px', borderRadius: 10, fontSize: 12.5, fontWeight: 800, cursor: 'pointer', background: 'none', border: 'none', color: tab === t.key ? '#fff' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'color .2s' }}>
                  {tab === t.key && <motion.div layoutId="friendTab" style={{ position: 'absolute', inset: 0, borderRadius: 10, background: `linear-gradient(135deg, ${GREEN}cc, #10B981cc)`, zIndex: -1, boxShadow: `0 4px 14px ${GREEN}40` }} />}
                  <Icon name={t.icon} size={14} color={tab === t.key ? '#fff' : '#6B7280'} />{t.label}
                  {t.badge !== undefined && t.badge > 0 && tab !== t.key && (
                    <span style={{ position: 'absolute', top: 3, right: 6, minWidth: 15, height: 15, padding: '0 4px', background: '#E8092E', borderRadius: 8, fontSize: 9, color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* CONTENT */}
          <AnimatePresence mode="wait">
            {/* FRIENDS */}
            {tab === 'friends' && (
              <motion.div key="friends" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.18 }}>
                {friends.length === 0 ? (
                  <EmptyState icon="users" title="Список друзей пуст" sub="Найди игроков через поиск и добавь их в друзья"
                    action={<motion.button whileTap={{ scale: 0.96 }} onClick={() => setTab('search')} style={{ padding: '12px 24px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${GREEN}, #10B981)`, color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', boxShadow: `0 6px 18px ${GREEN}40`, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="search" size={14} color="#fff" />Найти игроков</motion.button>} />
                ) : (
                  sortedFriends.map((p, i) => (
                    <FriendCard key={p.id} p={p} delay={Math.min(i * 0.04, 0.3)} onClick={() => router.push(`/player/${p.id}`)}
                      actions={<>
                        <PartyInviteButton p={p} party={party} locallyInvited={partyInvited.has(p.id)} full={partyFull} onInvite={() => inviteToParty(p.id)} />
                        <motion.button whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); removeFriend(p.id) }}
                          style={{ width: 32, height: 32, borderRadius: 9, border: 'none', flexShrink: 0, background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={15} /></motion.button>
                      </>} />
                  ))
                )}
              </motion.div>
            )}

            {/* REQUESTS */}
            {tab === 'requests' && (
              <motion.div key="requests" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.18 }}>
                {requests.length === 0 ? (
                  <EmptyState icon="mail" title="Нет входящих запросов" sub="Когда кто-то добавит тебя в друзья — запрос появится здесь" />
                ) : (
                  requests.map((p, i) => (
                    <FriendCard key={p.id} p={p} delay={Math.min(i * 0.04, 0.3)} onClick={() => router.push(`/player/${p.id}`)}
                      actions={
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          <motion.button whileTap={{ scale: 0.92 }} onClick={e => { e.stopPropagation(); acceptRequest(p.id) }}
                            style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GREEN}, #10B981)`, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 12px ${GREEN}40` }}><Icon name="check" size={16} /></motion.button>
                          <motion.button whileTap={{ scale: 0.92 }} onClick={e => { e.stopPropagation(); declineRequest(p.id) }}
                            style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} /></motion.button>
                        </div>
                      } />
                  ))
                )}
              </motion.div>
            )}

            {/* SEARCH */}
            {tab === 'search' && (
              <motion.div key="search" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.18 }}>
                <div style={{ position: 'relative', marginBottom: 16 }}>
                  <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: GREEN, display: 'flex' }}><Icon name="search" size={16} /></div>
                  <input type="text" value={query} onChange={e => handleSearch(e.target.value)} placeholder="Ник или Game ID…" autoFocus
                    style={{ width: '100%', borderRadius: 14, padding: '14px 44px 14px 42px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${GREEN}33`, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
                  {searching && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: '50%', border: `2px solid ${GREEN}40`, borderTopColor: GREEN }} />}
                </div>

                <AnimatePresence>
                  {query.length >= 2 && !searching && searchResults.length === 0 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', padding: '40px 0', color: '#4B5563' }}>
                      <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Icon name="search" size={32} strokeWidth={1.5} /></div>
                      <div style={{ fontSize: 13 }}>Игроки не найдены</div>
                    </motion.div>
                  )}
                  {query.length < 2 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ padding: 16, borderRadius: 14, textAlign: 'center', background: `${GREEN}0d`, border: `1px solid ${GREEN}1f` }}>
                      <div style={{ fontSize: 12, color: '#6B7280' }}>Введи минимум 2 символа для поиска по нику или Game ID</div>
                    </motion.div>
                  )}
                  {searchResults.map((p, i) => (
                    <FriendCard key={p.id} p={p} delay={Math.min(i * 0.03, 0.3)} onClick={() => router.push(`/player/${p.id}`)}
                      actions={<motion.button whileTap={{ scale: 0.94 }} onClick={e => { e.stopPropagation(); router.push(`/player/${p.id}`) }}
                        style={{ padding: '8px 13px', borderRadius: 10, background: `${GREEN}14`, color: GREEN, fontSize: 11, fontWeight: 800, cursor: 'pointer', border: `1px solid ${GREEN}30`, whiteSpace: 'nowrap', flexShrink: 0 }}>Профиль →</motion.button>} />
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
