'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { Icon } from '@/components/ui/Icon'
import { MatchCard } from '@/components/ui/MatchCard'

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
      <span style={{ fontSize: 10, color: copied ? '#22C55E' : '#374151', transition: 'color 0.2s', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {copied ? <><Icon name="check" size={11} />Скопировано</> : <><Icon name="copy" size={11} />Копировать ID</>}
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
      const league = searchParams.get('league')
      if (league === 'cpl' || league === 'cplq') params.set('league', league)
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
  const kd     = Number(statsSource?.kdr ?? 0)
  const avg    = Number((statsSource as any)?.avgKills ?? 0)
  const rating = Number((statsSource as any)?.ratingOverall ?? 0)
  const played = statsSource?.matchesPlayed ?? 0
  const displayName = isOwnHistory
    ? (user?.gameNickname || user?.firstName || 'Вы')
    : (targetProfile?.gameNickname || targetProfile?.firstName || `Игрок #${targetUserId}`)
  const GREEN = '#22C55E', YELLOW = '#EAB308', RED = '#EF4444', GREY = '#6B7280'
  const ratingColor = rating > 1.1 ? GREEN : rating >= 0.9 ? YELLOW : RED
  const kdColor = kd > 1.1 ? GREEN : kd >= 0.9 ? YELLOW : RED
  const avgColor = avg > 16 ? GREEN : avg >= 11 ? YELLOW : RED
  const fallbackElo = (statsSource as any)?.elo ?? 1000

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
          <Icon name="chevronLeft" size={18} />
        </button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="barChart" size={16} />История матчей
          </div>
          {!isOwnHistory && (
            <div style={{ fontSize: 11, color: '#4B5563', marginTop: 1 }}>{displayName}</div>
          )}
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Overall stats — new standard */}
        {(isOwnHistory ? !!user : !!targetProfile) && (
          <div style={{ marginBottom: 16 }}>
            {!isOwnHistory && (
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8, fontWeight: 700 }}>{displayName}</div>
            )}
            {/* Wide rating tile */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
              style={{
                position: 'relative', overflow: 'hidden',
                background: `linear-gradient(135deg, ${ratingColor}18, #0f0f15 60%)`,
                border: `1px solid ${ratingColor}40`, borderRadius: 18,
                padding: '16px 18px', marginBottom: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                boxShadow: `0 8px 30px ${ratingColor}14`,
              }}
            >
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: ratingColor }} />
              <div style={{ position: 'absolute', right: -30, top: -30, width: 130, height: 130, background: `radial-gradient(circle, ${ratingColor}22, transparent 70%)`, pointerEvents: 'none' }} />
              <div>
                <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="star" size={13} color={ratingColor} />Рейтинг
                </div>
                <div style={{ fontSize: 38, fontWeight: 900, color: ratingColor, letterSpacing: '-1.5px', lineHeight: 1.05, marginTop: 4 }}>
                  {rating.toFixed(2)}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, textAlign: 'right' }}>
                {played} <span style={{ display: 'block', fontSize: 9, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.08em' }}>матчей</span>
              </div>
            </motion.div>
            {/* K/D + AVG colored tiles */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'K/D', value: kd.toFixed(2), color: kdColor, icon: 'swords' as const },
                { label: 'AVG', value: avg.toFixed(1), color: avgColor, icon: 'skull' as const },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.06 + i * 0.04, type: 'spring', stiffness: 300, damping: 24 }}
                  style={{ background: '#0f0f15', border: `1px solid ${s.color}26`, borderRadius: 14, padding: '12px 8px 10px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}
                >
                  <div style={{ position: 'absolute', top: 0, left: '18%', right: '18%', height: 1, background: `linear-gradient(90deg, transparent, ${s.color}aa, transparent)` }} />
                  <div style={{ marginBottom: 5, display: 'flex', justifyContent: 'center' }}><Icon name={s.icon} size={15} color={s.color} /></div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: s.color, letterSpacing: '-0.5px', lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
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
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Icon name="gamepad" size={40} strokeWidth={1.5} /></div>
            <p>Матчи пока не сыграны</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {items.map((item, i) => (
              <MatchCard key={item.matchId} m={item as any} fallbackElo={fallbackElo} delay={i * 0.03} />
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
