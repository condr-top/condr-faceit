'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'

type League = 'cpl' | 'cplq'
const META: Record<League, { name: string; full: string; g1: string; g2: string }> = {
  cpl:  { name: 'CPL',   full: 'CONDR Pro League',                g1: '#E8092E', g2: '#A855F7' },
  cplq: { name: 'CPL-Q', full: 'CONDR Pro League Qualifications', g1: '#F59E0B', g2: '#EF4444' },
}
const CARD = '#0f0f15'

interface Row { rank: number; points: number; user: { id: number; nickname: string; avatarUrl: string | null; isVerified: boolean } }
interface Board { season: { number: number; startsAt: string; endsAt: string | null } | null; league: League; rows: Row[] }

export default function CplPage() {
  return <RequireRegistration><Inner /></RequireRegistration>
}

function Inner() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [league, setLeague] = useState<League>('cplq')
  const [board, setBoard] = useState<Board | null>(null)
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (lg: League) => {
    setLoading(true)
    try {
      const [b, m] = await Promise.all([api.get(`/cpl/leaderboard?league=${lg}`), api.get('/cpl/me')])
      setBoard(b.data); setMe(m.data)
    } catch {} finally { setLoading(false) }
  }, [])

  useEffect(() => { load(league) }, [league, load])

  const m = META[league]
  const myRow = board?.rows.find(r => r.user.id === user?.id)

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
      <button onClick={() => router.push('/dashboard')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}>
        <Icon name="chevronLeft" size={18} color="#9CA3AF" /> Назад
      </button>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, background: `linear-gradient(135deg, ${m.g1}, ${m.g2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 22px ${m.g1}55` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)' }} />
          <Icon name="trophy" size={23} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{m.full}</h1>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
            {board?.season ? `Сезон ${board.season.number} · сезонная таблица` : 'Сезон ещё не начался'}
          </div>
        </div>
      </motion.div>

      {/* League tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 14, border: '1px solid rgba(255,255,255,0.05)' }}>
        {(['cplq', 'cpl'] as League[]).map(lg => (
          <button key={lg} onClick={() => setLeague(lg)} style={{ flex: 1, position: 'relative', padding: '9px 0', border: 'none', cursor: 'pointer', background: 'none', borderRadius: 10, fontSize: 13, fontWeight: 800, color: league === lg ? '#fff' : '#6B7280' }}>
            {league === lg && <motion.div layoutId="cplLgTab" style={{ position: 'absolute', inset: 0, borderRadius: 10, background: `linear-gradient(135deg, ${META[lg].g1}cc, ${META[lg].g2}cc)`, zIndex: -1, boxShadow: `0 4px 14px ${META[lg].g1}44` }} />}
            {META[lg].name}
          </button>
        ))}
      </div>

      {/* Danger warning */}
      {league === 'cplq' && me?.cplqDanger && (
        <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
          style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 14, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="warning" size={18} color="#EF4444" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#EF4444' }}>Danger Zone</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>Вы в зоне риска вылета. Играйте активнее на этой неделе.</div>
          </div>
        </motion.div>
      )}

      {/* My standing */}
      {myRow && (
        <div style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 14, background: `linear-gradient(135deg, ${m.g1}1f, ${CARD})`, border: `1px solid ${m.g1}44`, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: m.g1, minWidth: 36, textAlign: 'center' }}>#{myRow.rank}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Ваше место</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>из {board?.rows.length ?? 0} участников</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{myRow.points}</div>
            <div style={{ fontSize: 9, color: m.g1, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Season Points</div>
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: m.g1 }} />
        </div>
      ) : !board?.season ? (
        <Empty text="Сезон ещё не начался — таблица появится после старта." />
      ) : board.rows.length === 0 ? (
        <Empty text="Очки ещё не начислены. Сыграйте лиговые матчи — таблица обновляется еженедельно." />
      ) : (
        <AnimatePresence mode="wait">
          <motion.div key={league} initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {board.rows.map((r, i) => {
              const medal = r.rank === 1 ? '#FFD700' : r.rank === 2 ? '#E2E8F0' : r.rank === 3 ? '#F97316' : null
              const isMe = r.user.id === user?.id
              return (
                <motion.div key={r.user.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', borderRadius: 14, position: 'relative', overflow: 'hidden',
                    background: isMe ? `linear-gradient(135deg, ${m.g1}1a, ${CARD})` : medal ? `linear-gradient(135deg, ${medal}12, ${CARD})` : CARD,
                    border: `1px solid ${isMe ? m.g1 + '55' : medal ? medal + '3a' : 'rgba(255,255,255,0.06)'}` }}>
                  <div style={{ width: 28, flexShrink: 0, textAlign: 'center' }}>
                    {medal ? <div style={{ width: 26, height: 26, margin: '0 auto', borderRadius: 9, background: `${medal}1f`, border: `1px solid ${medal}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: medal }}>{r.rank}</div>
                      : <span style={{ fontSize: 14, fontWeight: 900, color: '#4B5563' }}>{r.rank}</span>}
                  </div>
                  <Avatar avatarUrl={r.user.avatarUrl} name={r.user.nickname} size={38} style={{ border: `1px solid ${medal ? medal + '66' : 'rgba(255,255,255,0.1)'}` }} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isMe ? m.g1 : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{r.user.nickname}</span>
                    {r.user.isVerified && <Icon name="verified" size={13} color="#60A5FA" />}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: medal || '#fff' }}>{r.points}</div>
                    <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>pts</div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '46px 24px', color: '#6B7280', borderRadius: 16, background: CARD, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="trophy" size={26} color="#374151" /></div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{text}</div>
    </div>
  )
}
