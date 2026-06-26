'use client'

import { motion } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'

export interface RadarSlot { avatarUrl?: string | null; name?: string }

/**
 * Экран поиска с радаром — тот же, что в подборе 2х2/5х5.
 * Используется и для кланового подбора 5х5.
 */
export function SearchRadar({
  slots, filled, total, title = 'Поиск игроков', subtitle = 'Подбираем соперников вашего уровня',
  onCancel, cancelLabel = 'Выйти из очереди',
}: {
  slots: (RadarSlot | null)[]
  filled: number
  total: number
  title?: string
  subtitle?: string
  onCancel?: () => void
  cancelLabel?: string
}) {
  const pct = total ? (filled / total) * 100 : 0

  const renderOrb = (slot: RadarSlot | null | undefined, i: number) => (
    <div key={i} style={{ width: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      {slot ? (
        <motion.div initial={{ scale: 0, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 20 }}>
          <motion.div
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            style={{ width: 46, height: 46, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg, #E8092E, #ff5a72)', boxShadow: '0 0 16px rgba(232,9,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: 1.5, background: '#060608' }}>
              <Avatar avatarUrl={slot.avatarUrl} name={slot.name || '?'} size={39} style={{ borderRadius: '50%' }} />
            </div>
          </motion.div>
        </motion.div>
      ) : (
        <motion.div
          animate={{ opacity: [0.25, 0.55, 0.25], scale: [1, 1.05, 1] }}
          transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
          style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px dashed rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="user" size={18} color="rgba(255,255,255,0.2)" />
        </motion.div>
      )}
      <span style={{ fontSize: 9, fontWeight: 600, maxWidth: 52, width: '100%', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: slot ? '#9CA3AF' : '#374151' }}>
        {slot ? (slot.name || '...') : 'поиск'}
      </span>
    </div>
  )

  return (
    <div style={{ minHeight: '64vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '8px 8px 24px', position: 'relative', overflow: 'hidden' }}>
      {/* Ambient glow */}
      <div style={{ position: 'absolute', top: '12%', left: '50%', transform: 'translateX(-50%)', width: 440, height: 440, pointerEvents: 'none', filter: 'blur(10px)', background: 'radial-gradient(circle, rgba(232,9,46,0.12), transparent 62%)' }} />

      {/* ── RADAR ── */}
      <div style={{ position: 'relative', width: 230, height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
        {[0, 1, 2].map(i => (
          <motion.div key={`p${i}`}
            initial={{ scale: 0.25, opacity: 0 }}
            animate={{ scale: [0.25, 0.6, 1], opacity: [0, 0.45, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: 'easeOut', times: [0, 0.5, 1] }}
            style={{ position: 'absolute', width: 230, height: 230, borderRadius: '50%', border: '1.5px solid rgba(232,9,46,0.4)' }}
          />
        ))}
        {[230, 170, 112].map((d, i) => (
          <div key={`r${i}`} style={{ position: 'absolute', width: d, height: d, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }} />
        ))}
        <div style={{ position: 'absolute', width: 230, height: 1, background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'absolute', width: 1, height: 230, background: 'rgba(255,255,255,0.04)' }} />
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', width: 230, height: 230, borderRadius: '50%', background: 'conic-gradient(from 0deg, transparent 0deg, rgba(232,9,46,0.22) 55deg, rgba(232,9,46,0.03) 75deg, transparent 82deg)' }}
        />
        <div style={{ position: 'relative', zIndex: 1, width: 112, height: 112, borderRadius: '50%', background: 'radial-gradient(circle at 50% 32%, rgba(232,9,46,0.2), rgba(6,6,8,0.92))', border: '1px solid rgba(232,9,46,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 0 26px rgba(232,9,46,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <motion.span key={filled}
              initial={{ scale: 1.6, color: '#fff' }}
              animate={{ scale: 1, color: '#E8092E' }}
              transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              style={{ fontSize: 42, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
            >{filled}</motion.span>
            <span style={{ fontSize: 18, fontWeight: 800, color: '#4B5563' }}>/{total}</span>
          </div>
          <div style={{ fontSize: 8, fontWeight: 800, color: '#6B7280', letterSpacing: '0.14em', marginTop: 3, textTransform: 'uppercase' }}>в лобби</div>
        </div>
      </div>

      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.4px' }}>{title}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {[0, 1, 2].map(i => (
            <motion.span key={`d${i}`}
              animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: '#E8092E', display: 'inline-block' }}
            />
          ))}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 26 }}>{subtitle}</div>

      {/* Player slots */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth: 320, marginBottom: 26 }}>
        {Array.from({ length: total }).map((_, i) => renderOrb(slots[i], i))}
      </div>

      {/* Progress bar */}
      <div style={{ width: 'min(280px, 82%)', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 22, position: 'relative' }}>
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 120, damping: 20 }}
          style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #E8092E, #ff5a72)', boxShadow: '0 0 10px rgba(232,9,46,0.6)' }}
        />
      </div>

      {/* Cancel */}
      {onCancel && (
        <motion.button whileTap={{ scale: 0.95 }} onClick={onCancel}
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '9px 22px', color: '#6B7280', fontSize: 12, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Icon name="x" size={13} />{cancelLabel}
        </motion.button>
      )}
    </div>
  )
}
