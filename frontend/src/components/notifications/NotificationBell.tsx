'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useUiStore } from '@/store/uiStore'

interface Notification {
  id: number
  type: string
  title: string
  body: string | null
  isRead: boolean
  createdAt: string
}

const TYPE_ICON: Record<string, string> = {
  match: '⚔️',
  friend_request: '👥',
  coins: '🪙',
  achievement: '🏆',
  system: '📢',
  report: '🚨',
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const { setHideNav } = useUiStore()

  useEffect(() => {
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchUnread = async () => {
    try {
      const r = await api.get('/notifications/unread-count')
      setUnread(typeof r.data === 'number' ? r.data : r.data.count ?? 0)
    } catch {}
  }

  const openPanel = async () => {
    setOpen(true)
    setHideNav(true)
    try {
      const r = await api.get('/notifications')
      setNotifications(r.data)
      if (unread > 0) {
        await api.post('/notifications/read-all')
        setUnread(0)
      }
    } catch {}
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'только что'
    if (m < 60) return `${m}м назад`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}ч назад`
    return `${Math.floor(h / 24)}д назад`
  }

  return (
    <>
      {/* Bell button */}
      <button
        onClick={openPanel}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl transition-colors"
        style={{ background: 'rgba(255,255,255,0.07)' }}
      >
        <span className="text-lg">🔔</span>
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-brand-red rounded-full text-[10px] font-bold text-white flex items-center justify-center px-1"
            >
              {unread > 9 ? '9+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50"
              style={{ background: 'rgba(0,0,0,0.7)' }}
              onClick={() => { setOpen(false); setHideNav(false) }}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="fixed top-0 right-0 bottom-0 w-80 z-50 flex flex-col"
              style={{
                background: 'rgba(17,17,17,0.97)',
                backdropFilter: 'blur(20px)',
                borderLeft: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex items-center justify-between px-5 pt-10 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <h2 className="font-bold text-lg text-white">Уведомления</h2>
                <button onClick={() => { setOpen(false); setHideNav(false) }} className="text-light-dim text-2xl leading-none">×</button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {notifications.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="text-5xl mb-3">🔔</div>
                    <p className="text-light-dim text-sm">Уведомлений нет</p>
                  </div>
                ) : (
                  notifications.map((n, i) => (
                    <motion.div
                      key={n.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex gap-3 py-3"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
                        style={{ background: 'rgba(255,255,255,0.06)' }}>
                        {TYPE_ICON[n.type] || '📢'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white truncate">{n.title}</p>
                          {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-brand-red flex-shrink-0" />}
                        </div>
                        {n.body && <p className="text-xs mt-0.5 text-light-dim line-clamp-2">{n.body}</p>}
                        <p className="text-[10px] mt-1" style={{ color: '#4B5563' }}>{timeAgo(n.createdAt)}</p>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
