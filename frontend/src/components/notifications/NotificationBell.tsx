'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useUiStore } from '@/store/uiStore'
import { Icon, IconName } from '@/components/ui/Icon'

interface Notification {
  id: number
  type: string
  title: string
  body: string | null
  isRead: boolean
  createdAt: string
  meta?: any
}

// тип → иконка + цвет (выдержанная гамма платформы)
const TYPE_META: Record<string, { icon: IconName; color: string }> = {
  party_invite:  { icon: 'users',     color: '#E8092E' },
  match:         { icon: 'swords',    color: '#E8092E' },
  match_found:   { icon: 'swords',    color: '#E8092E' },
  penalty:       { icon: 'ban',       color: '#EF4444' },
  clan_invite:   { icon: 'shield',    color: '#22C55E' },
  clan_joined:   { icon: 'shield',    color: '#22C55E' },
  clan_officer:  { icon: 'crown',     color: '#22C55E' },
  clan_kicked:   { icon: 'ban',       color: '#EF4444' },
  clan_update:   { icon: 'shield',    color: '#22C55E' },
  clan_battle:   { icon: 'swords',    color: '#22C55E' },
  clan_challenge:{ icon: 'swords',    color: '#22C55E' },
  achievement:   { icon: 'trophy',    color: '#EAB308' },
  coins:         { icon: 'coins',     color: '#EAB308' },
  premium:       { icon: 'gem',       color: '#A855F7' },
  nickname:      { icon: 'pencil',    color: '#60A5FA' },
  warn:          { icon: 'warning',   color: '#F59E0B' },
  friends:       { icon: 'users',     color: '#60A5FA' },
  friend_request:{ icon: 'users',     color: '#60A5FA' },
  cpl_points:    { icon: 'star',      color: '#E8092E' },
  cpl_eliminated:{ icon: 'ban',       color: '#EF4444' },
  cpl_danger:    { icon: 'warning',   color: '#F59E0B' },
  cpl_access:    { icon: 'crown',     color: '#E8092E' },
  cpl_standings: { icon: 'trophy',    color: '#E8092E' },
  cpl_seasons:   { icon: 'trophy',    color: '#E8092E' },
  cplq_danger:   { icon: 'warning',   color: '#F59E0B' },
  cplq_access:   { icon: 'crown',     color: '#F59E0B' },
  support_reply: { icon: 'chat',      color: '#60A5FA' },
  support_closed:{ icon: 'check-circle', color: '#22C55E' },
  system:        { icon: 'megaphone', color: '#9CA3AF' },
}
const metaFor = (t: string) => TYPE_META[t] || { icon: 'megaphone' as IconName, color: '#9CA3AF' }

// тип+meta → маршрут перехода ('' = без перехода)
function hrefFor(n: Notification): string {
  const m = n.meta || {}
  switch (n.type) {
    case 'party_invite': return '' // inline accept/decline
    case 'clan_invite': case 'clan_joined': case 'clan_kicked': case 'clan_officer':
    case 'clan_update': case 'clan_battle': case 'clan_challenge': return '/clans'
    case 'match': case 'match_found': return m.matchId ? `/match/${m.matchId}` : '/history'
    case 'penalty': return '/dashboard'
    case 'achievement': return '/missions'
    case 'coins': case 'premium': return '/shop'
    case 'nickname': case 'warn': return '/profile'
    case 'friends': case 'friend_request': return '/friends'
    case 'support_reply': case 'support_closed': return '/support'
    case 'cpl_points': case 'cpl_eliminated': case 'cpl_danger': case 'cpl_access':
    case 'cpl_standings': case 'cpl_seasons': case 'cplq_danger': case 'cplq_access': return '/leaderboard'
    default: return ''
  }
}

export function NotificationBell() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [busy, setBusy] = useState<number | null>(null)
  const { setHideNav } = useUiStore()

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchUnread = async () => {
    try { const r = await api.get('/notifications/unread-count'); setUnread(typeof r.data === 'number' ? r.data : r.data.count ?? 0) } catch {}
  }

  const close = () => { setOpen(false); setHideNav(false) }

  const openPanel = async () => {
    setOpen(true); setHideNav(true)
    try {
      const r = await api.get('/notifications')
      const DAY = 24 * 3600 * 1000
      setNotifications((r.data as Notification[]).filter(n => Date.now() - new Date(n.createdAt).getTime() < DAY))
      if (unread > 0) { await api.post('/notifications/read-all'); setUnread(0) }
    } catch {}
  }

  const go = (href: string) => { if (!href) return; close(); router.push(href) }

  const acceptParty = async (n: Notification) => {
    setBusy(n.id)
    try {
      await api.post('/party/accept', { partyId: n.meta?.partyId })
      api.delete(`/notifications/${n.id}`).catch(() => {})
      setNotifications(l => l.filter(x => x.id !== n.id)); close(); router.push('/dashboard')
    }
    catch (e: any) { alert(e?.response?.data?.message || 'Не удалось принять') }
    finally { setBusy(null) }
  }
  const declineParty = async (n: Notification) => {
    setBusy(n.id)
    try {
      await api.post('/party/decline', { partyId: n.meta?.partyId })
      api.delete(`/notifications/${n.id}`).catch(() => {})
      setNotifications(l => l.filter(x => x.id !== n.id))
    }
    catch {} finally { setBusy(null) }
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime(); const m = Math.floor(diff / 60000)
    if (m < 1) return 'только что'; if (m < 60) return `${m}м назад`
    const h = Math.floor(m / 60); if (h < 24) return `${h}ч назад`; return `${Math.floor(h / 24)}д назад`
  }

  return (
    <>
      <button onClick={openPanel} style={{ position: 'relative', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 11, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.07)' }}>
        <Icon name="bell" size={18} color="#E5E7EB" />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px', background: '#E8092E', borderRadius: 9, fontSize: 10, fontWeight: 900, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 10px rgba(232,9,46,0.6)', border: '2px solid #0a0a0f' }}>
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} onClick={close} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(380px, 90vw)', zIndex: 121, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, rgba(16,16,22,0.98), rgba(8,8,11,0.98))', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', borderLeft: '1px solid rgba(255,255,255,0.08)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)' }}>
              {/* Header */}
              <div style={{ position: 'relative', padding: '46px 18px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 20, right: -20, width: 120, height: 120, background: 'radial-gradient(circle, rgba(232,9,46,0.16), transparent 70%)', pointerEvents: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: 'linear-gradient(135deg, #E8092E, #b4001e)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 18px rgba(232,9,46,0.4)' }}><Icon name="bell" size={19} color="#fff" /></div>
                    <div><div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>Уведомления</div><div style={{ fontSize: 11, color: '#6B7280' }}>{notifications.length ? `${notifications.length} всего` : 'Лента событий'}</div></div>
                  </div>
                  <button onClick={close} style={{ width: 32, height: 32, borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} color="#9CA3AF" /></button>
                </div>
              </div>

              {/* List */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 24px', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {notifications.length === 0 ? (
                  <div style={{ margin: 'auto', textAlign: 'center', color: '#4B5563', padding: '40px 0' }}>
                    <div style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="bell" size={30} color="#374151" /></div>
                    <p style={{ fontSize: 14, color: '#6B7280' }}>Уведомлений пока нет</p>
                  </div>
                ) : notifications.map((n, i) => {
                  const tm = metaFor(n.type)
                  const isParty = n.type === 'party_invite'
                  const href = hrefFor(n)
                  const clickable = !isParty && !!href
                  return (
                    <motion.div key={n.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.035, 0.4), type: 'spring', stiffness: 320, damping: 26 }}
                      whileTap={clickable ? { scale: 0.98 } : undefined}
                      onClick={clickable ? () => go(href) : undefined}
                      style={{ position: 'relative', overflow: 'hidden', borderRadius: 15, padding: 13, cursor: clickable ? 'pointer' : 'default', flexShrink: 0,
                        background: n.isRead ? 'rgba(255,255,255,0.03)' : `linear-gradient(135deg, ${tm.color}14, rgba(255,255,255,0.03) 60%)`,
                        border: `1px solid ${n.isRead ? 'rgba(255,255,255,0.06)' : tm.color + '44'}` }}>
                      {!n.isRead && <div style={{ position: 'absolute', top: 0, left: '12%', right: '12%', height: 1, background: `linear-gradient(90deg, transparent, ${tm.color}, transparent)` }} />}
                      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: `${tm.color}18`, border: `1px solid ${tm.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={tm.icon} size={19} color={tm.color} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', flex: 1, lineHeight: 1.25 }}>{n.title}</span>
                            {!n.isRead && <span style={{ width: 7, height: 7, borderRadius: '50%', background: tm.color, flexShrink: 0, boxShadow: `0 0 6px ${tm.color}` }} />}
                            {clickable && <Icon name="chevronRight" size={15} color="#4B5563" />}
                          </div>
                          {n.body && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3, lineHeight: 1.4 }}>{n.body}</div>}
                          <div style={{ fontSize: 10, color: '#4B5563', marginTop: 5, fontWeight: 600 }}>{timeAgo(n.createdAt)}</div>

                          {isParty && (
                            <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
                              <button onClick={(e) => { e.stopPropagation(); acceptParty(n) }} disabled={busy === n.id}
                                style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #E8092E, #b4001e)', boxShadow: '0 4px 14px rgba(232,9,46,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                                <Icon name="check" size={14} color="#fff" />{busy === n.id ? '…' : 'Принять'}
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); declineParty(n) }} disabled={busy === n.id}
                                style={{ padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#9CA3AF', background: 'rgba(255,255,255,0.04)' }}>
                                Отклонить
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
