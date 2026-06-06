'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { REGIONS, countryFlag } from '@/lib/regions'

interface Props { onClose: () => void }

export function RegionPicker({ onClose }: Props) {
  const { user, refreshUser } = useAuthStore()
  const { setHideNav } = useUiStore()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Hide nav + lock body horizontal scroll
  useEffect(() => {
    setHideNav(true)
    document.body.style.overflowX = 'hidden'
    return () => {
      setHideNav(false)
      document.body.style.overflowX = ''
    }
  }, [])

  const cooldownDays = (() => {
    if (!user?.regionUpdatedAt) return 0
    const days = (Date.now() - new Date(user.regionUpdatedAt).getTime()) / 86_400_000
    return Math.max(0, Math.ceil(7 - days))
  })()

  const canChange = cooldownDays === 0

  const select = async (code: string) => {
    if (!canChange) return
    setSaving(true); setError('')
    try {
      await api.post('/users/region', { region: code })
      await refreshUser()
      onClose()
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Ошибка')
    } finally {
      setSaving(false)
    }
  }

  return (
    // Full-screen backdrop — plain div, not motion
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex', alignItems: 'flex-end',
        overflowX: 'hidden', overflowY: 'hidden',
      }}
      onClick={onClose}
    >
      {/* Sheet — slides up */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxHeight: '88vh',
          background: 'rgba(10,10,14,0.98)',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(255,255,255,0.08)',
          borderBottom: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',     // clips children strictly
          touchAction: 'pan-y',  // allow only vertical scroll gesture
        }}
      >
        {/* Handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(255,255,255,0.15)',
          margin: '14px auto 0', flexShrink: 0,
        }} />

        {/* Header */}
        <div style={{
          padding: '14px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#fff', marginBottom: 4 }}>
            Выбор региона
          </div>
          {user?.region ? (
            <div style={{ fontSize: 12, color: '#4B5563' }}>
              Текущий: <b style={{ color: '#fff' }}>
                {countryFlag(user.region)} {REGIONS.find(r => r.code === user.region)?.name ?? user.region}
              </b>
              {!canChange && (
                <span style={{ color: '#F59E0B', marginLeft: 8 }}>
                  · смена через {cooldownDays} дн.
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: '#4B5563' }}>Регион ещё не выбран</div>
          )}
          {error && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>{error}</div>}
        </div>

        {/* Scrollable grid — only this part scrolls vertically */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '12px 16px 40px',
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
        } as React.CSSProperties}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 8,
          }}>
            {REGIONS.map(r => {
              const isActive = user?.region === r.code
              const disabled = !canChange && !isActive
              return (
                <button
                  key={r.code}
                  onClick={() => !disabled && select(r.code)}
                  disabled={saving}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px', borderRadius: 12, border: 'none',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    background: isActive
                      ? 'rgba(232,9,46,0.12)'
                      : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isActive ? 'rgba(232,9,46,0.35)' : 'rgba(255,255,255,0.07)'}` as any,
                    opacity: disabled && !isActive ? 0.4 : 1,
                    textAlign: 'left',
                    minWidth: 0,
                    transition: 'background 0.15s',
                  }}
                >
                  <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>
                    {countryFlag(r.code)}
                  </span>
                  <span style={{
                    fontSize: 13, fontWeight: isActive ? 800 : 600,
                    color: isActive ? '#E8092E' : '#fff',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {r.name}
                  </span>
                  {isActive && (
                    <span style={{ marginLeft: 'auto', fontSize: 14, color: '#E8092E', flexShrink: 0 }}>✓</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </div>
  )
}
