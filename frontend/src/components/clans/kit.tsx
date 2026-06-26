'use client'

// ════════════════════════════════════════════════════════════════════════════
//  CONDR · Clans premium UI kit
//  Единый набор «вау»-примитивов для всего раздела кланов и подразделов.
//  Дизайн-язык платформы: gradient-mesh hero, roaming-эмблема, dotted-grid,
//  shimmer, светящиеся числа, tilt-карточки, анимированные счётчики.
// ════════════════════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'
import { avatarBg } from '@/lib/avatar'
import { useSheetDrag } from '@/lib/useSheetDrag'
import { Logo } from '@/components/ui/Logo'
import { Icon, IconName } from '@/components/ui/Icon'

export const ACCENT = '#22C55E'
export const CARD = '#0f0f15'

// ── Рейтинговые «лиги» клана ───────────────────────────────────────────────────
export interface ClanTier { label: string; g1: string; g2: string }
export function clanTier(rating: number): ClanTier {
  if (rating >= 1600) return { label: 'ЭЛИТА',   g1: '#A855F7', g2: '#E8092E' }
  if (rating >= 1300) return { label: 'ВЕТЕРАН', g1: '#F59E0B', g2: '#EF4444' }
  if (rating >= 1100) return { label: 'БОЕЦ',    g1: '#22C55E', g2: '#0EA5E9' }
  return { label: 'НОВИЧОК', g1: '#64748B', g2: '#475569' }
}
export function clanGrad(rating: number): [string, string] {
  const t = clanTier(rating); return [t.g1, t.g2]
}

// ── Анимированный счётчик ──────────────────────────────────────────────────────
export function AnimatedNumber({ value, duration = 1.1, format = true }: { value: number; duration?: number; format?: boolean }) {
  const mv = useMotionValue(0)
  const spring = useSpring(mv, { duration: duration * 1000, bounce: 0 })
  const [display, setDisplay] = useState(0)
  useEffect(() => { mv.set(value) }, [value])
  useEffect(() => spring.on('change', v => setDisplay(Math.round(v))), [spring])
  return <>{format ? display.toLocaleString() : display}</>
}

// ── Эмблема клана (анимированное кольцо ранга + свечение) ───────────────────────
export function ClanAvatar({ url, tag, size, rating, ring = false, glow = false }: {
  url: string | null; tag: string; size: number; rating: number; ring?: boolean; glow?: boolean
}) {
  const [g1, g2] = clanGrad(rating)
  const bg = avatarBg(url)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {ring && (
        <motion.div
          animate={{ rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', inset: -3, borderRadius: size * 0.32, background: `conic-gradient(${g1}, transparent 55%, ${g2})`, opacity: 0.75 }}
        />
      )}
      {glow && (
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: `radial-gradient(circle, ${g1}44, transparent 70%)`, pointerEvents: 'none' }}
        />
      )}
      <div style={{
        position: 'relative', width: size, height: size, borderRadius: size * 0.26,
        background: bg || `linear-gradient(135deg, ${g1}, ${g2})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1px solid rgba(255,255,255,0.12)', boxShadow: `0 6px 22px ${g1}33, inset 0 1px 0 rgba(255,255,255,0.12)`,
        overflow: 'hidden',
      }}>
        {!bg && <span style={{ fontSize: size * 0.34, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>{tag.slice(0, 2).toUpperCase()}</span>}
        {/* верхний блик стекла */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '42%', background: 'linear-gradient(180deg, rgba(255,255,255,0.16), transparent)', pointerEvents: 'none' }} />
      </div>
    </div>
  )
}

// ── Декор премиум-карточки (roaming-эмблема + сетка + shimmer) ──────────────────
export function HeroDecor({ g1, g2, emblem = true }: { g1: string; g2: string; emblem?: boolean }) {
  return (
    <>
      {emblem && (
        <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
          <motion.div
            animate={{ x: [-120, 110, -60, 130, -120], y: [-38, 44, -50, 30, -38], opacity: [0.05, 0.1, 0.06, 0.09, 0.05] }}
            transition={{ duration: 42, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.div
              animate={{ rotate: 360, scale: [1, 1.08, 1] }}
              transition={{ rotate: { duration: 80, repeat: Infinity, ease: 'linear' }, scale: { duration: 12, repeat: Infinity, ease: 'easeInOut' } }}
              style={{ filter: `drop-shadow(0 0 22px ${g1}66)` }}
            >
              <Logo size={200} color={g1} />
            </motion.div>
          </motion.div>
        </div>
      )}
      {/* dotted grid */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5,
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '18px 18px',
        WebkitMaskImage: 'radial-gradient(120% 120% at 20% 0%, #000 24%, transparent 70%)',
        maskImage: 'radial-gradient(120% 120% at 20% 0%, #000 24%, transparent 70%)',
      }} />
      {/* shimmer sweep */}
      <motion.div animate={{ x: ['-130%', '230%'] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 6, ease: 'linear' }}
        style={{ position: 'absolute', top: 0, bottom: 0, width: '28%', pointerEvents: 'none', background: `linear-gradient(90deg, transparent, ${g1}16, transparent)` }} />
    </>
  )
}

// ── Премиум-обёртка карточки (mesh + border + glow) ─────────────────────────────
export function GlassCard({ g1, g2, children, style, padding = 18, decor = true }: {
  g1: string; g2: string; children: React.ReactNode; style?: React.CSSProperties; padding?: number; decor?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 280, damping: 26 }}
      style={{
        borderRadius: 24, overflow: 'hidden', position: 'relative',
        background: `radial-gradient(130% 130% at 0% 0%, ${g1}22, transparent 46%), radial-gradient(130% 130% at 100% 100%, ${g2}14, transparent 52%), linear-gradient(160deg, #0c0c11, #08080b)`,
        border: `1px solid ${g1}33`, boxShadow: `0 16px 50px ${g1}1a`, padding, ...style,
      }}>
      {decor && <HeroDecor g1={g1} g2={g2} />}
      <div style={{ position: 'relative' }}>{children}</div>
    </motion.div>
  )
}

// ── Заголовок раздела (gradient icon-badge) ────────────────────────────────────
export function PageHeader({ title, subtitle, icon, g1, g2 }: { title: string; subtitle: string; icon: IconName; g1: string; g2: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
      <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${g1}, ${g2})`, boxShadow: `0 8px 22px ${g1}55` }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)' }} />
        <Icon name={icon} size={23} color="#fff" />
      </div>
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{title}</h1>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{subtitle}</div>
      </div>
    </motion.div>
  )
}

// ── Премиум стат-плитка (accent-line + faded icon + счётчик) ────────────────────
export function StatTile({ label, value, color, icon, big, numeric, delay = 0 }: {
  label: string; value: string | number; color: string; icon?: IconName; big?: boolean; numeric?: number; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        background: CARD, border: `1px solid ${color}26`, borderRadius: 16,
        padding: big ? '15px 16px' : '13px 12px', position: 'relative', overflow: 'hidden',
      }}>
      <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1, background: `linear-gradient(90deg, transparent, ${color}aa, transparent)` }} />
      {icon && <div style={{ position: 'absolute', top: -8, right: -6, opacity: 0.09, pointerEvents: 'none' }}><Icon name={icon} size={big ? 56 : 44} color={color} /></div>}
      <div style={{ fontSize: big ? 27 : 18, fontWeight: 900, color, letterSpacing: '-0.02em', position: 'relative', lineHeight: 1 }}>
        {numeric != null ? <AnimatedNumber value={numeric} /> : value}
      </div>
      <div style={{ fontSize: big ? 11 : 10, color: '#6B7280', marginTop: big ? 6 : 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', position: 'relative' }}>{label}</div>
    </motion.div>
  )
}

// ── Навигационная tilt-карточка (Расписание / Праки / История …) ───────────────
export function NavCard({ icon, title, sub, color, badge, onClick, delay = 0 }: {
  icon: IconName; title: string; sub: string; color: string; badge?: string | number; onClick: () => void; delay?: number
}) {
  const ref = useRef<HTMLButtonElement>(null)
  const shineRef = useRef<HTMLDivElement>(null)
  const raf = useRef(0)
  const track = (cx: number, cy: number) => {
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const el = ref.current, sh = shineRef.current; if (!el || !sh) return
      const r = el.getBoundingClientRect()
      const x = (cx - r.left) / r.width, y = (cy - r.top) / r.height
      el.style.transform = `perspective(700px) rotateX(${(0.5 - y) * 10}deg) rotateY(${(x - 0.5) * 10}deg) scale(1.015)`
      sh.style.background = `radial-gradient(circle at ${x * 100}% ${y * 100}%, rgba(255,255,255,0.16) 0%, transparent 55%)`
    })
  }
  const reset = () => {
    cancelAnimationFrame(raf.current)
    const el = ref.current, sh = shineRef.current; if (!el || !sh) return
    el.style.transform = 'perspective(700px) rotateX(0) rotateY(0) scale(1)'; sh.style.background = 'none'
  }
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      onMouseMove={e => track(e.clientX, e.clientY)} onMouseLeave={reset}
      onTouchMove={e => { const t = e.touches[0]; track(t.clientX, t.clientY) }} onTouchEnd={reset}>
      <button ref={ref} onClick={onClick}
        style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', padding: '14px 16px', borderRadius: 16, border: `1px solid ${color}2a`, background: CARD, cursor: 'pointer', textAlign: 'left', position: 'relative', overflow: 'hidden', transition: 'transform 0.15s ease', willChange: 'transform' }}>
        <div style={{ position: 'absolute', top: -22, right: -16, opacity: 0.08, pointerEvents: 'none' }}><Icon name={icon} size={64} color={color} /></div>
        <div style={{ position: 'absolute', top: 0, left: '10%', right: '10%', height: 1, background: `linear-gradient(90deg, transparent, ${color}88, transparent)` }} />
        <div ref={shineRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 16 }} />
        <div style={{ width: 40, height: 40, borderRadius: 12, background: `${color}16`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
          <Icon name={icon} size={20} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{sub}</div>
        </div>
        {badge != null && <span style={{ fontSize: 12, fontWeight: 800, color, background: `${color}1f`, padding: '3px 9px', borderRadius: 20, position: 'relative' }}>{badge}</span>}
        <Icon name="chevronRight" size={18} color="#4B5563" style={{ position: 'relative' }} />
      </button>
    </motion.div>
  )
}

// ── Пилюльные табы (sliding highlight) ─────────────────────────────────────────
export function Tabs<T extends string>({ tabs, value, onChange, g1, g2, layoutId }: {
  tabs: [T, string, (number | undefined)?][]; value: T; onChange: (t: T) => void; g1: string; g2: string; layoutId: string
}) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
      {tabs.map(([t, label, count]) => (
        <button key={t} onClick={() => onChange(t)}
          style={{ flex: 1, position: 'relative', padding: '9px 0', border: 'none', cursor: 'pointer', background: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: value === t ? '#fff' : '#6B7280', transition: 'color .2s' }}>
          {value === t && <motion.div layoutId={layoutId} style={{ position: 'absolute', inset: 0, borderRadius: 10, background: `linear-gradient(135deg, ${g1}cc, ${g2}cc)`, zIndex: -1, boxShadow: `0 4px 14px ${g1}44` }} />}
          {label}
          {count != null && count > 0 && <span style={{ position: 'absolute', top: 2, right: 7, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#E8092E', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{count}</span>}
        </button>
      ))}
    </div>
  )
}

// ── Кнопка «Назад» ─────────────────────────────────────────────────────────────
export function BackBtn({ onClick, label = 'Назад' }: { onClick: () => void; label?: string }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}>
      <Icon name="chevronLeft" size={18} color="#9CA3AF" /> {label}
    </button>
  )
}

// ── Лоадер ─────────────────────────────────────────────────────────────────────
export function Loader({ color = ACCENT }: { color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 56 }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
        style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: color }} />
    </div>
  )
}

// ── Пустое состояние ───────────────────────────────────────────────────────────
export function Empty({ text, icon = 'shield' }: { text: string; icon?: IconName }) {
  return (
    <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6B7280' }}>
      <div style={{ width: 64, height: 64, margin: '0 auto 14px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={28} color="#374151" />
      </div>
      <div style={{ fontSize: 14 }}>{text}</div>
    </div>
  )
}

// ── Нижний bottom-sheet ────────────────────────────────────────────────────────
export function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const sheet = useSheetDrag(onClose)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div {...sheet.panelProps} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: 'linear-gradient(180deg, #101016, #0a0a0f)', borderRadius: '26px 26px 0 0', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none', padding: 20, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -20px 60px rgba(0,0,0,0.5)' }}>
        <div {...sheet.handleProps} style={{ ...sheet.handleProps.style, padding: '4px 0 16px' }}>
          <div style={{ width: 42, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

// ── Премиум-плитка карты ───────────────────────────────────────────────────────
const mapImg = (m: string) => `/maps/${m.charAt(0) + m.slice(1).toLowerCase()}.webp`
const mapLabel = (m: string) => m === 'LOBBY' ? 'В лобби' : m.charAt(0) + m.slice(1).toLowerCase()
export function MapTile({ map, selected, color, index, onClick }: { map: string; selected: boolean; color: string; index?: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0, transform: selected ? 'translateY(-3px)' : 'none', transition: 'transform .15s', boxShadow: selected ? `0 10px 24px ${color}55` : '0 2px 8px rgba(0,0,0,0.3)' }}>
      <div style={{ position: 'absolute', inset: 0, background: `url(${mapImg(map)}) center/cover`, transform: selected ? 'scale(1.1)' : 'scale(1)', transition: 'transform .25s' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.1) 58%, transparent 100%)' }} />
      {selected && <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: `2.5px solid ${color}`, background: `${color}1f` }} />}
      {selected && (index != null
        ? <div style={{ position: 'absolute', top: 6, right: 6, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,0.4)' }}>{index + 1}</div>
        : <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={13} color="#fff" /></div>
      )}
      <span style={{ position: 'absolute', left: 8, right: 8, bottom: 7, fontSize: 11, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{mapLabel(map)}</span>
    </button>
  )
}

export { mapImg, mapLabel }
export { AnimatePresence }
