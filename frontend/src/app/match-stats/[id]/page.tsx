'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { Avatar } from '@/components/ui/Avatar'
import { Flag } from '@/components/ui/Flag'
import { Icon } from '@/components/ui/Icon'
import { EloRing } from '@/components/ui/EloRing'

const GREEN = '#22C55E', YELLOW = '#EAB308', RED = '#EF4444', GREY = '#6B7280'
const BLUE = '#60A5FA', REDT = '#F87171'

const mapImg = (name: string) =>
  `/maps/${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()}.webp`

const ratingColor = (v: number) => (v > 1.1 ? GREEN : v >= 0.9 ? YELLOW : RED)

interface SPlayer {
  userId: number; nickname: string; avatarUrl: string | null
  elo: number; region: string | null; isVerified: boolean; isAdmin: boolean
  kills: number; deaths: number; assists: number
  kdMatch: number; ratingMatch: number; eloChange: number
  calibration?: boolean
}
interface Summary {
  id: number; map: string | null; winnerTeam: string
  scoreA: number; scoreB: number; totalRounds: number
  isDisputed: boolean; kdSubmitted: boolean
  teamASide: string | null; teamBSide: string | null
  createdAt: string; mvpUserId: number | null
  teamA: SPlayer[]; teamB: SPlayer[]
}

// ── Player row ─────────────────────────────────────────────────────────────────
function PlayerRow({ p, accent, isMvp, delay, onClick }: { p: SPlayer; accent: string; isMvp: boolean; delay: number; onClick: () => void }) {
  const rc = ratingColor(p.ratingMatch)
  return (
    <motion.button
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 11px', borderRadius: 13, cursor: 'pointer', textAlign: 'left',
        background: isMvp ? 'linear-gradient(135deg, rgba(234,179,8,0.14), rgba(255,255,255,0.02))' : 'rgba(255,255,255,0.03)',
        border: isMvp ? '1px solid rgba(234,179,8,0.4)' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <EloRing elo={p.elo} size={32} showLabel={false} calibrating={!!p.calibration} />
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <Avatar avatarUrl={p.avatarUrl} name={p.nickname} size={34} style={{ borderRadius: '50%', border: `1.5px solid ${accent}40` }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {p.region && <Flag code={p.region} size={11} />}
          <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.nickname}</span>
          {p.isVerified && <Icon name="verified" size={13} style={{ flexShrink: 0 }} />}
          {isMvp && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 8, fontWeight: 900, color: '#000', background: '#EAB308', padding: '1px 5px', borderRadius: 6, flexShrink: 0 }}>
              <Icon name="crown" size={9} color="#000" />MVP
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: '#6B7280', fontWeight: 600, marginTop: 1 }}>
          KD <b style={{ color: '#9CA3AF' }}>{p.kdMatch.toFixed(2)}</b>
          {p.calibration ? (
            <span style={{ color: YELLOW, marginLeft: 6, fontWeight: 900 }}>?</span>
          ) : p.eloChange !== 0 && (
            <span style={{ color: p.eloChange > 0 ? GREEN : RED, marginLeft: 6, fontWeight: 700 }}>
              {p.eloChange > 0 ? '+' : ''}{p.eloChange}
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
        <div style={{ minWidth: 54, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: rc, background: `${rc}18`, border: `1px solid ${rc}33`, borderRadius: 8, letterSpacing: '-0.3px', lineHeight: 1 }}>
          {p.ratingMatch.toFixed(2)}
        </div>
        <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 700, marginTop: 4, letterSpacing: '0.3px' }}>
          {p.kills} <span style={{ color: '#374151' }}>/</span> {p.assists} <span style={{ color: '#374151' }}>/</span> {p.deaths}
        </div>
      </div>
    </motion.button>
  )
}

export default function MatchStatsPage() {
  const { id } = useParams()
  const router = useRouter()
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/matches/${id}/summary`)
      .then(r => setData(r.data))
      .catch(() => router.replace('/dashboard'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid #E8092E', animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }
  if (!data) return null

  const aWon = data.winnerTeam === 'A'
  const bWon = data.winnerTeam === 'B'
  const draw = data.winnerTeam === 'draw'
  const sortByRating = (arr: SPlayer[]) => [...arr].sort((a, b) => b.ratingMatch - a.ratingMatch)
  const teamA = sortByRating(data.teamA)
  const teamB = sortByRating(data.teamB)
  const dateStr = new Date(data.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })

  const goPlayer = (uid: number) => router.push(`/player/${uid}`)

  const TeamBlock = ({ title, players, side, score, won, accent, delayBase }: {
    title: string; players: SPlayer[]; side: string | null; score: number; won: boolean; accent: string; delayBase: number
  }) => (
    <div style={{
      background: '#0f0f15', borderRadius: 18, padding: 12,
      border: `1px solid ${won ? accent + '40' : 'rgba(255,255,255,0.06)'}`,
      boxShadow: won ? `0 8px 26px ${accent}14` : 'none', marginBottom: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, padding: '0 2px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 900, color: accent, letterSpacing: '0.02em' }}>{title}</span>
          {side && (
            <span style={{ fontSize: 9, fontWeight: 800, color: side === 'T' ? '#EAB308' : '#60A5FA', background: side === 'T' ? 'rgba(234,179,8,0.14)' : 'rgba(96,165,250,0.14)', border: `1px solid ${side === 'T' ? 'rgba(234,179,8,0.3)' : 'rgba(96,165,250,0.3)'}`, padding: '1px 7px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              {side === 'T' ? <><Icon name="terrorist" size={9} />T</> : <><Icon name="shield" size={9} />CT</>}
            </span>
          )}
          {won && <span style={{ fontSize: 9, fontWeight: 900, color: '#000', background: accent, padding: '1px 7px', borderRadius: 6 }}>ПОБЕДА</span>}
        </div>
        <span style={{ fontSize: 22, fontWeight: 900, color: accent, letterSpacing: '-1px' }}>{score}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {players.map((p, i) => (
          <PlayerRow key={p.userId} p={p} accent={accent} isMvp={data.mvpUserId === p.userId} delay={delayBase + i * 0.04} onClick={() => goPlayer(p.userId)} />
        ))}
      </div>
    </div>
  )

  const mvp = data.mvpUserId
    ? [...data.teamA, ...data.teamB].find(p => p.userId === data.mvpUserId)
    : null

  return (
    <div style={{ minHeight: '100vh', background: '#060608', paddingBottom: 96, color: '#fff' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(6,6,8,0.9)', backdropFilter: 'blur(12px)',
        padding: '14px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => router.back()} style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', color: '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chevronLeft" size={18} />
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 7 }}>
          <Icon name="barChart" size={16} />Статистика матча
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* ── SCORE HERO with map ── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', marginBottom: 14, minHeight: 168, border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {data.map && (
            <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${mapImg(data.map)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.32) saturate(1.05)' }} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,6,8,0.45) 0%, rgba(6,6,8,0.2) 45%, rgba(6,6,8,0.92) 100%)' }} />

          <div style={{ position: 'relative', padding: '14px 16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{dateStr}</span>
              {data.map && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: 'rgba(255,255,255,0.12)', padding: '3px 11px', borderRadius: 20, letterSpacing: '0.05em' }}>{data.map}</span>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, marginTop: 24 }}>
              <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1, color: aWon ? BLUE : '#E5E7EB', textShadow: aWon ? `0 2px 24px ${BLUE}66` : 'none' }}>{data.scoreA}</span>
              <span style={{ fontSize: 30, fontWeight: 900, color: '#4B5563' }}>:</span>
              <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-3px', lineHeight: 1, color: bWon ? REDT : '#E5E7EB', textShadow: bWon ? `0 2px 24px ${REDT}66` : 'none' }}>{data.scoreB}</span>
            </div>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <span style={{
                fontSize: 12, fontWeight: 800, padding: '4px 14px', borderRadius: 20,
                color: draw ? GREY : (aWon ? BLUE : REDT),
                background: draw ? 'rgba(107,114,128,0.15)' : `${aWon ? BLUE : REDT}1c`,
                border: `1px solid ${draw ? 'rgba(107,114,128,0.3)' : (aWon ? BLUE : REDT) + '44'}`,
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
                {draw ? <><Icon name="handshake" size={13} />Ничья</> : <><Icon name="trophy" size={13} />Победа команды {aWon ? 'A' : 'B'}</>}
                {data.totalRounds > 0 && <span style={{ color: '#6B7280', fontWeight: 600 }}>· {data.totalRounds} раундов</span>}
              </span>
            </div>
          </div>
        </motion.div>

        {/* ── MVP ── */}
        {mvp && (
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 280, damping: 22 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => goPlayer(mvp.userId)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', textAlign: 'left',
              background: 'linear-gradient(135deg, rgba(234,179,8,0.18), rgba(202,138,4,0.06))',
              border: '1px solid rgba(234,179,8,0.4)', borderRadius: 18, padding: '12px 16px', marginBottom: 14,
              position: 'relative', overflow: 'hidden', boxShadow: '0 8px 26px rgba(234,179,8,0.12)',
            }}
          >
            <div style={{ position: 'absolute', right: -20, top: -20, width: 120, height: 120, background: 'radial-gradient(circle, rgba(234,179,8,0.25), transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative' }}>
              <Avatar avatarUrl={mvp.avatarUrl} name={mvp.nickname} size={52} style={{ borderRadius: '50%', border: '2px solid #EAB308' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
              <div style={{ fontSize: 9, color: '#EAB308', fontWeight: 900, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 2 }}>MVP матча</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                {mvp.region && <Flag code={mvp.region} size={13} />}
                <span style={{ fontSize: 17, fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mvp.nickname}</span>
                {mvp.isVerified && <Icon name="verified" size={15} style={{ flexShrink: 0 }} />}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginTop: 1 }}>
                {mvp.kills} / {mvp.assists} / {mvp.deaths} · KD {mvp.kdMatch.toFixed(2)}
              </div>
            </div>
            <div style={{ textAlign: 'center', position: 'relative', flexShrink: 0 }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#EAB308', letterSpacing: '-1px', lineHeight: 1 }}>{mvp.ratingMatch.toFixed(2)}</div>
              <div style={{ fontSize: 8, color: '#9CA3AF', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>Рейтинг</div>
            </div>
          </motion.button>
        )}

        {/* ── TEAMS ── */}
        <TeamBlock title="КОМАНДА A" players={teamA} side={data.teamASide} score={data.scoreA} won={aWon} accent={BLUE} delayBase={0.14} />
        <TeamBlock title="КОМАНДА B" players={teamB} side={data.teamBSide} score={data.scoreB} won={bWon} accent={REDT} delayBase={0.22} />
      </div>
    </div>
  )
}
