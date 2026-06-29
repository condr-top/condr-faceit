'use client'

import { motion } from 'framer-motion'
import { getEloRank } from '@/lib/eloRank'
import { Icon } from '@/components/ui/Icon'

export interface ObsStats {
  nickname: string
  avatarUrl?: string | null
  isVerified?: boolean
  elo: number
  rating: number
  kd: number
  matchesPlayed: number
  calibrating: boolean
  calibrationPlayed: number
  calibrationTotal: number
  form: string[] // ['W','L','D'...] хронологически
}

const FORM_META: Record<string, { c: string; bg: string }> = {
  W: { c: '#22C55E', bg: 'rgba(34,197,94,0.18)' },
  L: { c: '#EF4444', bg: 'rgba(239,68,68,0.18)' },
  D: { c: '#9CA3AF', bg: 'rgba(156,163,175,0.16)' },
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 70 }}>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 2px 14px ${color}55` }}>{value}</div>
      <div style={{ fontSize: 9.5, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>
    </div>
  )
}

/**
 * Виджет статистики для OBS / стрима. Прозрачный внешний фон — рисуется только
 * стеклянная карточка. Используется и на публичной странице /obs/[token], и в превью настроек.
 */
export function StreamerWidget({ stats }: { stats: ObsStats }) {
  const rank = getEloRank(stats.elo)
  const accent = rank.color
  const rankImg = `/ranks/${rank.level}.jpg?v=1`
  const calPct = Math.round((stats.calibrationPlayed / stats.calibrationTotal) * 100)

  return (
    <div style={{
      position: 'relative', width: 600, borderRadius: 22, overflow: 'hidden',
      background: `radial-gradient(140% 140% at 0% 0%, ${accent}24, transparent 52%), linear-gradient(150deg, rgba(18,18,24,0.96), rgba(8,8,11,0.97))`,
      border: `1px solid ${accent}40`, boxShadow: `0 18px 50px rgba(0,0,0,0.5), 0 0 40px ${accent}1f`,
      padding: 18, fontFamily: 'inherit',
    }}>
      {/* breathing accent halo */}
      <motion.div aria-hidden animate={{ opacity: [0.5, 0.85, 0.5] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: -60, left: -40, width: 260, height: 260, borderRadius: '50%', background: `radial-gradient(circle, ${accent}33, transparent 70%)`, pointerEvents: 'none' }} />
      {/* top hairline */}
      <div style={{ position: 'absolute', top: 0, left: '14%', right: '14%', height: 1, background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      {/* dotted texture */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px', WebkitMaskImage: 'radial-gradient(120% 120% at 100% 0%, #000 20%, transparent 70%)' }} />

      {/* Header: avatar + nickname + rank badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', marginBottom: 14 }}>
        <div style={{ position: 'relative', width: 52, height: 52, borderRadius: 14, flexShrink: 0, overflow: 'hidden', border: `2px solid ${accent}`, boxShadow: `0 0 18px ${accent}55` }}>
          {stats.avatarUrl
            ? <img src={stats.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${accent}, ${accent}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#fff' }}>{(stats.nickname || '?').charAt(0).toUpperCase()}</div>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>{stats.nickname}</span>
            {stats.isVerified && <Icon name="verified" size={17} color="#3B82F6" />}
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4, padding: '3px 9px 3px 4px', borderRadius: 20, background: rank.bg, border: `1px solid ${accent}55` }}>
            <img src={rankImg} alt="" style={{ width: 20, height: 20, borderRadius: 5, objectFit: 'cover' }} />
            <span style={{ fontSize: 11.5, fontWeight: 900, color: accent, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{rank.label}</span>
          </div>
        </div>
        <img src="/logo_vectorized.svg" alt="" style={{ width: 30, height: 30, opacity: 0.5, flexShrink: 0 }} />
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        {/* ELO / calibration */}
        <div style={{ flex: 1, borderRadius: 14, padding: '12px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${accent}33`, minWidth: 0 }}>
          {stats.calibrating ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Калибровка</span>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{stats.calibrationPlayed}<span style={{ color: '#6B7280', fontSize: 13 }}>/{stats.calibrationTotal}</span></span>
              </div>
              <div style={{ height: 7, borderRadius: 4, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${calPct}%`, height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${accent}, ${accent}aa)`, boxShadow: `0 0 8px ${accent}` }} />
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Stat label="ELO" value={String(stats.elo)} color={accent} />
            </div>
          )}
        </div>

        <Stat label="Rating" value={stats.rating.toFixed(2)} color="#A855F7" />
        <Stat label="K/D" value={stats.kd.toFixed(2)} color="#EAB308" />

        {/* Form */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(stats.form.length ? stats.form : ['—']).map((f, i) => {
              const m = FORM_META[f] || FORM_META.D
              return (
                <div key={i} style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 900, color: m.c, background: m.bg, border: `1px solid ${m.c}55` }}>{f}</div>
              )
            })}
          </div>
          <div style={{ fontSize: 9.5, fontWeight: 800, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Форма · 5</div>
        </div>
      </div>
    </div>
  )
}
