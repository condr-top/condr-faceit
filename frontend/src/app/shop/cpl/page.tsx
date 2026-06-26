'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Icon, IconName } from '@/components/ui/Icon'

const C1 = '#E8092E'
const C2 = '#F97316'
const PRICE = 4990

const STEPS: { icon: IconName; title: string; sub: string }[] = [
  { icon: 'swords',   title: 'Квалификационная лига', sub: 'Играй матчи отборочной лиги против сильнейших игроков платформы' },
  { icon: 'barChart', title: 'Рейтинг лиги',          sub: 'Зарабатывай очки за результаты и поднимайся в турнирной таблице' },
  { icon: 'shield',   title: 'Отбор',                 sub: 'Лучшие игроки по итогам сезона отбираются в CONDR Pro League' },
  { icon: 'crown',    title: 'CONDR Pro League',      sub: 'Место на профессиональной сцене, призы и статус про-игрока' },
]

export default function CplPage() {
  const router = useRouter()
  const { user, refreshUser } = useAuthStore()
  const [busy, setBusy] = useState(false)
  const has = !!user?.cplqAccess

  const buy = async () => {
    if (!user || user.coins < PRICE) { alert('Недостаточно монет'); return }
    if (!confirm(`Купить доступ к CPL-Q за ${PRICE.toLocaleString()} COIN?`)) return
    setBusy(true)
    try { await api.post('/shop/cplq'); await refreshUser(); alert('Доступ к CPL-Q активирован! 🎉') }
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
          <div style={{ position: 'absolute', right: -20, top: -10, opacity: 0.08, pointerEvents: 'none' }}><Icon name="trophy" size={150} color={C1} /></div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 15, position: 'relative' }}>
            <div style={{ position: 'relative', width: 66, height: 66, borderRadius: 20, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${C1}, ${C2})`, boxShadow: `0 12px 30px ${C1}66` }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '20px 20px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
              <Icon name="trophy" size={34} color="#fff" />
            </div>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: C1, background: `${C1}1f`, padding: '3px 9px', borderRadius: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Киберспорт · Лига</span>
              <div style={{ fontSize: 23, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', marginTop: 7, textShadow: `0 2px 20px ${C1}66` }}>CPL Qualifications</div>
              <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3, fontWeight: 600 }}>CONDR Pro League Qualifications</div>
            </div>
          </div>
        </motion.div>

        {/* About */}
        <div style={{ fontSize: 13.5, color: '#B0B0B8', lineHeight: 1.6, marginBottom: 16, padding: '0 2px' }}>
          CONDR Pro League Qualifications — специальная лига для игроков, которые хотят пробиться на профессиональную сцену. Проходи квалификации и докажи свой уровень: лучшие игроки отбираются в CONDR Pro League. Это вводное описание — полные правила, форматы и расписание добавим позже.
        </div>

        {/* Steps */}
        <div style={{ fontSize: 11, color: '#374151', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Как это работает</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {STEPS.map((p, i) => (
            <motion.div key={p.title} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 + i * 0.05 }}
              style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 14px', borderRadius: 15, background: `radial-gradient(120% 120% at 0% 0%, ${C1}10, transparent 55%), #0f0f15`, border: `1px solid ${C1}22` }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, flexShrink: 0, background: `${C1}18`, border: `1px solid ${C1}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                <Icon name={p.icon} size={21} color={C1} />
                <div style={{ position: 'absolute', top: -7, right: -7, width: 18, height: 18, borderRadius: '50%', background: '#060608', border: `1px solid ${C1}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: C1 }}>{i + 1}</div>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{p.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1, lineHeight: 1.4 }}>{p.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA — покупка доступа / уже в наличии */}
        {has ? (
          <div style={{ width: '100%', padding: '15px 0', borderRadius: 16, border: `1px solid ${C1}44`, background: `linear-gradient(135deg, ${C1}1a, rgba(255,255,255,0.02))`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
            <Icon name="check-circle" size={18} color="#22C55E" />
            <span style={{ fontSize: 14.5, fontWeight: 800, color: '#fff' }}>Уже в наличии на этот сезон</span>
          </div>
        ) : (
          <motion.button whileTap={{ scale: 0.98 }} onClick={buy} disabled={busy}
            style={{ width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', cursor: 'pointer', position: 'relative', overflow: 'hidden', fontSize: 15, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${C1}, ${C2})`, boxShadow: `0 8px 28px ${C1}55, inset 0 1px 0 rgba(255,255,255,0.18)`, opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {!busy && <motion.div animate={{ x: ['-120%', '220%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '34%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)', pointerEvents: 'none' }} />}
            <Icon name="coins" size={18} color="#fff" /> {busy ? 'Покупаем…' : `Купить · ${PRICE.toLocaleString()}`}
          </motion.button>
        )}
        <button onClick={() => router.push('/leaderboard')} style={{ width: '100%', marginTop: 10, padding: '12px 0', borderRadius: 14, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          <Icon name="trophy" size={15} color="#9CA3AF" /> Сезонная таблица — в разделе «Рейтинг»
        </button>
      </div>
    </RequireRegistration>
  )
}
