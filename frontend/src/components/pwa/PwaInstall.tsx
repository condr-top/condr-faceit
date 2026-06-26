'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Logo } from '@/components/ui/Logo'
import { Icon } from '@/components/ui/Icon'

const ACCENT = '#E8092E'
const DISMISS_KEY = 'condr_pwa_dismiss'
const DISMISS_MS = 7 * 24 * 3600 * 1000

export function PwaInstall() {
  const [deferred, setDeferred] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    // 1) Регистрируем service worker (нужно для установки)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    // 2) Решаем, показывать ли предложение установки
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      (window.navigator as any).standalone === true
    const inTelegram = !!(window as any).Telegram?.WebApp?.initData
    const isMobile = window.matchMedia('(max-width: 820px)').matches
    if (standalone || inTelegram || !isMobile) return // уже установлено / в Telegram / десктоп

    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0)
    if (Date.now() - dismissedAt < DISMISS_MS) return

    const ua = navigator.userAgent || ''
    const isIos = /iphone|ipad|ipod/i.test(ua) || (/Mac/.test(ua) && 'ontouchend' in document)
    if (isIos) {
      // iOS не поддерживает beforeinstallprompt — показываем инструкцию
      setIos(true)
      const t = setTimeout(() => setShow(true), 1800)
      return () => clearTimeout(t)
    }

    // Android / Chromium — ловим системное событие
    const onBip = (e: any) => { e.preventDefault(); setDeferred(e); setShow(true) }
    const onInstalled = () => { setShow(false); localStorage.setItem(DISMISS_KEY, String(Date.now())) }
    window.addEventListener('beforeinstallprompt', onBip)
    window.addEventListener('appinstalled', onInstalled)
    return () => { window.removeEventListener('beforeinstallprompt', onBip); window.removeEventListener('appinstalled', onInstalled) }
  }, [])

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    try { await deferred.userChoice } catch {}
    setDeferred(null)
    setShow(false)
  }
  const dismiss = () => { localStorage.setItem(DISMISS_KEY, String(Date.now())); setShow(false) }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 70 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 70 }}
          transition={{ type: 'spring', stiffness: 340, damping: 32 }}
          style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom, 0px))', zIndex: 120, pointerEvents: 'auto' }}
        >
          <div style={{
            position: 'relative', overflow: 'hidden', borderRadius: 20, padding: 16,
            background: 'linear-gradient(135deg, rgba(232,9,46,0.16), rgba(12,12,17,0.96) 60%)',
            border: `1px solid ${ACCENT}55`,
            boxShadow: '0 18px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
            backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
          }}>
            <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1, background: `linear-gradient(90deg, transparent, ${ACCENT}, transparent)` }} />
            <div style={{ position: 'absolute', top: -26, right: -10, width: 110, height: 110, background: `radial-gradient(circle, ${ACCENT}22, transparent 70%)`, pointerEvents: 'none' }} />

            <button onClick={dismiss} aria-label="Закрыть" style={{ position: 'absolute', top: 10, right: 10, width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="x" size={15} color="#9CA3AF" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
              <div style={{ width: 52, height: 52, borderRadius: 15, flexShrink: 0, background: `linear-gradient(135deg, ${ACCENT}, #b4001e)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 22px ${ACCENT}55` }}>
                <Logo size={30} color="#fff" />
              </div>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 24 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>Установить CONDR</div>
                <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 2, lineHeight: 1.4 }}>
                  {ios ? 'Запускается как приложение, на весь экран' : 'Полноэкранное приложение на главном экране'}
                </div>
              </div>
            </div>

            {ios ? (
              <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 13px', borderRadius: 13, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 12.5, color: '#D1D5DB', lineHeight: 1.45 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, background: 'rgba(96,165,250,0.16)', border: '1px solid rgba(96,165,250,0.3)', flexShrink: 0 }}>
                  <Icon name="upload" size={15} color="#60A5FA" />
                </span>
                <span>Нажмите <b style={{ color: '#fff' }}>Поделиться</b>, затем <b style={{ color: '#fff' }}>«На экран „Домой"»</b></span>
              </div>
            ) : (
              <motion.button whileTap={{ scale: 0.97 }} onClick={install}
                style={{ width: '100%', marginTop: 14, padding: '13px 0', borderRadius: 13, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #b4001e)`, boxShadow: `0 8px 24px ${ACCENT}44, inset 0 1px 0 rgba(255,255,255,0.16)`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Icon name="upload" size={17} color="#fff" />Установить приложение
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
