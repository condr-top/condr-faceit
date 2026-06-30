'use client'

import { motion } from 'framer-motion'
import { GamePrize, PrizeIcon, RARITY } from './prize'

/** Модалка результата (что выпало и зачислено). */
export function GameResult({ granted, onClose }: { granted: GamePrize | null; onClose: () => void }) {
  if (!granted) {
    // Промах (слоты)
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
        style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(4,4,7,0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
        <motion.div initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }} onClick={e => e.stopPropagation()}
          style={{ width: '100%', maxWidth: 320, background: 'linear-gradient(180deg, #15151c, #0a0a0f)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 22, padding: 26, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>😕</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Не повезло</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4, marginBottom: 18 }}>Попробуй ещё раз!</div>
          <button onClick={onClose} style={{ width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.08)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' }}>Закрыть</button>
        </motion.div>
      </motion.div>
    )
  }
  const rc = RARITY[granted.rarity] || RARITY.common
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(4,4,7,0.88)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <motion.div initial={{ scale: 0.8, y: 24 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 340, background: `radial-gradient(120% 90% at 50% 0%, ${rc.c}26, transparent 60%), linear-gradient(180deg, #15151c, #0a0a0f)`, border: `1px solid ${rc.c}66`, borderRadius: 24, padding: 28, textAlign: 'center', boxShadow: `0 20px 60px ${rc.glow}` }}>
        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.14em', textTransform: 'uppercase', color: rc.c, marginBottom: 14 }}>{rc.name}</div>
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.1, type: 'spring', stiffness: 200, damping: 12 }}
          style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, filter: `drop-shadow(0 0 22px ${rc.glow})` }}>
          <PrizeIcon prize={granted} size={96} />
        </motion.div>
        <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{granted.label}</div>
        {granted.converted && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Предмет уже был — конвертирован в монеты</div>}
        <button onClick={onClose} style={{ marginTop: 22, width: '100%', padding: '13px 0', borderRadius: 14, border: 'none', background: `linear-gradient(135deg, ${rc.c}, ${rc.c}bb)`, color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: `0 6px 24px ${rc.glow}` }}>Забрать</button>
      </motion.div>
    </motion.div>
  )
}
