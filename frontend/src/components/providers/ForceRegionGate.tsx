'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { REGIONS } from '@/lib/regions'
import { Flag } from '@/components/ui/Flag'
import { Icon } from '@/components/ui/Icon'

const ACCENT = '#E8092E'

/**
 * Обязательный выбор региона для уже зарегистрированных игроков, у которых регион
 * ещё не указан. Полноэкранный, закрыть нельзя — пока не выберешь.
 */
export function ForceRegionGate() {
  const pathname = usePathname()
  const { user, isAuthenticated, refreshUser } = useAuthStore()
  const [region, setRegion] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Не мешаем на экранах входа/регистрации
  const onAuthScreen = pathname === '/register' || pathname === '/auth' || pathname.startsWith('/web/login')
  const need = isAuthenticated && user?.isRegistered && !user?.region && !onAuthScreen
  if (!need) return null

  const save = async () => {
    if (!region) { setError('Выбери регион'); return }
    setSaving(true); setError('')
    try { await api.post('/users/region', { region }); await refreshUser() }
    catch (e: any) { setError(e?.response?.data?.message || 'Ошибка'); setSaving(false) }
  }

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(6,6,8,0.96)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 18px', overflowY: 'auto' }}>
        <div style={{ position: 'absolute', top: '26%', left: '50%', transform: 'translate(-50%,-50%)', width: 420, height: 420, background: 'radial-gradient(ellipse, rgba(232,9,46,0.1), transparent 70%)', pointerEvents: 'none' }} />
        <motion.div initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 26 }}
          style={{ position: 'relative', width: '100%', maxWidth: 420, background: 'linear-gradient(180deg, #101016, #0a0a0f)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 24, padding: 22, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ width: 56, height: 56, borderRadius: 17, margin: '0 auto 14px', background: 'linear-gradient(135deg, rgba(232,9,46,0.22), rgba(180,0,30,0.28))', border: '1px solid rgba(232,9,46,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 26px rgba(232,9,46,0.28)' }}>
              <Icon name="globe" size={26} color={ACCENT} />
            </div>
            <h1 style={{ fontSize: 21, fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.4px' }}>Укажи свой регион</h1>
            <p style={{ color: '#6B7280', fontSize: 13, margin: 0, lineHeight: 1.45 }}>Это нужно для подбора по уровню и таблиц лидеров. Без региона продолжить нельзя.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: '46vh', overflowY: 'auto', padding: 2, marginBottom: 16 }}>
            {REGIONS.map(r => {
              const sel = region === r.code
              return (
                <button key={r.code} onClick={() => { setRegion(r.code); setError('') }}
                  style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', background: sel ? 'rgba(232,9,46,0.16)' : 'rgba(255,255,255,0.04)', border: `1px solid ${sel ? ACCENT : 'rgba(255,255,255,0.07)'}`, transition: 'all .15s' }}>
                  <Flag code={r.code} size={18} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: sel ? '#fff' : '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                  {sel && <Icon name="check" size={13} color={ACCENT} style={{ marginLeft: 'auto' }} />}
                </button>
              )
            })}
          </div>

          {error && <div style={{ background: 'rgba(232,9,46,0.08)', border: '1px solid rgba(232,9,46,0.3)', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#F87171', textAlign: 'center', marginBottom: 14 }}>{error}</div>}

          <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving || !region}
            style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: saving || !region ? 'default' : 'pointer', background: saving || !region ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, rgba(232,9,46,0.95), rgba(180,0,30,1))', color: saving || !region ? '#4B5563' : '#fff', fontWeight: 900, fontSize: 15, boxShadow: saving || !region ? 'none' : '0 4px 24px rgba(232,9,46,0.35)' }}>
            {saving ? 'Сохраняем…' : 'Подтвердить регион'}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
