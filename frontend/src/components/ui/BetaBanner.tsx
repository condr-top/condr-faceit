'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Icon } from '@/components/ui/Icon'

const ACCENT = '#E8092E'

export function BetaBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600)
    return () => clearTimeout(t)
  }, [])

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } },
  }
  const item = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 320, damping: 26 } },
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVisible(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 100000,
              background: 'radial-gradient(120% 80% at 50% 100%, rgba(232,9,46,0.18) 0%, rgba(0,0,0,0.62) 55%)',
              backdropFilter: 'blur(7px)',
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '110%' }}
            animate={{ y: 0 }}
            exit={{ y: '110%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100001,
              maxWidth: 480, margin: '0 auto',
              background: 'linear-gradient(180deg, rgba(24,21,30,0.98) 0%, rgba(13,11,17,0.99) 100%)',
              backdropFilter: 'blur(28px) saturate(180%)',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              borderLeft: '1px solid rgba(255,255,255,0.05)',
              borderRight: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '28px 28px 0 0',
              padding: '10px 24px 38px',
              overflow: 'hidden',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.6), 0 -1px 0 rgba(232,9,46,0.25)',
            }}
          >
            {/* Animated top glow line */}
            <motion.div
              animate={{ backgroundPositionX: ['0%', '200%'] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, transparent, ${ACCENT}, #ff5a78, ${ACCENT}, transparent)`,
                backgroundSize: '200% 100%',
              }}
            />
            {/* Ambient corner glows */}
            <div style={{ position: 'absolute', top: -60, left: -40, width: 180, height: 180, background: `radial-gradient(circle, ${ACCENT}33, transparent 70%)`, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: -40, right: -50, width: 160, height: 160, background: 'radial-gradient(circle, rgba(255,120,80,0.16), transparent 70%)', pointerEvents: 'none' }} />

            {/* Grab handle */}
            <div style={{ width: 44, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.16)', margin: '0 auto 22px' }} />

            <motion.div variants={container} initial="hidden" animate="show" style={{ position: 'relative' }}>
              {/* Hero icon with rotating gradient ring */}
              <motion.div variants={item} style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                <div style={{ position: 'relative', width: 88, height: 88 }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                    style={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      background: `conic-gradient(from 0deg, ${ACCENT}, #ff7a5a, #ffb86b, ${ACCENT})`,
                      filter: 'blur(1px)',
                    }}
                  />
                  <motion.div
                    animate={{ opacity: [0.5, 0.9, 0.5], scale: [1, 1.08, 1] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                    style={{
                      position: 'absolute', inset: -8, borderRadius: '50%',
                      background: `radial-gradient(circle, ${ACCENT}55, transparent 65%)`,
                    }}
                  />
                  <div style={{
                    position: 'absolute', inset: 4, borderRadius: '50%',
                    background: 'linear-gradient(160deg, #1a1620, #0e0c12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: ACCENT, boxShadow: 'inset 0 1px 8px rgba(255,255,255,0.06)',
                  }}>
                    <Icon name="flask" size={36} strokeWidth={1.6} />
                  </div>
                </div>
              </motion.div>

              {/* BETA pill */}
              <motion.div variants={item} style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '5px 13px', borderRadius: 30,
                  background: `linear-gradient(90deg, ${ACCENT}22, rgba(255,120,90,0.14))`,
                  border: `1px solid ${ACCENT}44`,
                }}>
                  <motion.span
                    animate={{ opacity: [1, 0.35, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
                  />
                  <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: '0.18em', color: '#ff8a9e' }}>BETA</span>
                </div>
              </motion.div>

              {/* Title */}
              <motion.div variants={item} style={{
                textAlign: 'center', fontSize: 25, fontWeight: 900, color: '#fff',
                letterSpacing: '-0.01em', marginBottom: 10,
                textShadow: `0 2px 24px ${ACCENT}40`,
              }}>
                Бета-версия
              </motion.div>

              {/* Text */}
              <motion.div variants={item} style={{
                textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.52)',
                lineHeight: 1.65, marginBottom: 22, padding: '0 6px',
              }}>
                Приложение в активной разработке. Могут встречаться баги и недоработки — спасибо, что тестируешь с нами <Icon name="handshake" size={15} style={{ verticalAlign: 'text-bottom' }} />
              </motion.div>

              {/* Contact card */}
              <motion.a
                variants={item}
                href="https://t.me/LordAlekss"
                target="_blank"
                rel="noopener noreferrer"
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: `linear-gradient(90deg, ${ACCENT}14, rgba(255,255,255,0.02))`,
                  border: `1px solid ${ACCENT}2e`,
                  borderRadius: 14, padding: '13px 15px', marginBottom: 22,
                  textDecoration: 'none',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                  background: `linear-gradient(135deg, ${ACCENT}, #b00722)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: `0 4px 14px ${ACCENT}55`,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                    <path d="M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z"/>
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 2 }}>Нашёл баг или есть идея?</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>@LordAlekss</div>
                </div>
                <span style={{ color: ACCENT, fontSize: 18, fontWeight: 700 }}>→</span>
              </motion.a>

              {/* CTA */}
              <motion.button
                variants={item}
                whileTap={{ scale: 0.97 }}
                onClick={() => setVisible(false)}
                style={{
                  position: 'relative', width: '100%', padding: '15px 0',
                  background: `linear-gradient(135deg, ${ACCENT}, #ff3d5e)`,
                  border: 'none', borderRadius: 14,
                  color: '#fff', fontSize: 16, fontWeight: 900, letterSpacing: '0.02em',
                  cursor: 'pointer', overflow: 'hidden',
                  boxShadow: `0 10px 30px ${ACCENT}50`,
                }}
              >
                {/* shine sweep */}
                <motion.span
                  animate={{ x: ['-130%', '230%'] }}
                  transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', top: 0, bottom: 0, width: '45%',
                    background: 'linear-gradient(105deg, transparent, rgba(255,255,255,0.45), transparent)',
                    transform: 'skewX(-18deg)',
                  }}
                />
                <span style={{ position: 'relative' }}>Понятно, погнали</span>
              </motion.button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
