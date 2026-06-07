'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

export function BetaBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Small delay so it doesn't flash before the page renders
    const t = setTimeout(() => setVisible(true), 600)
    return () => clearTimeout(t)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 100000,
              background: 'rgba(0,0,0,0.55)',
              backdropFilter: 'blur(4px)',
            }}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={{
              position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100001,
              background: 'rgba(18,18,26,0.97)',
              backdropFilter: 'blur(24px) saturate(180%)',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '20px 20px 0 0',
              padding: '28px 24px 40px',
            }}
          >
            {/* Handle */}
            <div style={{
              width: 40, height: 4, borderRadius: 2,
              background: 'rgba(255,255,255,0.15)',
              margin: '0 auto 24px',
            }} />

            {/* Icon */}
            <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 14 }}>🧪</div>

            {/* Title */}
            <div style={{
              textAlign: 'center', fontSize: 20, fontWeight: 800,
              color: '#fff', marginBottom: 10,
            }}>
              Бета-версия
            </div>

            {/* Text */}
            <div style={{
              textAlign: 'center', fontSize: 14, color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.6, marginBottom: 20,
            }}>
              Приложение находится в стадии бета-тестирования.{' '}
              Могут встречаться баги, ошибки и недоработки.
            </div>

            {/* Contact block */}
            <div style={{
              background: 'rgba(232,9,46,0.1)',
              border: '1px solid rgba(232,9,46,0.25)',
              borderRadius: 12,
              padding: '12px 16px',
              textAlign: 'center',
              marginBottom: 24,
            }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 4 }}>
                Нашёл баг или есть идея?
              </div>
              <a
                href="https://t.me/LordAlekss"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 16, fontWeight: 800, color: '#E8092E',
                  textDecoration: 'none', letterSpacing: 0.3,
                }}
              >
                @LordAlekss
              </a>
            </div>

            {/* Button */}
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setVisible(false)}
              style={{
                width: '100%', padding: '14px 0',
                background: '#E8092E', border: 'none', borderRadius: 12,
                color: '#fff', fontSize: 16, fontWeight: 800,
                cursor: 'pointer', letterSpacing: 0.3,
              }}
            >
              Понятно
            </motion.button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
