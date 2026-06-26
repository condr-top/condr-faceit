'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { getEloRank } from '@/lib/eloRank'
import { Icon, IconName } from '@/components/ui/Icon'
import { connectSocket } from '@/lib/socket'

const GREEN = '#22C55E', PARTY = '#A855F7'
type Tab = 'friends' | 'requests' | 'search'

interface Player { id: number; gameNickname: string | null; firstName: string; avatarUrl: string | null; elo: number; matchesPlayed: number; winRate?: number; online?: boolean }
type PartyLite = { maxSize: number; members: { id: number }[]; invites: { id: number }[] } | null

function PartyBtn({ p, party, locallyInvited, full, onInvite }: { p: Player; party: PartyLite; locallyInvited: boolean; full: boolean; onInvite: () => void }) {
  const inParty = party?.members?.some(m => m.id === p.id)
  const invited = locallyInvited || party?.invites?.some(m => m.id === p.id)
  if (inParty) return <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 12px', borderRadius: 10, background: `${PARTY}1a`, border: `1px solid ${PARTY}33`, color: PARTY, fontSize: 12, fontWeight: 800 }}><Icon name="check" size={12} color={PARTY} />В отряде</div>
  if (invited) return <div style={{ padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', fontSize: 12, fontWeight: 800 }}>Позван</div>
  return <button onClick={() => !full && onInvite()} disabled={full} title={full ? 'Отряд заполнен' : 'Пригласить в отряд'} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '8px 13px', borderRadius: 10, border: 'none', cursor: full ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 800, color: '#fff', background: full ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${PARTY}, #7c3aed)`, opacity: full ? 0.5 : 1 }}><Icon name="users" size={13} color="#fff" />В отряд</button>
}

function Card({ p, actions }: { p: Player; actions: React.ReactNode }) {
  const router = useRouter()
  const rank = getEloRank(p.elo)
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 14, borderRadius: 14, background: `radial-gradient(130% 130% at 0% 0%, ${rank.color}10, transparent 52%), rgba(255,255,255,0.03)`, border: `1px solid ${rank.color}26` }}>
      <button onClick={() => router.push(`/player/${p.id}`)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0 }}>
        <Avatar avatarUrl={p.avatarUrl} name={p.gameNickname || p.firstName} size={48} style={{ border: `2px solid ${rank.color}40` }} />
        {p.online !== undefined && <div style={{ position: 'absolute', right: 0, bottom: 0, width: 13, height: 13, borderRadius: '50%', background: p.online ? GREEN : '#4B5563', border: '2.5px solid #0c0c11', boxShadow: p.online ? `0 0 6px ${GREEN}` : 'none' }} />}
        <div style={{ position: 'absolute', top: -4, left: -4, width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${rank.color}`, boxShadow: `0 0 8px ${rank.color}88` }}><img src={`/ranks/${rank.level}.jpg?v=2`} alt="" width={22} height={22} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.gameNickname || p.firstName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 2 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: rank.color }}>{p.elo.toLocaleString()}</span>
          <span style={{ fontSize: 11, color: '#4B5563' }}>{rank.label}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>{actions}</div>
    </motion.div>
  )
}

export default function WebFriends() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('friends')
  const [friends, setFriends] = useState<Player[]>([])
  const [requests, setRequests] = useState<Player[]>([])
  const [results, setResults] = useState<Player[]>([])
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [party, setParty] = useState<PartyLite>(null)
  const [invited, setInvited] = useState<Set<number>>(new Set())
  const debounce = useRef<NodeJS.Timeout>()

  const loadParty = useCallback(() => { api.get('/party').then(r => setParty(r.data?.party ?? null)).catch(() => {}) }, [])
  useEffect(() => {
    api.get('/users/friends').then(r => setFriends(r.data)).catch(() => {})
    api.get('/users/friends/requests').then(r => setRequests(r.data)).catch(() => {})
    loadParty()
    const s = connectSocket(); const h = () => loadParty(); s.on('party_updated', h); s.on('party_invite', h)
    return () => { s.off('party_updated', h); s.off('party_invite', h) }
  }, [loadParty])

  const maxSize = party?.maxSize ?? (user?.isPremium ? 5 : 3)
  const full = ((party?.members?.length ?? 1) + (party?.invites?.length ?? 0)) >= maxSize
  const invite = async (id: number) => { try { await api.post('/party/invite', { userId: id }); setInvited(s => new Set(s).add(id)); loadParty() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } }

  const onSearch = (q: string) => {
    setQuery(q); clearTimeout(debounce.current)
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    debounce.current = setTimeout(async () => { try { const r = await api.get(`/users/search?q=${encodeURIComponent(q)}`); setResults(r.data) } finally { setSearching(false) } }, 350)
  }
  const accept = async (id: number) => { await api.post(`/users/${id}/friend/accept`); const a = requests.find(r => r.id === id); setRequests(p => p.filter(r => r.id !== id)); if (a) setFriends(p => [...p, a]) }
  const decline = async (id: number) => { await api.delete(`/users/${id}/friend`); setRequests(p => p.filter(r => r.id !== id)) }
  const removeF = async (id: number) => { await api.delete(`/users/${id}/friend`); setFriends(p => p.filter(f => f.id !== id)) }

  const sorted = [...friends].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))
  const online = friends.filter(f => f.online).length
  const TABS: { key: Tab; label: string; icon: IconName; badge?: number }[] = [
    { key: 'friends', label: 'Друзья', icon: 'users', badge: friends.length },
    { key: 'requests', label: 'Запросы', icon: 'mail', badge: requests.length },
    { key: 'search', label: 'Поиск', icon: 'search' },
  ]

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 22 }}>
        <div style={{ position: 'relative', width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg, ${GREEN}, #10B981)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 22px ${GREEN}55` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
          <Icon name="users" size={24} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Друзья</h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{friends.length} в списке{online > 0 && <span style={{ color: GREEN, fontWeight: 700 }}> · {online} в сети</span>}</div>
        </div>
      </motion.div>

      <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 4, marginBottom: 20, maxWidth: 460 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, position: 'relative', padding: '10px 4px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: 'none', border: 'none', color: tab === t.key ? '#fff' : '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {tab === t.key && <motion.div layoutId="webFriendTab" style={{ position: 'absolute', inset: 0, borderRadius: 10, background: `linear-gradient(135deg, ${GREEN}cc, #10B981cc)`, zIndex: -1, boxShadow: `0 4px 14px ${GREEN}40` }} />}
            <Icon name={t.icon} size={14} color={tab === t.key ? '#fff' : '#6B7280'} />{t.label}
            {t.badge ? <span style={{ position: 'absolute', top: 3, right: 8, minWidth: 15, height: 15, padding: '0 4px', background: '#E8092E', borderRadius: 8, fontSize: 9, color: '#fff', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.badge}</span> : null}
          </button>
        ))}
      </div>

      {tab === 'search' && (
        <div style={{ position: 'relative', marginBottom: 18, maxWidth: 560 }}>
          <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: GREEN }}><Icon name="search" size={16} /></div>
          <input value={query} onChange={e => onSearch(e.target.value)} placeholder="Ник или Game ID…" autoFocus style={{ width: '100%', boxSizing: 'border-box', borderRadius: 14, padding: '14px 16px 14px 42px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${GREEN}33`, color: '#fff', fontSize: 14, outline: 'none' }} />
          {searching && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: '50%', border: `2px solid ${GREEN}40`, borderTopColor: GREEN }} />}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
        {tab === 'friends' && sorted.map(p => <Card key={p.id} p={p} actions={<>
          <PartyBtn p={p} party={party} locallyInvited={invited.has(p.id)} full={full} onInvite={() => invite(p.id)} />
          <button onClick={() => removeF(p.id)} style={{ width: 34, height: 34, borderRadius: 9, border: 'none', background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={15} /></button>
        </>} />)}
        {tab === 'requests' && requests.map(p => <Card key={p.id} p={p} actions={<>
          <button onClick={() => accept(p.id)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: `linear-gradient(135deg, ${GREEN}, #10B981)`, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 12px ${GREEN}40` }}><Icon name="check" size={16} /></button>
          <button onClick={() => decline(p.id)} style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#6B7280', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} /></button>
        </>} />)}
        {tab === 'search' && results.map(p => <Card key={p.id} p={p} actions={<button onClick={() => location.assign(`/player/${p.id}`)} style={{ padding: '8px 13px', borderRadius: 10, background: `${GREEN}14`, color: GREEN, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: `1px solid ${GREEN}30` }}>Профиль →</button>} />)}
      </div>

      {((tab === 'friends' && friends.length === 0) || (tab === 'requests' && requests.length === 0)) && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#4B5563' }}>
          <Icon name={tab === 'friends' ? 'users' : 'mail'} size={48} strokeWidth={1.5} />
          <div style={{ fontSize: 15, fontWeight: 700, color: '#9CA3AF', marginTop: 12 }}>{tab === 'friends' ? 'Список друзей пуст' : 'Нет входящих запросов'}</div>
        </div>
      )}
    </div>
  )
}
