'use client'

import { motion } from 'framer-motion'
import { getEloRank } from '@/lib/eloRank'
import { Icon } from '@/components/ui/Icon'
import { Flag } from '@/components/ui/Flag'

export interface ObsStats {
  nickname: string
  isVerified?: boolean
  elo: number
  rating: number
  kd: number
  avg: number
  matchesPlayed: number
  calibrating: boolean
  calibrationPlayed: number
  calibrationTotal: number
  form: string[]            // ['W','L','D'...] хронологически (слева — старее)
  region?: string | null
  globalRank?: number | null
  regionalRank?: number | null
}

const FORM_C: Record<string, string> = { W: '#22C55E', L: '#EF4444', D: '#9CA3AF' }

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minWidth: 56 }}>
      <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, alignSelf: 'stretch', margin: '4px 0', background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.12), transparent)' }} />
}

/**
 * OBS / стрим виджет. Прозрачный внешний фон — рисуется только стеклянная карточка.
 * Структура: значок ранга + ник + ELO/калибровка · AVG · KD · RATING · мир/регион · форма.
 */
export function StreamerWidget({ stats }: { stats: ObsStats }) {
  const rank = getEloRank(stats.elo)
  const accent = rank.color
  const rankImg = `/ranks/${rank.level}.jpg?v=1`
  const calPct = Math.round((stats.calibrationPlayed / stats.calibrationTotal) * 100)

  return (
    <div style={{
      position: 'relative', width: 620, borderRadius: 22, overflow: 'hidden',
      background: `radial-gradient(120% 130% at 0% 0%, ${accent}1f, transparent 50%), linear-gradient(150deg, rgba(19,19,25,0.97), rgba(8,8,11,0.98))`,
      border: `1px solid ${accent}3a`, boxShadow: `0 18px 50px rgba(0,0,0,0.5), 0 0 44px ${accent}1c`,
      padding: '15px 18px', fontFamily: 'inherit',
    }}>
      {/* breathing accent halo */}
      <motion.div aria-hidden animate={{ opacity: [0.45, 0.8, 0.45] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: -70, left: -50, width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle, ${accent}30, transparent 70%)`, pointerEvents: 'none' }} />
      {/* dotted texture, fading to the right */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px', WebkitMaskImage: 'radial-gradient(130% 130% at 100% 0%, #000 18%, transparent 72%)' }} />

      {/* ── Top row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, position: 'relative' }}>
        {/* Rank badge */}
        <div style={{ position: 'relative', width: 58, height: 58, flexShrink: 0, borderRadius: 15, overflow: 'hidden', border: `2px solid ${accent}`, boxShadow: `0 0 20px ${accent}55` }}>
          <img src={rankImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        {/* Nick + ELO / calibration */}
        <div style={{ minWidth: 0, width: 168 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>{stats.nickname}</span>
            {stats.isVerified && <Icon name="verified" size={16} color="#3B82F6" />}
          </div>
          {stats.calibrating ? (
            <div style={{ marginTop: 5 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.calibrationPlayed}<span style={{ color: '#6B7280', fontSize: 15 }}>/{stats.calibrationTotal}</span></span>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>калибровка</span>
              </div>
              <div style={{ height: 5, marginTop: 5, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${calPct}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${accent}, ${accent}aa)`, boxShadow: `0 0 8px ${accent}` }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <Icon name="trendingUp" size={15} color={accent} />
              <span style={{ fontSize: 26, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 2px 14px ${accent}66` }}>{stats.elo.toLocaleString()}</span>
              <span style={{ fontSize: 10, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ELO</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
          <Stat label="AVG" value={String(stats.avg)} color="#9CA3AF" />
          <Divider />
          <Stat label="K/D" value={stats.kd.toFixed(2)} color="#EAB308" />
          <Divider />
          <Stat label="Rating" value={stats.rating.toFixed(2)} color="#A855F7" />
        </div>
      </div>

      {/* ── Hairline ── */}
      <div style={{ height: 1, margin: '13px 0 11px', background: `linear-gradient(90deg, transparent, ${accent}99, ${accent}55, transparent)` }} />

      {/* ── Bottom row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* World rank */}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="globe" size={15} color="#60A5FA" />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#E5E7EB', fontVariantNumeric: 'tabular-nums' }}>#{stats.globalRank ?? '—'}</span>
          </span>
          {/* Regional rank */}
          {stats.region && stats.regionalRank && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Flag code={stats.region} size={15} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#E5E7EB', fontVariantNumeric: 'tabular-nums' }}>#{stats.regionalRank}</span>
            </span>
          )}
        </div>

        {/* Form */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {(stats.form.length ? stats.form : ['—']).map((f, i) => (
            <span key={i} style={{ fontSize: 17, fontWeight: 900, color: FORM_C[f] || '#9CA3AF', textShadow: `0 0 10px ${(FORM_C[f] || '#9CA3AF')}66`, fontVariantNumeric: 'tabular-nums' }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
