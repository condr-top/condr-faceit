'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getCached, setCached } from '@/lib/cache'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { CoinPurchaseButton } from '@/components/coins/CoinPurchaseButton'
import { Icon, IconName } from '@/components/ui/Icon'

interface ShopItem {
  id: number; title: string; description: string; type: string
  priceCoins: number; priceStars: number; imageUrl: string | null; effectValue: string | null
}

const TYPE_META: Record<string, { icon: IconName; color: string }> = {
  premium:        { icon: 'star',    color: '#EAB308' },
  avatar_frame:   { icon: 'image',   color: '#A855F7' },
  nickname_color: { icon: 'palette', color: '#60A5FA' },
  xp_boost:       { icon: 'bolt',    color: '#22C55E' },
  warn_remove:    { icon: 'shield',  color: '#E8092E' },
}

const SECTIONS: { key: string; label: string; sub: string; color: string; icon: IconName; types: string[]; comingSoon?: boolean }[] = [
  { key: 'services', label: 'Услуги',        sub: 'Буусты и полезные функции', color: '#22C55E', icon: 'bolt',     types: ['xp_boost', 'warn_remove'] },
  { key: 'custom',   label: 'Кастомизация',  sub: 'Рамки, цвета, оформление',  color: '#A855F7', icon: 'palette',  types: ['avatar_frame', 'nickname_color'] },
  { key: 'cases',    label: 'Кейсы',         sub: 'Открывай и забирай награды', color: '#60A5FA', icon: 'gift',     types: [], comingSoon: true },
]

// ── Big horizontal hero tile ────────────────────────────────────────────────────
function HeroTile({ tag, title, subtitle, price, c1, c2, icon, delay, onClick }: {
  tag: string; title: string; subtitle: string; price?: number; c1: string; c2: string; icon: IconName; delay: number; onClick: () => void
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 260, damping: 24 }}
      whileTap={{ scale: 0.985 }} onClick={onClick}
      style={{
        width: '100%', borderRadius: 22, overflow: 'hidden', position: 'relative', cursor: 'pointer', textAlign: 'left',
        border: `1px solid ${c1}4a`, padding: 18, display: 'flex', alignItems: 'center', gap: 15, minHeight: 118,
        background: `radial-gradient(130% 130% at 0% 0%, ${c1}2e, transparent 50%), radial-gradient(120% 120% at 100% 100%, ${c2}1f, transparent 55%), linear-gradient(160deg, #0c0c11, #08080b)`,
        boxShadow: `0 16px 44px ${c1}22`,
      }}>
      {/* dotted grid */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '18px 18px', WebkitMaskImage: 'radial-gradient(120% 120% at 20% 0%, #000 24%, transparent 70%)', maskImage: 'radial-gradient(120% 120% at 20% 0%, #000 24%, transparent 70%)' }} />
      {/* shimmer */}
      <motion.div animate={{ x: ['-130%', '230%'] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 5, ease: 'linear' }}
        style={{ position: 'absolute', top: 0, bottom: 0, width: '26%', pointerEvents: 'none', background: `linear-gradient(90deg, transparent, ${c1}1c, transparent)` }} />
      {/* faint watermark icon */}
      <div style={{ position: 'absolute', right: -14, top: '50%', transform: 'translateY(-50%)', opacity: 0.07, pointerEvents: 'none' }}><Icon name={icon} size={130} color={c1} /></div>

      {/* emblem */}
      <div style={{ position: 'relative', width: 60, height: 60, borderRadius: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${c1}, ${c2})`, boxShadow: `0 10px 26px ${c1}66` }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '18px 18px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />
        <Icon name={icon} size={30} color="#fff" />
      </div>

      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <span style={{ fontSize: 9.5, fontWeight: 900, color: c1, background: `${c1}1f`, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{tag}</span>
        <div style={{ fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginTop: 7, textShadow: `0 2px 18px ${c1}55`, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{subtitle}</div>
        {price != null ? (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 9, padding: '4px 11px', borderRadius: 20, background: `${c1}1a`, border: `1px solid ${c1}44` }}>
            <Icon name="coins" size={13} color={c1} />
            <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{price.toLocaleString()}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: c1 }}>COIN</span>
          </div>
        ) : (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 9, fontSize: 12, fontWeight: 800, color: c1 }}>Подробнее <Icon name="chevronRight" size={13} color={c1} /></div>
        )}
      </div>
      <Icon name="chevronRight" size={20} color="#4B5563" style={{ position: 'relative', flexShrink: 0 }} />
    </motion.button>
  )
}

// ── Section product card ─────────────────────────────────────────────────────────
function ItemCard({ item, delay, onBuy, buying, canAfford }: { item: ShopItem; delay: number; onBuy: () => void; buying: boolean; canAfford: boolean }) {
  const meta = TYPE_META[item.type] || { icon: 'box' as IconName, color: '#9CA3AF' }
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      style={{ borderRadius: 16, padding: 14, background: `radial-gradient(120% 120% at 0% 0%, ${meta.color}12, transparent 55%), #0f0f15`, border: `1px solid ${meta.color}26`, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 0, left: '16%', right: '16%', height: 1, background: `linear-gradient(90deg, transparent, ${meta.color}88, transparent)` }} />
      <div style={{ position: 'absolute', top: -10, right: -8, opacity: 0.09, pointerEvents: 'none' }}><Icon name={meta.icon} size={56} color={meta.color} /></div>
      <div style={{ width: 38, height: 38, borderRadius: 11, background: `${meta.color}18`, border: `1px solid ${meta.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Icon name={meta.icon} size={20} color={meta.color} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff', position: 'relative' }}>{item.title}</div>
      {item.description && <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, lineHeight: 1.4, position: 'relative' }}>{item.description}</div>}
      <div style={{ flex: 1, minHeight: 8 }} />
      <motion.button whileTap={{ scale: 0.96 }} onClick={onBuy} disabled={buying}
        style={{ marginTop: 10, width: '100%', padding: '9px 0', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${meta.color}, ${meta.color}aa)`, boxShadow: `0 4px 14px ${meta.color}33`, opacity: buying ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
        {buying ? '…' : <><Icon name="coins" size={14} color="#fff" /> {item.priceCoins.toLocaleString()}</>}
      </motion.button>
    </motion.div>
  )
}

function ComingSoonCard({ color, delay }: { color: string; delay: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      style={{ borderRadius: 16, padding: 14, minHeight: 132, background: '#0d0d12', border: '1px dashed rgba(255,255,255,0.1)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, textAlign: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}12`, border: `1px solid ${color}26`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name="lock" size={19} color={color} />
      </div>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#9CA3AF' }}>Скоро</div>
      <div style={{ fontSize: 10.5, color: '#4B5563' }}>Готовим кое-что крутое</div>
    </motion.div>
  )
}

function SectionHeader({ label, sub, color, icon }: { label: string; sub: string; color: string; icon: IconName }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 22 }}>
      <div style={{ width: 30, height: 30, borderRadius: 9, background: `${color}1a`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={16} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  )
}

export default function ShopPage() {
  const router = useRouter()
  const [items, setItems] = useState<ShopItem[]>(() => getCached<ShopItem[]>('shop') ?? [])
  const [buying, setBuying] = useState<number | null>(null)
  const { user, refreshUser } = useAuthStore()

  useEffect(() => {
    api.get('/shop').then((r) => { setItems(r.data); setCached('shop', r.data) }).catch(() => {})
  }, [])

  const buy = async (item: ShopItem) => {
    if (!user || user.coins < item.priceCoins) { alert('Недостаточно монет'); return }
    setBuying(item.id)
    try { await api.post(`/shop/${item.id}/buy`); await refreshUser(); alert(`${item.title} куплено!`) }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setBuying(null) }
  }

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #E8092E, #A855F7)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 22px rgba(232,9,46,0.5)' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)' }} />
              <Icon name="cart" size={23} color="#fff" />
            </div>
            <div>
              <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.03em', lineHeight: 1 }}>Магазин</h1>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>Прокачай свой опыт CONDR</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.25)', borderRadius: 12, padding: '6px 10px' }}>
            <Icon name="coins" size={16} color="#EAB308" />
            <span style={{ fontWeight: 900, fontSize: 14, color: '#EAB308' }}>{(user?.coins || 0).toLocaleString()}</span>
            <CoinPurchaseButton size="sm" />
          </div>
        </motion.div>

        {/* Hero products */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HeroTile tag="Киберспорт" title="CPL Qualifications" subtitle="Отбор в профессиональную CONDR Pro League" c1="#E8092E" c2="#F97316" icon="trophy" delay={0.05} onClick={() => router.push('/shop/cpl')} />
          <HeroTile tag="Подписка" title="CONDR Premium" subtitle="Больше отряд, особый статус и привилегии" price={2990} c1="#EAB308" c2="#F59E0B" icon="crown" delay={0.1} onClick={() => router.push('/shop/premium')} />
        </div>

        {/* Sections */}
        {SECTIONS.map((s, si) => {
          const secItems = items.filter(it => s.types.includes(it.type) && it.priceCoins > 0)
          const showComing = s.comingSoon || secItems.length === 0
          return (
            <div key={s.key}>
              <SectionHeader label={s.label} sub={s.sub} color={s.color} icon={s.icon} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {showComing
                  ? [0, 1].map(i => <ComingSoonCard key={i} color={s.color} delay={0.04 * i} />)
                  : secItems.map((it, i) => (
                    <ItemCard key={it.id} item={it} delay={0.04 * i} buying={buying === it.id} canAfford={(user?.coins ?? 0) >= it.priceCoins} onBuy={() => buy(it)} />
                  ))}
              </div>
            </div>
          )
        })}
      </div>
    </RequireRegistration>
  )
}
