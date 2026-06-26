'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { Logo } from '@/components/ui/Logo'

export default function AuthPage() {
  const { login, isAuthenticated, isLoading } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp

    const redirect = (user: any) => {
      if (!user.isRegistered) {
        router.replace('/register')
      } else {
        router.replace('/dashboard')
      }
    }

    const initData = tg?.initData || ''
    const isRealTelegram = initData.length > 10

    if (isRealTelegram) {
      login(initData).then((user: any) => redirect(user)).catch(() => {})
    } else {
      // Не в Telegram (обычный браузер): есть токен → в приложение, иначе на вход сайта.
      const token = localStorage.getItem('condr_faceit_token')
      router.replace(token ? '/web' : '/web/login')
    }
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
      {/* Background radial glow */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 500, height: 500,
        background: 'radial-gradient(ellipse, rgba(232,9,46,0.08) 0%, transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 300,
        background: 'radial-gradient(ellipse, rgba(168,85,247,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, type: 'spring', stiffness: 260, damping: 24 }}
        style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}
      >
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{ margin: '0 auto 26px', width: 'fit-content' }}
          >
            <motion.div
              animate={{ filter: [
                'drop-shadow(0 0 14px rgba(232,9,46,0.35))',
                'drop-shadow(0 0 46px rgba(232,9,46,0.85))',
                'drop-shadow(0 0 14px rgba(232,9,46,0.35))',
              ] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Logo size={150} color="#fff" />
            </motion.div>
          </motion.div>

          <h1 style={{ fontSize: 40, fontWeight: 900, color: '#fff', margin: '0 0 8px', letterSpacing: '-1px' }}>CONDR</h1>
          <p style={{ color: '#4B5563', fontSize: 16, margin: 0, fontWeight: 500 }}>Faceit for Standoff 2</p>
        </div>

        {/* Loading indicator */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {/* Animated dots */}
          <div style={{ display: 'flex', gap: 6 }}>
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: '#E8092E',
                }}
              />
            ))}
          </div>
          <motion.div
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ color: '#4B5563', fontSize: 13, fontWeight: 500 }}
          >
            {isLoading ? 'Авторизация...' : 'Загрузка...'}
          </motion.div>
        </div>

        {/* Subtle tagline */}
        <div style={{ marginTop: 48, color: '#1f2937', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
          Ranked · Competitive · Community
        </div>
      </motion.div>
    </div>
  )
}
