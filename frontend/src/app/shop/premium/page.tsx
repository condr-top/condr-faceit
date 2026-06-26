'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Icon, IconName } from '@/components/ui/Icon'

const C1 = '#EAB308'
const C2 = '#F59E0B'
const PRICE = 2990

const PERKS: { icon: IconName; title: string; sub: string }[] = [
  { icon: 'users',   title: 'Отряд до 5 игроков', sub: 'Собирай полный стак друзей и заходите в матч вместе' },
  { icon: 'crown',   title: 'Статус Premium',     sub: 'Особый значок в профиле, лобби и списках' },
  { icon: 'palette', title: 'Эксклюзив',          sub: 'Уникальные рамки, цвета ника и оформление' },
  { icon: 'bolt',    title: 'Привилегии',         sub: 'Бонусы и приоритет в сервисах платформы' },
]

export default function PremiumPage() {
  const router = useRouter()
  const { user, refreshUser } = useAuthStore()
  const [busy, setBusy] = useState(false)
  const isPremium = !!user?.isPremium
  const until = (user as any)?.premiumUntil ? new Date((user as any).premiumUntil) : null

  const buy = async () => {
    if (!user || user.coins < PRICE) { alert('Недостаточно монет'); return }
    if (!confirm(`Купить CONDR Premium за ${PRICE.toLocaleString()} COIN?`)) return
    setBusy(true)
    try { await api.post('/shop/premium'); await refreshUser(); alert('CONDR Premium активирован! 🎉') }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setBusy(false) }
  }

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 110px', maxWidth: 520, margin: '0 auto' }}>
        <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}>
          <Icon name="chevronLeft" size={18} color="#9CA3AF" /> Назад
        </button>

        {/* Hero */}
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          style={{ borderRadius: 24, overflow: 'hidden', position: 'relative', padding: 22, marginBottom: 14,
            background: `radial-gradient(130% 130% at 0% 0%, ${C1}2e, transparent 50%), radial-gradient(120% 120% at 100% 100%, ${C2}1f, transparent 55%), linear-gradient(160deg, #0c0c11, #08080b)`,
            border: `1px solid ${C1}4a`, boxShadow: `0 16px 50px ${C1}22` }}>
          <motion.div animate={{ x: ['-130%', '230%'] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 4, ease: 'linear' }}
            style={{ position: 'absolute', top: 0, bottom: 0, width: '26%', pointerEvents: 'none', background: `linear-gradient(90deg, transparent, ${C1}1c, transparent)` }} />
          <div style={{ position: 'absolute', right: -20, top: -10, opacity: 0.08, pointerEvents: 'none' }}><Icon name="crown" size={150} color={C1} /></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 15, position: 'relative' }}>
            <div style={{ position: 'relative', width: 66, height: 66, borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C1}, ${C2})`, boxShadow: `0 12px 30px ${C1}66` }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '20px 20px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.3), transparent)' }} />
              <Icon name="crown" size={34} color="#fff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: C1, background: `${C1}1f`, padding: '3px 9px', borderRadius: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Подписка · 30 дней</span>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', marginTop: 7, textShadow: `0 2px 20px ${C1}66` }}>CONDR Premium</div>
            </div>
          </div>
          {isPremium && until && (
            <div style={{ marginTop: 14, padding: '10px 13px', borderRadius: 13, background: `${C1}14`, border: `1px solid ${C1}33`, display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
              <Icon name="check-circle" size={16} color={C1} />
              <span style={{ fontSize: 12.5, color: '#fff', fontWeight: 600 }}>Premium активен до {until.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
          )}
        </motion.div>

        {/* About */}
        <div style={{ fontSize: 13.5, color: '#B0B0B8', lineHeight: 1.6, marginBottom: 16, padding: '0 2px' }}>
          CONDR Premium — это статус для тех, кто живёт игрой. Больше возможностей для отряда, особый облик профиля и набор привилегий по всей платформе. Это вводное описание — подробности и полный список преимуществ добавим позже.
        </div>

        {/* Perks */}
        <div style={{ fontSize: 11, color: '#374151', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Что входит</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {PERKS.map((p, i) => (
            <motion.div key={p.title} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.05 }}
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', borderRadius: 15, background: `radial-gradient(120% 120% at 0% 0%, ${C1}10, transparent 55%), #0f0f15`, border: `1px solid ${C1}22` }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: `${C1}18`, border: `1px solid ${C1}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={p.icon} size={21} color={C1} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{p.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1, lineHeight: 1.4 }}>{p.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Buy button (inline — не перекрывается навбаром) */}
        <motion.button whileTap={{ scale: 0.98 }} onClick={buy} disabled={busy}
          style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', cursor: 'pointer', position: 'relative', overflow: 'hidden', fontSize: 15, fontWeight: 900, color: '#1a1200', background: `linear-gradient(135deg, ${C1}, ${C2})`, boxShadow: `0 8px 30px ${C1}55, inset 0 1px 0 rgba(255,255,255,0.3)`, opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {!busy && <motion.div animate={{ x: ['-120%', '220%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '34%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)', pointerEvents: 'none' }} />}
          <Icon name="coins" size={18} color="#1a1200" />
          {busy ? 'Покупаем…' : isPremium ? `Продлить · ${PRICE.toLocaleString()}` : `Купить · ${PRICE.toLocaleString()}`}
        </motion.button>
      </div>
    </RequireRegistration>
  )
}
