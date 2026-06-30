'use client'

import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { EloRing } from '@/components/ui/EloRing'

const GREEN = '#22C55E', YELLOW = '#EAB308', RED = '#EF4444', GREY = '#6B7280'

const mapFile = (m: string) => m.charAt(0) + m.slice(1).toLowerCase()

export interface MatchItem {
  matchId: number
  map: string | null
  result: 'win' | 'loss' | 'draw' | null
  scoreMy?: number
  scoreOpp?: number
  eloChange: number
  eloAfter?: number
  kills: number
  deaths: number
  assists: number
  ratingMatch: number
  kdSubmitted: boolean
  createdAt: string
  calibration?: boolean
}

/** Единая карточка матча — используется в профиле, истории и у других игроков. */
export function MatchCard({ m, fallbackElo, delay = 0 }: { m: MatchItem; fallbackElo: number; delay?: number }) {
  const router = useRouter()
  const clickable = m.kdSubmitted
  const resColor = m.result === 'win' ? GREEN : m.result === 'loss' ? '#E8092E' : GREY
  const badge = m.result === 'win' ? { t: 'W', c: GREEN } : m.result === 'loss' ? { t: 'П', c: '#E8092E' } : { t: 'Н', c: GREY }
  const orbElo = (m.eloAfter ?? 0) > 0 ? (m.eloAfter as number) : fallbackElo
  const dlt = Number(m.eloChange ?? 0)
  const rm = Number(m.ratingMatch ?? 0)
  const rmColor = rm > 1.1 ? GREEN : rm >= 0.9 ? YELLOW : RED
  const dateStr = new Date(m.createdAt).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')
  const mapName = m.map ? mapFile(m.map) : null
  const mapUrl = m.map ? `/maps/${mapFile(m.map)}.webp` : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 300, damping: 24 }}
      whileTap={clickable ? { scale: 0.985 } : undefined}
      onClick={clickable ? () => router.push(`/match-stats/${m.matchId}`) : undefined}
      style={{
        position: 'relative', overflow: 'hidden', borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.07)',
        background: '#0c0c11',
        cursor: clickable ? 'pointer' : 'default',
        boxShadow: '0 6px 22px rgba(0,0,0,0.35)',
        backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
      }}
    >
      {/* ── Map background ── */}
      {mapUrl && (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${mapUrl})`, backgroundSize: 'cover', backgroundPosition: 'center 35%' }} />
      )}
      {/* Legibility overlay — dark on the left/bottom (text), map revealed top-right */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(102deg, rgba(10,10,14,0.97) 0%, rgba(10,10,14,0.86) 48%, rgba(10,10,14,0.52) 78%, rgba(10,10,14,0.34) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(0deg, rgba(10,10,14,0.94) 0%, rgba(10,10,14,0.42) 42%, transparent 66%)' }} />
      {/* Result accent — left bar + corner glow */}
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: 4, background: resColor, boxShadow: `0 0 18px ${resColor}` }} />
      <div style={{ position: 'absolute', top: -24, left: -24, width: 130, height: 130, background: `radial-gradient(circle, ${resColor}2e, transparent 70%)`, pointerEvents: 'none' }} />

      {/* ── Content ── */}
      <div style={{ position: 'relative', zIndex: 1, padding: '12px 14px 12px 16px' }}>
        {/* Date + map name */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: '#cbd5e1', fontWeight: 700, textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>{dateStr}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {mapName && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: resColor, boxShadow: `0 0 6px ${resColor}` }} />
                {mapName}
              </span>
            )}
            {clickable && <Icon name="chevronRight" size={14} color="rgba(255,255,255,0.5)" />}
          </div>
        </div>

        {/* Score */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 9 }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: `linear-gradient(135deg, ${badge.c}, ${badge.c}cc)`, color: '#fff', fontWeight: 900, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 3px 12px ${badge.c}66` }}>{badge.t}</span>
          <span style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.5px', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
            <span style={{ color: resColor }}>{m.scoreMy ?? 0}</span>
            <span style={{ color: '#4b5563', margin: '0 6px' }}>:</span>
            <span style={{ color: '#9ca3af' }}>{m.scoreOpp ?? 0}</span>
          </span>
        </div>

        {/* Rank orb + ELO + delta (для калибровочных матчей ELO скрыт → «?») */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EloRing elo={orbElo} size={32} showLabel={false} calibrating={!!m.calibration} />

          {m.calibration ? (
            <span style={{ color: YELLOW, fontWeight: 800, fontSize: 13, letterSpacing: '0.02em', textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>Калибровка</span>
          ) : (
            <>
              {(m.eloAfter ?? 0) > 0 && (
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px', textShadow: '0 1px 5px rgba(0,0,0,0.8)' }}>{(m.eloAfter as number).toLocaleString('ru-RU')}</span>
              )}
              {m.kdSubmitted && dlt !== 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: dlt > 0 ? GREEN : RED, fontWeight: 800, fontSize: 13, textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
                  <span style={{
                    width: 0, height: 0,
                    borderLeft: '4px solid transparent', borderRight: '4px solid transparent',
                    ...(dlt > 0 ? { borderBottom: `6px solid ${GREEN}` } : { borderTop: `6px solid ${RED}` }),
                  }} />
                  {Math.abs(dlt)}
                </span>
              )}
            </>
          )}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', margin: '11px 0' }} />

        {/* Rating + K/A/D */}
        {m.kdSubmitted ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: rmColor, background: `${rmColor}26`, border: `1px solid ${rmColor}55`, padding: '4px 12px', borderRadius: 9, letterSpacing: '-0.3px', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}>{rm.toFixed(2)}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '0.3px', textShadow: '0 1px 5px rgba(0,0,0,0.8)' }}>
              {m.kills ?? 0} <span style={{ color: '#6b7280' }}>/</span> {m.assists ?? 0} <span style={{ color: '#6b7280' }}>/</span> {m.deaths ?? 0}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 6, textShadow: '0 1px 4px rgba(0,0,0,0.7)' }}>
            <Icon name="hourglass" size={12} />Статистика ожидает подтверждения
          </div>
        )}
      </div>
    </motion.div>
  )
}
