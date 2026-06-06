'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

interface MatchHistoryItem {
  matchId: number
  map: string | null
  status: string
  winner: string | null
  result: 'win' | 'loss' | 'draw' | null
  team: 'A' | 'B'
  totalRounds: number
  createdAt: string
  eloChange: number
  kills: number
  deaths: number
  assists: number
  kdMatch: number
  kprMatch: number
  aprMatch: number
  srMatch: number
  ratingMatch: number
  kdSubmitted: boolean
}

interface HistoryResponse {
  matches: MatchHistoryItem[]
  total: number
  page: number
  limit: number
}

interface PublicStats {
  id: number
  gameNickname: string | null
  firstName: string
  kdr: number
  avgKills: number
  ratingOverall: number
  matchesPlayed: number
}

function MatchIdRow({ matchId }: { matchId: number }) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(String(matchId)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={copy}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 11, color: '#374151' }}>Матч #{matchId}</span>
      <span style={{ fontSize: 10, color: copied ? '#22C55E' : '#374151', transition: 'color 0.2s' }}>
        {copied ? '✓ Скопировано' : '⎘ Копировать ID'}
      </span>
    </button>
  )
}

export default function HistoryPage() {
  const { user } = useAuthStore()
  const router = useRouter()
  const searchParams = useSearchParams()
  const targetUserId = searchParams.get('userId') ? Number(searchParams.get('userId')) : null
  const isOwnHistory = !targetUserId || targetUserId === user?.id

  const [items, setItems] = useState<MatchHistoryItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [targetProfile, setTargetProfile] = useState<PublicStats | null>(null)
  const limit = 10

  useEffect(() => {
    if (!isOwnHistory && targetUserId) {
      api.get(`/users/${targetUserId}/public`)
        .then(r => setTargetProfile(r.data))
        .catch(() => {})
    }
  }, [targetUserId])

  useEffect(() => {
    setPage(1)
    fetchHistory(1)
  }, [targetUserId])

  useEffect(() => {
    fetchHistory(page)
  }, [page])

  const fetchHistory = async (p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(p), limit: String(limit) })
      if (targetUserId) params.set('userId', String(targetUserId))
      const res = await api.get<HistoryResponse>(`/matches/history?${params}`)
      setItems(res.data.matches)
      setTotal(res.data.total)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  const totalPages = Math.ceil(total / limit)

  const resultBorderColor = (r: string | null) => {
    if (r === 'win') return '#22C55E'
    if (r === 'loss') return '#E8092E'
    return '#4B5563'
  }
  const resultTextColor = (r: string | null) => {
    if (r === 'win') return '#22C55E'
    if (r === 'loss') return '#F87171'
    return '#9CA3AF'
  }
  const resultLabel = (r: string | null) => {
    if (r === 'win') return 'Победа'
    if (r === 'loss') return 'Поражение'
    if (r === 'draw') return 'Ничья'
    return '—'
  }
  const eloColor = (n: number) =>
    n > 0 ? '#22C55E' : n < 0 ? '#F87171' : '#9CA3AF'

  const statsSource = isOwnHistory ? user : targetProfile
  const kd     = statsSource?.kdr ?? 0
  const avg    = (statsSource as any)?.avgKills ?? 0
  const rating = (statsSource as any)?.ratingOverall ?? 0
  const played = statsSource?.matchesPlayed ?? 0
  const displayName = isOwnHistory
    ? (user?.gameNickname || user?.firstName || 'Вы')
    : (targetProfile?.gameNickname || targetProfile?.firstName || `Игрок #${targetUserId}`)

  return (
    <div style={{ minHeight: '100vh', background: '#060608', paddingBottom: 88, color: '#fff' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(6,6,8,0.95)', backdropFilter: 'blur(12px)',
        padding: '16px 16px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#9CA3AF', fontSize: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          ←
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
            📊 История матчей
          </div>
          {!isOwnHistory && (
            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1 }}>{displayName}</div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Overall stats card */}
        {(isOwnHistory ? !!user : !!targetProfile) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14, padding: '14px', marginBottom: 16,
            }}
          >
            {!isOwnHistory && (
              <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 4, fontWeight: 700 }}>{displayName}</div>
            )}
            <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
              Общая статистика
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center' }}>
              {[
                { label: 'Матчей', value: played, color: '#fff' },
                { label: 'K/D', value: kd, color: '#EAB308' },
                { label: 'AVG', value: avg, color: '#60A5FA' },
                { label: 'Rating', value: rating, color: '#A855F7' },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontSize: 11, color: '#4B5563', marginBottom: 3 }}>{s.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Match list */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.1)',
              borderTop: '2px solid #E8092E',
              animation: 'spin 0.8s linear infinite',
            }} />
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#4B5563', padding: '60px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎮</div>
            <p>Матчи пока не сыграны</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, i) => (
              <motion.div
                key={item.matchId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 24 }}
                style={{
                  borderRadius: 14,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderLeft: `3px solid ${resultBorderColor(item.result)}`,
                  overflow: 'hidden',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px 8px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: resultTextColor(item.result) }}>
                      {resultLabel(item.result)}
                    </span>
                    {item.map && (
                      <span style={{ fontSize: 11, color: '#4B5563', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: 20 }}>
                        {item.map}
                      </span>
                    )}
                    {(item.totalRounds ?? 0) > 0 && (
                      <span style={{ fontSize: 11, color: '#374151' }}>{item.totalRounds} раундов</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.kdSubmitted && (item.eloChange ?? 0) !== 0 && (
                      <span style={{ fontSize: 12, fontWeight: 700, color: eloColor(item.eloChange) }}>
                        {(item.eloChange ?? 0) > 0 ? '+' : ''}{item.eloChange} ELO
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: '#374151' }}>
                      {new Date(item.createdAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </span>
                  </div>
                </div>

                {/* Match ID row */}
                <MatchIdRow matchId={item.matchId} />

                {/* Stats row */}
                {item.kdSubmitted ? (
                  <>
                    <div style={{ padding: '10px 14px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, textAlign: 'center' }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 3 }}>K / A / D</div>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>
                          <span style={{ color: '#22C55E' }}>{item.kills ?? 0}</span>
                          <span style={{ color: '#374151' }}> / </span>
                          <span style={{ color: '#A855F7' }}>{item.assists ?? 0}</span>
                          <span style={{ color: '#374151' }}> / </span>
                          <span style={{ color: '#F87171' }}>{item.deaths ?? 0}</span>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 3 }}>KD</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#EAB308' }}>{(item.kdMatch ?? 0).toFixed(2)}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 3 }}>KPR / APR</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#60A5FA' }}>
                          {(item.kprMatch ?? 0).toFixed(2)} / {(item.aprMatch ?? 0).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#4B5563', marginBottom: 3 }}>Rating</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#A855F7' }}>{(item.ratingMatch ?? 0).toFixed(2)}</div>
                      </div>
                    </div>

                    {/* SR bar */}
                    <div style={{ padding: '0 14px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: '#374151' }}>SR:</span>
                        <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: 6, height: 5, overflow: 'hidden' }}>
                          <div
                            style={{
                              height: '100%',
                              background: 'linear-gradient(90deg, #6366f1, #A855F7)',
                              borderRadius: 6,
                              width: `${Math.max(0, Math.min(100, (item.srMatch ?? 0) * 100))}%`,
                              transition: 'width 0.5s ease',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: 10, color: '#9CA3AF' }}>{((item.srMatch ?? 0) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: '12px 14px', textAlign: 'center', fontSize: 12, color: '#4B5563' }}>
                    ⏳ Статистика ожидает подтверждения модератора
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingTop: 16, paddingBottom: 8 }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#9CA3AF', fontSize: 13, cursor: 'pointer',
                opacity: page === 1 ? 0.3 : 1,
              }}
            >
              ←
            </button>
            <span style={{ padding: '8px 14px', fontSize: 13, color: '#4B5563' }}>
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              style={{
                padding: '8px 14px', borderRadius: 10,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: '#9CA3AF', fontSize: 13, cursor: 'pointer',
                opacity: page === totalPages ? 0.3 : 1,
              }}
            >
              →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
