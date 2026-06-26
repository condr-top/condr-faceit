'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'

export type League = 'cpl' | 'cplq'
export const LEAGUE_META: Record<League, { name: string; full: string; g1: string; g2: string }> = {
  cpl:  { name: 'CPL',   full: 'CONDR Pro League',                g1: '#E8092E', g2: '#A855F7' },
  cplq: { name: 'CPL-Q', full: 'CONDR Pro League Qualifications', g1: '#F59E0B', g2: '#EF4444' },
}
const CARD = '#0f0f15'

interface Row { rank: number; points: number; user: { id: number; nickname: string; avatarUrl: string | null; isVerified: boolean } }
interface Board { season: { number: number; startsAt: string; endsAt: string | null } | null; league: League; rows: Row[] }

export function LeagueBoard({ league }: { league: League }) {
  const { user } = useAuthStore()
  const [board, setBoard] = useState<Board | null>(null)
  const [me, setMe] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [b, m] = await Promise.all([api.get(`/cpl/leaderboard?league=${league}`), api.get('/cpl/me')])
      setBoard(b.data); setMe(m.data)
    } catch {} finally { setLoading(false) }
  }, [league])
  useEffect(() => { load() }, [load])

  const m = LEAGUE_META[league]
  const myRow = board?.rows.find(r => r.user.id === user?.id)

  return (
    <div>
      {/* Season + weekly note */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 13px', borderRadius: 12, background: `linear-gradient(135deg, ${m.g1}14, ${CARD})`, border: `1px solid ${m.g1}2e` }}>
        <Icon name="trophy" size={15} color={m.g1} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: '#fff' }}>{board?.season ? `Сезон ${board.season.number} · Season Points` : 'Сезон ещё не начался'}</div>
          <div style={{ fontSize: 10.5, color: '#6B7280', marginTop: 1 }}>Обновляется еженедельно · по понедельникам</div>
        </div>
        {board?.season?.endsAt && <SeasonCountdown to={board.season.endsAt} color={m.g1} />}
      </div>

      {/* Danger */}
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
          <div style={{ fontSize: 22, fontWeight: 900, color: m.g1, minWidth: 40, textAlign: 'center' }}>#{myRow.rank}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Ваше место</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>из {board?.rows.length ?? 0} участников</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>{myRow.points}</div>
            <div style={{ fontSize: 9, color: m.g1, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Points</div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: m.g1 }} />
        </div>
      ) : !board?.season ? (
        <Empty text="Сезон ещё не начался — таблица появится после старта." />
      ) : board.rows.length === 0 ? (
        <Empty text="Очки ещё не начислены. Таблица обновляется еженедельно после лиговых матчей." />
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
                    border: `1px solid ${isMe ? m.g1 + '55' : medal ? medal + '3a' : 'rgba(255,255,255,0.06)'}`, boxShadow: medal ? `0 8px 24px ${medal}12` : 'none' }}>
                  {medal && <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, background: `linear-gradient(90deg, transparent, ${medal}aa, transparent)` }} />}
                  <div style={{ width: 28, flexShrink: 0, textAlign: 'center' }}>
                    {medal ? <div style={{ width: 26, height: 26, margin: '0 auto', borderRadius: 9, background: `${medal}1f`, border: `1px solid ${medal}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: medal, boxShadow: `0 0 12px ${medal}44` }}>{r.rank}</div>
                      : <span style={{ fontSize: 14, fontWeight: 900, color: '#4B5563' }}>{r.rank}</span>}
                  </div>
                  <Avatar avatarUrl={r.user.avatarUrl} name={r.user.nickname} size={38} style={{ border: `1px solid ${medal ? medal + '66' : 'rgba(255,255,255,0.1)'}` }} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: isMe ? m.g1 : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{r.user.nickname}</span>
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

function SeasonCountdown({ to, color }: { to: string; color: string }) {
  const ms = new Date(to).getTime() - Date.now()
  if (ms <= 0) return null
  const days = Math.floor(ms / 86400000)
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 15, fontWeight: 900, color, lineHeight: 1 }}>{days}д</div>
      <div style={{ fontSize: 8.5, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase' }}>до конца</div>
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '44px 24px', color: '#6B7280', borderRadius: 16, background: CARD, border: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="trophy" size={26} color="#374151" /></div>
      <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{text}</div>
    </div>
  )
}
