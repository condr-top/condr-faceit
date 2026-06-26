'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Icon } from '@/components/ui/Icon'

interface Tournament {
  id: number
  title: string
  description: string | null
  maxParticipants: number
  entryFee: number
  prizePool: number
  status: string
  startsAt: string | null
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  upcoming:  { label: 'Скоро',    color: '#60A5FA', bg: 'rgba(96,165,250,0.12)',  border: 'rgba(96,165,250,0.3)'  },
  active:    { label: 'Идёт',     color: '#E8092E', bg: 'rgba(232,9,46,0.12)',    border: 'rgba(232,9,46,0.3)'    },
  completed: { label: 'Завершён', color: '#4B5563', bg: 'rgba(75,85,99,0.12)',    border: 'rgba(75,85,99,0.3)'    },
}

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [joining, setJoining] = useState<number | null>(null)
  const { user, refreshUser } = useAuthStore()

  useEffect(() => {
    api.get('/tournaments').then((r) => setTournaments(r.data))
  }, [])

  const register = async (id: number) => {
    setJoining(id)
    try {
      await api.post(`/tournaments/${id}/register`)
      await refreshUser()
      alert('Вы зарегистрированы в турнире!')
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка')
    } finally {
      setJoining(null)
    }
  }

  return (
    <RequireRegistration>
    <div style={{ minHeight: '100vh', background: '#060608', paddingBottom: 88 }}>
      {/* Radial glow */}
      <div style={{
        position: 'fixed', top: -100, left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 300,
        background: 'radial-gradient(ellipse, rgba(232,9,46,0.09) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{ position: 'relative', zIndex: 1, padding: '0 16px' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          style={{ paddingTop: 20, paddingBottom: 16 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="bolt" size={22} color="#EAB308" />
            <h1 style={{ fontSize: 20, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.3px' }}>Турниры</h1>
          </div>
        </motion.div>

        {/* Section label */}
        <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Доступные турниры
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {tournaments.map((t, i) => {
            const st = statusConfig[t.status] || { label: t.status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.2)' }
            const isActive = t.status === 'active'

            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06, type: 'spring', stiffness: 300, damping: 24 }}
                style={{
                  borderRadius: 14, overflow: 'hidden',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  position: 'relative',
                }}
              >
                {/* Gradient header bar */}
                <div style={{
                  padding: '14px 14px 12px',
                  background: isActive
                    ? 'linear-gradient(135deg, rgba(232,9,46,0.12) 0%, rgba(255,255,255,0.02) 100%)'
                    : 'linear-gradient(135deg, rgba(96,165,250,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                  borderBottom: '1px solid rgba(255,255,255,0.05)',
                  display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                }}>
                  {/* Top glow strip */}
                  <div style={{
                    position: 'absolute', top: 0, left: '10%', right: '10%', height: 1,
                    background: `linear-gradient(90deg, transparent, ${st.color}55, transparent)`,
                  }} />
                  <div style={{ flex: 1 }}>
                    <h2 style={{ fontWeight: 800, fontSize: 15, color: '#fff', margin: '0 0 4px' }}>{t.title}</h2>
                    {t.description && (
                      <p style={{ fontSize: 12, color: '#4B5563', margin: 0, lineHeight: 1.4 }}>{t.description}</p>
                    )}
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800, padding: '3px 10px', borderRadius: 20, flexShrink: 0, marginLeft: 10,
                    background: st.bg, color: st.color, border: `1px solid ${st.border}`,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {st.label}
                  </span>
                </div>

                <div style={{ padding: '12px 14px' }}>
                  {/* Stats grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 12, textAlign: 'center' }}>
                    <div style={{
                      background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 4px',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{t.maxParticipants}</div>
                      <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>Игроков</div>
                    </div>
                    <div style={{
                      background: 'rgba(234,179,8,0.06)', borderRadius: 10, padding: '8px 4px',
                      border: '1px solid rgba(234,179,8,0.15)',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#EAB308', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        {t.entryFee > 0 ? <><Icon name="coins" size={13} />{t.entryFee}</> : 'FREE'}
                      </div>
                      <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>Взнос</div>
                    </div>
                    <div style={{
                      background: 'rgba(34,197,94,0.06)', borderRadius: 10, padding: '8px 4px',
                      border: '1px solid rgba(34,197,94,0.15)',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#22C55E', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}><Icon name="coins" size={13} />{t.prizePool}</div>
                      <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>Призовой</div>
                    </div>
                  </div>

                  {t.startsAt && (
                    <p style={{ fontSize: 11, color: '#4B5563', marginBottom: 10, marginTop: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="timer" size={12} />Начало: {new Date(t.startsAt).toLocaleString('ru-RU')}
                    </p>
                  )}

                  {t.status === 'upcoming' && (
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => register(t.id)}
                      disabled={joining === t.id}
                      style={{
                        width: '100%', padding: '11px 0', borderRadius: 12,
                        border: 'none', cursor: joining === t.id ? 'default' : 'pointer',
                        background: joining === t.id
                          ? 'rgba(255,255,255,0.06)'
                          : 'linear-gradient(135deg, rgba(232,9,46,0.9), rgba(180,0,30,0.95))',
                        color: joining === t.id ? '#4B5563' : '#fff',
                        fontWeight: 800, fontSize: 14,
                        boxShadow: joining === t.id ? 'none' : '0 2px 16px rgba(232,9,46,0.3)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {joining === t.id ? '...' : 'Зарегистрироваться'}
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )
          })}
        </div>

        {!tournaments.length && (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: '60px 0' }}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Icon name="bolt" size={40} /></div>
            <p>Нет активных турниров</p>
          </div>
        )}
      </div>
    </div>
    </RequireRegistration>
  )
}
