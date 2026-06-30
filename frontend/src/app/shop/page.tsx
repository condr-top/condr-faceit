'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useSheetDrag } from '@/lib/useSheetDrag'
import { api } from '@/lib/api'
import { getCached, setCached } from '@/lib/cache'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { CoinPurchaseButton } from '@/components/coins/CoinPurchaseButton'
import { Icon, IconName } from '@/components/ui/Icon'
import { CustomizationSection } from '@/components/shop/CustomizationSection'

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
  { key: 'cases',    label: 'Кейсы',         sub: 'Открывай и забирай награды', color: '#60A5FA', icon: 'gift',     types: [], comingSoon: true },
]

// Услуги — вызывают отдельные эндпоинты бэка (цены — на сервере, здесь только витрина).
interface Service {
  key: string; title: string; short: string; desc: string; price: number; color: string; icon: IconName
  endpoint: string; cta: string; confirm?: string; danger?: boolean
  bullets: string[]
}
const SERVICES: Service[] = [
  { key: 'coin_boost', title: 'Boost 2X', short: '×2 коина · 24ч', price: 1500, color: '#EAB308', icon: 'bolt', endpoint: '/shop/service/boost', cta: 'Активировать',
    desc: 'Удваивает начисление CONDR COIN на 24 часа.',
    bullets: ['×2 к коинам за матчи, миссии, ачивки и мини-игру', 'Действует 24 часа с момента покупки', 'Не распространяется на донат (пополнение)', 'Покупка во время активного буста продлевает срок'] },
  { key: 'warn_remove', title: 'Снятие варна', short: '−1 предупреждение', price: 1500, color: '#22C55E', icon: 'shield', endpoint: '/shop/service/warn-remove', cta: 'Снять варн',
    desc: 'Убирает одно активное предупреждение с аккаунта.',
    bullets: ['Снимает одно предупреждение', 'Если бан был выдан за 3 варна — аккаунт авто-разбанится', 'Без активных варнов покупка недоступна'] },
  { key: 'condr_tag', title: 'Тэг [CONDR]', short: 'Игровой тэг', price: 5000, color: '#A855F7', icon: 'sparkles', endpoint: '/shop/service/condr-tag', cta: 'Заказать', confirm: 'Заказать внутриигровой тэг [CONDR]? Администратор выдаст его в самой игре.',
    desc: 'Внутриигровой тэг [CONDR] рядом с ником.',
    bullets: ['Заявка уходит администраторам', 'Тэг выдаётся вручную прямо в игре Standoff 2', 'Одна активная заявка на аккаунт'] },
  { key: 'kd_reset', title: 'Обнуление K/D', short: 'Сброс статы', price: 2500, color: '#F97316', icon: 'target', endpoint: '/shop/service/kd-reset', cta: 'Обнулить', danger: true, confirm: 'Обнулить K/D? Статистика и история матчей обычной лиги будут стёрты безвозвратно. ELO останется.',
    desc: 'Сброс статистики и истории матчей обычной лиги.',
    bullets: ['Обнуляет K/D, rating, победы/поражения', 'Стирает историю матчей обычной лиги', 'ELO и ранг остаются на месте', 'Действие необратимо'] },
  { key: 'clean_slate', title: 'Чистый лист', short: 'Полный сброс', price: 4000, color: '#E8092E', icon: 'refresh', endpoint: '/shop/service/clean-slate', cta: 'Сбросить', danger: true, confirm: 'Начать с чистого листа? Вся история матчей будет стёрта, ELO сброшен до старта, потребуется повторная калибровка. Действие необратимо.',
    desc: 'Полный сброс профиля обычной лиги с калибровкой заново.',
    bullets: ['Всё из «Обнуления K/D»', 'ELO сбрасывается до стартового (1000)', 'Первые 10 матчей снова калибровочные', 'Действие необратимо'] },
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

// ── Service tile (квадратная плитка услуги — тап открывает детали) ────────────────
function ServiceTile({ svc, delay, onOpen }: { svc: Service; delay: number; onOpen: () => void }) {
  const c = svc.color
  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      whileTap={{ scale: 0.97 }} onClick={onOpen}
      style={{
        position: 'relative', textAlign: 'left', cursor: 'pointer', width: '100%', aspectRatio: '1 / 1',
        borderRadius: 18, padding: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: `radial-gradient(130% 130% at 0% 0%, ${c}1f, transparent 55%), linear-gradient(160deg, #0e0e14, #08080b)`,
        border: `1px solid ${c}33`, boxShadow: `0 10px 30px ${c}14`,
      }}>
      <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1, background: `linear-gradient(90deg, transparent, ${c}99, transparent)` }} />
      <div style={{ position: 'absolute', right: -16, bottom: -16, opacity: 0.08, pointerEvents: 'none' }}><Icon name={svc.icon} size={104} color={c} /></div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ width: 46, height: 46, borderRadius: 13, background: `${c}1a`, border: `1px solid ${c}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={svc.icon} size={24} color={c} />
        </div>
        {svc.danger && <span style={{ fontSize: 8.5, fontWeight: 900, color: '#F87171', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 6px', borderRadius: 5, letterSpacing: '0.04em' }}>СБРОС</span>}
      </div>

      <div style={{ marginTop: 'auto', position: 'relative' }}>
        <div style={{ fontSize: 15.5, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>{svc.title}</div>
        <div style={{ fontSize: 10.5, color: '#7C8493', marginTop: 2 }}>{svc.short}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 9px', borderRadius: 9, background: `${c}1a`, border: `1px solid ${c}3a` }}>
            <Icon name="coins" size={12} color={c} /><span style={{ fontSize: 12.5, fontWeight: 900, color: '#fff' }}>{svc.price.toLocaleString()}</span>
          </span>
          <Icon name="chevronRight" size={16} color={c} />
        </div>
      </div>
    </motion.button>
  )
}

// ── Service detail bottom sheet ───────────────────────────────────────────────────
function ServiceDetailSheet({ svc, onClose, onBuy, buying, canAfford }: { svc: Service; onClose: () => void; onBuy: () => void; buying: boolean; canAfford: boolean }) {
  const c = svc.color
  const sheet = useSheetDrag(onClose)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div {...sheet.panelProps} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: `radial-gradient(120% 80% at 50% 0%, ${c}1a, transparent 60%), linear-gradient(180deg, #101016, #0a0a0f)`, borderRadius: '26px 26px 0 0', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none', padding: 20, paddingBottom: 28, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 -20px 60px rgba(0,0,0,0.5)' }}>
        <div {...sheet.handleProps} style={{ ...sheet.handleProps.style, padding: '4px 0 16px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{ width: 58, height: 58, borderRadius: 16, flexShrink: 0, background: `${c}1c`, border: `1px solid ${c}45`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 24px ${c}33` }}>
            <Icon name={svc.icon} size={30} color={c} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{svc.title}</span>
              {svc.danger && <span style={{ fontSize: 9, fontWeight: 900, color: '#F87171', background: 'rgba(239,68,68,0.14)', border: '1px solid rgba(239,68,68,0.3)', padding: '2px 7px', borderRadius: 6 }}>НЕОБРАТИМО</span>}
            </div>
            <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 3, lineHeight: 1.4 }}>{svc.desc}</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginBottom: 20 }}>
          {svc.bullets.map((b, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
              <span style={{ marginTop: 2, flexShrink: 0, width: 18, height: 18, borderRadius: 6, background: `${c}1f`, border: `1px solid ${c}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="check" size={11} color={c} />
              </span>
              <span style={{ fontSize: 13, color: '#D1D5DB', lineHeight: 1.45 }}>{b}</span>
            </div>
          ))}
        </div>

        <motion.button whileTap={{ scale: 0.97 }} onClick={onBuy} disabled={buying}
          style={{ width: '100%', padding: '15px 0', borderRadius: 15, border: 'none', cursor: buying ? 'default' : 'pointer', fontSize: 15, fontWeight: 900, color: '#fff', background: canAfford ? `linear-gradient(135deg, ${c}, ${c}bb)` : 'rgba(255,255,255,0.07)', boxShadow: canAfford ? `0 6px 24px ${c}3a` : 'none', opacity: buying ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {buying ? '…' : <>{svc.cta} · <Icon name="coins" size={16} color="#fff" /> {svc.price.toLocaleString()}</>}
        </motion.button>
        {!canAfford && <div style={{ textAlign: 'center', fontSize: 11.5, color: '#F87171', marginTop: 10 }}>Недостаточно монет</div>}
      </motion.div>
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
  const [svcBuying, setSvcBuying] = useState<string | null>(null)
  const [svcDetail, setSvcDetail] = useState<Service | null>(null)
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

  const buyService = async (svc: Service) => {
    if (!user || user.coins < svc.price) { alert('Недостаточно монет'); return }
    if (svc.confirm && !window.confirm(svc.confirm)) return
    setSvcBuying(svc.key)
    try {
      const r = await api.post(svc.endpoint)
      await refreshUser()
      setSvcDetail(null)
      alert(r.data?.message || `${svc.title} — готово!`)
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setSvcBuying(null) }
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

        {/* Услуги — квадратные плитки, по 2 в ряд, детали по тапу */}
        <SectionHeader label="Услуги" sub="Бусты, сбросы и полезные функции" color="#22C55E" icon="bolt" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {SERVICES.map((svc, i) => (
            <ServiceTile key={svc.key} svc={svc} delay={0.04 * i} onOpen={() => setSvcDetail(svc)} />
          ))}
        </div>

        {/* Кастомизация — рамки аватара и титулы */}
        <CustomizationSection />

        {/* CONDR Игры — кейсы / колесо / слоты */}
        <SectionHeader label="CONDR Игры" sub="Кейсы, колесо фортуны и слоты" color="#E8092E" icon="box" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <HeroTile tag="Кейс" title="CONDR CASE" subtitle="Рамки, фоны, премиум и монеты" c1="#E8092E" c2="#F97316" icon="box" delay={0.05} onClick={() => router.push('/games/case')} />
          <HeroTile tag="Колесо" title="CONDR WHEEL" subtitle="Крути колесо фортуны" c1="#A855F7" c2="#6D28D9" icon="target" delay={0.1} onClick={() => router.push('/games/wheel')} />
          <HeroTile tag="Слоты" title="CONDR SLOTS" subtitle="Собери 3 в ряд — джекпот 10 000" c1="#EAB308" c2="#F59E0B" icon="sparkles" delay={0.15} onClick={() => router.push('/games/slots')} />
        </div>
      </div>

      <AnimatePresence>
        {svcDetail && (
          <ServiceDetailSheet
            svc={svcDetail}
            onClose={() => setSvcDetail(null)}
            onBuy={() => buyService(svcDetail)}
            buying={svcBuying === svcDetail.key}
            canAfford={(user?.coins ?? 0) >= svcDetail.price}
          />
        )}
      </AnimatePresence>
    </RequireRegistration>
  )
}
