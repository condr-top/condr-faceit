'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Icon, IconName } from '@/components/ui/Icon'

interface ShopItem { id: number; title: string; description: string; type: string; priceCoins: number }

const TYPE_META: Record<string, { icon: IconName; color: string }> = {
  avatar_frame: { icon: 'image', color: '#A855F7' }, nickname_color: { icon: 'palette', color: '#60A5FA' },
  xp_boost: { icon: 'bolt', color: '#22C55E' }, warn_remove: { icon: 'shield', color: '#E8092E' },
}
const SECTIONS: { label: string; sub: string; color: string; icon: IconName; types: string[]; comingSoon?: boolean }[] = [
  { label: 'Услуги', sub: 'Буусты и полезные функции', color: '#22C55E', icon: 'bolt', types: ['xp_boost', 'warn_remove'] },
  { label: 'Кастомизация', sub: 'Рамки, цвета, оформление', color: '#A855F7', icon: 'palette', types: ['avatar_frame', 'nickname_color'] },
  { label: 'Кейсы', sub: 'Открывай и забирай награды', color: '#60A5FA', icon: 'gift', types: [], comingSoon: true },
]

function Hero({ tag, title, sub, c1, c2, icon, children }: { tag: string; title: string; sub: string; c1: string; c2: string; icon: IconName; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 22, padding: 24, position: 'relative', overflow: 'hidden', border: `1px solid ${c1}4a`,
      background: `radial-gradient(130% 120% at 0% 0%, ${c1}2e, transparent 50%), radial-gradient(120% 120% at 100% 100%, ${c2}1f, transparent 55%), linear-gradient(160deg, #0c0c11, #08080b)`, boxShadow: `0 16px 44px ${c1}1f` }}>
      <div style={{ position: 'absolute', right: -16, top: -10, opacity: 0.08 }}><Icon name={icon} size={150} color={c1} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative', marginBottom: 14 }}>
        <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${c1}, ${c2})`, boxShadow: `0 10px 26px ${c1}66` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '18px 18px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
          <Icon name={icon} size={30} color="#fff" />
        </div>
        <div>
          <span style={{ fontSize: 10, fontWeight: 900, color: c1, background: `${c1}1f`, padding: '3px 9px', borderRadius: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tag}</span>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginTop: 7, textShadow: `0 2px 18px ${c1}55` }}>{title}</div>
        </div>
      </div>
      <div style={{ fontSize: 13.5, color: '#9CA3AF', lineHeight: 1.6, marginBottom: 16, position: 'relative' }}>{sub}</div>
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

export default function WebShop() {
  const { user, refreshUser } = useAuthStore()
  const [items, setItems] = useState<ShopItem[]>([])
  const [buying, setBuying] = useState<string | number | null>(null)

  useEffect(() => { api.get('/shop').then(r => setItems(r.data || [])).catch(() => {}) }, [])

  const buyItem = async (it: ShopItem) => {
    if ((user?.coins ?? 0) < it.priceCoins) { alert('Недостаточно монет'); return }
    setBuying(it.id)
    try { await api.post(`/shop/${it.id}/buy`); await refreshUser(); alert(`${it.title} куплено!`) }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBuying(null) }
  }
  const buyPremium = async () => {
    if (!confirm('Купить CONDR Premium за 2 990 COIN?')) return
    setBuying('premium')
    try { await api.post('/shop/premium'); await refreshUser(); alert('CONDR Premium активирован! 🎉') }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBuying(null) }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <div style={{ position: 'relative', width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg, #E8092E, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(232,9,46,0.5)' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)' }} />
            <Icon name="cart" size={24} color="#fff" />
          </div>
          <div><h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Магазин</h1><div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Прокачай свой опыт CONDR</div></div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 12, padding: '8px 14px' }}>
          <Icon name="coins" size={17} color="#EAB308" /><span style={{ fontWeight: 900, fontSize: 15, color: '#EAB308' }}>{(user?.coins || 0).toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
        <Hero tag="Киберспорт · Лига" title="CPL Qualifications" c1="#E8092E" c2="#F97316" icon="trophy"
          sub="CONDR Pro League Qualifications — специальная лига для игроков, желающих пробиться на профессиональную сцену. Проходи квалификации: лучшие отбираются в CONDR Pro League.">
          <button disabled style={{ width: '100%', padding: '13px 0', borderRadius: 13, border: '1px solid rgba(255,255,255,0.1)', cursor: 'not-allowed', fontSize: 14, fontWeight: 900, color: '#9CA3AF', background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}><Icon name="lock" size={16} color="#9CA3AF" /> Регистрация скоро</button>
        </Hero>
        <Hero tag="Подписка · 30 дней" title="CONDR Premium" c1="#EAB308" c2="#F59E0B" icon="crown"
          sub="Больше отряд (до 5), особый статус, эксклюзивная кастомизация и привилегии по всей платформе.">
          <button onClick={buyPremium} disabled={buying === 'premium'} style={{ width: '100%', padding: '14px 0', borderRadius: 13, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 900, color: '#1a1200', background: 'linear-gradient(135deg, #EAB308, #F59E0B)', boxShadow: '0 8px 26px rgba(234,179,8,0.4)', opacity: buying === 'premium' ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Icon name="coins" size={17} color="#1a1200" /> {user?.isPremium ? 'Продлить · 2 990' : 'Купить · 2 990'}
          </button>
        </Hero>
      </div>

      {SECTIONS.map((s, si) => {
        const secItems = items.filter(it => s.types.includes(it.type) && it.priceCoins > 0)
        const coming = s.comingSoon || secItems.length === 0
        return (
          <div key={s.label} style={{ marginTop: 26 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: `${s.color}1a`, border: `1px solid ${s.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={s.icon} size={17} color={s.color} /></div>
              <div><div style={{ fontSize: 15, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{s.label}</div><div style={{ fontSize: 11.5, color: '#6B7280' }}>{s.sub}</div></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {coming ? [0, 1, 2].map(i => (
                <div key={i} style={{ borderRadius: 16, padding: 18, minHeight: 120, background: '#0d0d12', border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 11, background: `${s.color}12`, border: `1px solid ${s.color}26`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="lock" size={18} color={s.color} /></div>
                  <div style={{ fontSize: 12.5, fontWeight: 800, color: '#9CA3AF' }}>Скоро</div>
                </div>
              )) : secItems.map(it => {
                const meta = TYPE_META[it.type] || { icon: 'box' as IconName, color: '#9CA3AF' }
                return (
                  <div key={it.id} style={{ borderRadius: 16, padding: 16, background: `radial-gradient(120% 120% at 0% 0%, ${meta.color}12, transparent 55%), #0f0f15`, border: `1px solid ${meta.color}26`, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ width: 40, height: 40, borderRadius: 11, background: `${meta.color}18`, border: `1px solid ${meta.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 11 }}><Icon name={meta.icon} size={20} color={meta.color} /></div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{it.title}</div>
                    {it.description && <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 3, lineHeight: 1.4 }}>{it.description}</div>}
                    <div style={{ flex: 1, minHeight: 8 }} />
                    <button onClick={() => buyItem(it)} disabled={buying === it.id} style={{ marginTop: 11, width: '100%', padding: '9px 0', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)`, opacity: buying === it.id ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Icon name="coins" size={14} color="#fff" /> {it.priceCoins.toLocaleString()}</button>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
