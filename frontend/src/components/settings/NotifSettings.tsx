'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Icon, IconName } from '@/components/ui/Icon'

const ACCENT = '#3B82F6'

// Типы должны совпадать с теми, что бэк реально шлёт в Telegram (telegram-notify)
const TYPES: { key: string; label: string; desc: string; icon: IconName; color: string }[] = [
  { key: 'match_found', label: 'Найдена игра', desc: 'Когда подбор собрал матч', icon: 'swords', color: '#E8092E' },
  { key: 'party_invite', label: 'Приглашение в отряд', desc: 'Когда зовут играть вместе', icon: 'users', color: '#A855F7' },
  { key: 'friend_request', label: 'Заявка в друзья', desc: 'Когда тебя добавляют в друзья', icon: 'user', color: '#22C55E' },
]

/** Настройки: какие важные уведомления слать игроку в Telegram-бот. */
export function NotifSettings() {
  const { user, refreshUser } = useAuthStore()
  const prefs: Record<string, boolean> = (user as any)?.notifPrefs || {}
  const [saving, setSaving] = useState<string | null>(null)

  const isOn = (k: string) => prefs[k] !== false // по умолчанию включено

  const toggle = async (k: string) => {
    setSaving(k)
    try { await api.post('/users/notif-prefs', { prefs: { [k]: !isOn(k) } }); await refreshUser() }
    catch {} finally { setSaving(null) }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.305 }}
      style={{ marginBottom: 14, background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.18)', borderRadius: 14, padding: 14 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <Icon name="bell" size={15} color={ACCENT} />
        <span style={{ fontSize: 10, color: ACCENT, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Уведомления в Telegram</span>
      </div>
      <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.45, marginBottom: 12 }}>
        Выбери, что присылать тебе в бот. В приложении уведомления показываются всегда.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {TYPES.map((t) => {
          const on = isOn(t.key)
          return (
            <div key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 10px', borderRadius: 11, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${t.color}18`, border: `1px solid ${t.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={t.icon} size={17} color={t.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{t.label}</div>
                <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 1 }}>{t.desc}</div>
              </div>
              <button
                onClick={() => toggle(t.key)} disabled={saving === t.key}
                style={{ width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', background: on ? ACCENT : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.25s', flexShrink: 0, opacity: saving === t.key ? 0.6 : 1 }}
              >
                <div style={{ position: 'absolute', top: 3, left: on ? 24 : 4, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.25s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
              </button>
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
