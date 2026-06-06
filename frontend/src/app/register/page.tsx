'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export default function RegisterPage() {
  const router = useRouter()
  const { refreshUser, user } = useAuthStore()
  const [form, setForm] = useState({
    gameNickname: user?.gameNickname || '',
    gameId: user?.gameId || '',
    deviceSerial: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!form.gameNickname.trim() || !form.gameId.trim() || !form.deviceSerial.trim()) {
      setError('Заполни все поля')
      return
    }
    setLoading(true)
    setError('')
    try {
      await api.post('/users/register', form)
      await refreshUser()
      router.replace('/dashboard')
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle = (name: string) => ({
    width: '100%',
    background: focused === name ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
    border: focused === name ? '1px solid rgba(232,9,46,0.5)' : '1px solid rgba(255,255,255,0.09)',
    borderRadius: 12,
    padding: '13px 16px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    transition: 'border 0.2s, background 0.2s',
    boxSizing: 'border-box' as const,
    boxShadow: focused === name ? '0 0 0 2px rgba(232,9,46,0.12)' : 'none',
  })

  const fields = [
    { name: 'gameNickname', label: 'Игровой никнейм', placeholder: 'Твой ник в Standoff 2', hint: null },
    { name: 'gameId', label: 'Игровой ID', placeholder: 'ID из профиля Standoff 2', hint: null },
    { name: 'deviceSerial', label: 'Серийный номер устройства', placeholder: 'Серийный номер', hint: 'Используется для защиты от мультиаккаунтов' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 20px' }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%, -50%)',
        width: 400, height: 400,
        background: 'radial-gradient(ellipse, rgba(232,9,46,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 24 }}
        style={{ maxWidth: 400, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}
      >
        {/* Logo + title */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 18, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, rgba(232,9,46,0.2), rgba(180,0,30,0.25))',
            border: '1px solid rgba(232,9,46,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 24px rgba(232,9,46,0.2)',
          }}>
            <span style={{ fontSize: 28, fontWeight: 900, color: '#E8092E' }}>C</span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Регистрация</h1>
          <p style={{ color: '#4B5563', fontSize: 13, margin: 0 }}>Укажи свои игровые данные</p>
        </div>

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
          {fields.map((f, i) => (
            <motion.div
              key={f.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
            >
              <label style={{ display: 'block', fontSize: 11, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                {f.label}
              </label>
              <input
                value={form[f.name as keyof typeof form]}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                placeholder={f.placeholder}
                style={inputStyle(f.name)}
                onFocus={() => setFocused(f.name)}
                onBlur={() => setFocused(null)}
              />
              {f.hint && (
                <p style={{ fontSize: 11, color: '#374151', marginTop: 5, marginBottom: 0 }}>
                  {f.hint}
                </p>
              )}
            </motion.div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              background: 'rgba(232,9,46,0.08)',
              border: '1px solid rgba(232,9,46,0.3)',
              borderRadius: 12, padding: '10px 16px',
              fontSize: 13, color: '#F87171',
              textAlign: 'center', marginBottom: 16,
            }}
          >
            {error}
          </motion.div>
        )}

        {/* Submit button */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSubmit}
          disabled={loading}
          style={{
            width: '100%', padding: '15px 0',
            borderRadius: 14, border: 'none', cursor: loading ? 'default' : 'pointer',
            background: loading
              ? 'rgba(255,255,255,0.06)'
              : 'linear-gradient(135deg, rgba(232,9,46,0.95), rgba(180,0,30,1))',
            color: loading ? '#4B5563' : '#fff',
            fontWeight: 900, fontSize: 15,
            boxShadow: loading ? 'none' : '0 4px 24px rgba(232,9,46,0.35), inset 0 1px 0 rgba(255,255,255,0.1)',
            transition: 'all 0.2s',
            letterSpacing: '0.02em',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {!loading && (
            <motion.div
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }}
              style={{
                position: 'absolute', top: 0, bottom: 0, width: '35%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)',
                pointerEvents: 'none',
              }}
            />
          )}
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </motion.button>
      </motion.div>
    </div>
  )
}
