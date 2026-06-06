'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { getCached, setCached } from '@/lib/cache'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { CoinPurchaseButton } from '@/components/coins/CoinPurchaseButton'

interface ShopItem {
  id: number
  title: string
  description: string
  type: string
  priceCoins: number
  priceStars: number
  imageUrl: string | null
  effectValue: string | null
}

const typeGradient: Record<string, string> = {
  premium:        'linear-gradient(135deg, rgba(234,179,8,0.15) 0%, rgba(180,120,0,0.08) 100%)',
  avatar_frame:   'linear-gradient(135deg, rgba(168,85,247,0.15) 0%, rgba(99,40,180,0.08) 100%)',
  nickname_color: 'linear-gradient(135deg, rgba(96,165,250,0.15) 0%, rgba(37,99,235,0.08) 100%)',
  xp_boost:       'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(21,128,61,0.08) 100%)',
  warn_remove:    'linear-gradient(135deg, rgba(232,9,46,0.15) 0%, rgba(120,0,20,0.08) 100%)',
}
const typeBorder: Record<string, string> = {
  premium:        'rgba(234,179,8,0.25)',
  avatar_frame:   'rgba(168,85,247,0.25)',
  nickname_color: 'rgba(96,165,250,0.25)',
  xp_boost:       'rgba(34,197,94,0.25)',
  warn_remove:    'rgba(232,9,46,0.25)',
}
const typeGlow: Record<string, string> = {
  premium:        '#EAB308',
  avatar_frame:   '#A855F7',
  nickname_color: '#60A5FA',
  xp_boost:       '#22C55E',
  warn_remove:    '#E8092E',
}
const typeIcon: Record<string, string> = {
  premium: '⭐',
  avatar_frame: '🖼️',
  nickname_color: '🎨',
  xp_boost: '⚡',
  warn_remove: '🛡️',
}

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>(() => getCached<ShopItem[]>('shop') ?? [])
  const [buying, setBuying] = useState<number | null>(null)
  const { user, refreshUser } = useAuthStore()

  useEffect(() => {
    api.get('/shop').then((r) => { setItems(r.data); setCached('shop', r.data) })
  }, [])

  const buy = async (item: ShopItem) => {
    if (!user || user.coins < item.priceCoins) {
      alert('Недостаточно монет')
      return
    }
    setBuying(item.id)
    try {
      await api.post(`/shop/${item.id}/buy`)
      await refreshUser()
      alert(`${item.title} куплено!`)
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка')
    } finally {
      setBuying(null)
    }
  }

  return (
    <RequireRegistration>
    <div style={{ minHeight: '100vh', background: '#060608', paddingBottom: 88 }}>
      {/* Radial glow */}
      <div style={{
        position: 'fixed', top: -100, left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 250,
        background: 'radial-gradient(ellipse, rgba(168,85,247,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 16px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20, paddingBottom: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🛒</span>
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>Магазин</h1>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.2)',
            borderRadius: 12, padding: '6px 12px',
          }}>
            <span style={{ fontSize: 16 }}>🪙</span>
            <span style={{ fontWeight: 800, fontSize: 14, color: '#EAB308' }}>{user?.coins || 0}</span>
            <CoinPurchaseButton size="sm" />
          </div>
        </motion.div>

        {/* Section label */}
        <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Доступные товары
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {items.map((item, i) => {
            const isWarnRemove = item.type === 'warn_remove'
            const userWarns = (user as any)?.warns ?? 0
            const warnRemoveDisabled = isWarnRemove && userWarns === 0
            const bg = typeGradient[item.type] || 'rgba(255,255,255,0.04)'
            const border = typeBorder[item.type] || 'rgba(255,255,255,0.07)'
            const accentColor = typeGlow[item.type] || '#9CA3AF'

            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
                style={{
                  borderRadius: 14, padding: '14px 12px',
                  background: bg,
                  border: `1px solid ${border}`,
                  display: 'flex', flexDirection: 'column',
                  opacity: warnRemoveDisabled ? 0.5 : 1,
                  position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Glow strip at top */}
                <div style={{
                  position: 'absolute', top: 0, left: '20%', right: '20%', height: 1,
                  background: `linear-gradient(90deg, transparent, ${accentColor}66, transparent)`,
                }} />

                <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>
                  {isWarnRemove ? (
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
                      <span>🛡️</span>
                      {userWarns > 0 && (
                        <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                          {[1,2,3].map(n => (
                            <div key={n} style={{
                              width: 7, height: 7,
                              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                              background: n <= userWarns ? '#F59E0B' : 'rgba(255,255,255,0.12)',
                            }} />
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (typeIcon[item.type] || '📦')}
                </div>

                <div style={{ fontWeight: 800, fontSize: 13, textAlign: 'center', color: '#fff', marginBottom: 4 }}>{item.title}</div>
                {item.description && (
                  <div style={{ fontSize: 11, color: '#4B5563', textAlign: 'center', marginBottom: 4, lineHeight: 1.4 }}>{item.description}</div>
                )}
                {isWarnRemove && warnRemoveDisabled && (
                  <div style={{ fontSize: 10, textAlign: 'center', color: '#374151', marginBottom: 4 }}>Нет активных варнов</div>
                )}

                <div style={{ flex: 1 }} />

                <div style={{ marginTop: 10 }}>
                  {item.priceCoins > 0 && (
                    <motion.button
                      whileTap={{ scale: warnRemoveDisabled ? 1 : 0.96 }}
                      onClick={() => !warnRemoveDisabled && buy(item)}
                      disabled={buying === item.id || warnRemoveDisabled}
                      style={{
                        width: '100%', padding: '9px 0', borderRadius: 10,
                        background: warnRemoveDisabled
                          ? 'rgba(255,255,255,0.04)'
                          : `linear-gradient(135deg, ${accentColor}cc, ${accentColor}88)`,
                        border: `1px solid ${warnRemoveDisabled ? 'rgba(255,255,255,0.06)' : border}`,
                        color: warnRemoveDisabled ? '#374151' : '#fff',
                        fontWeight: 800, fontSize: 13, cursor: warnRemoveDisabled ? 'not-allowed' : 'pointer',
                        opacity: buying === item.id ? 0.6 : 1,
                      }}
                    >
                      {buying === item.id ? '...' : `🪙 ${item.priceCoins}`}
                    </motion.button>
                  )}
                  {item.priceStars > 0 && (
                    <div style={{ textAlign: 'center', fontSize: 11, color: '#EAB308', marginTop: 5, fontWeight: 700 }}>
                      ⭐ {item.priceStars} Stars
                    </div>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {!items.length && (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: '60px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🛒</div>
            <p>Магазин пуст</p>
          </div>
        )}
      </div>
    </div>
    </RequireRegistration>
  )
}
