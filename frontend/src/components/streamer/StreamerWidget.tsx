'use client'

import { motion } from 'framer-motion'
import { getEloRank } from '@/lib/eloRank'
import { EloRing } from '@/components/ui/EloRing'
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

const BRAND = '#E8092E'
const FORM_C: Record<string, string> = { W: '#22C55E', L: '#EF4444', D: '#9CA3AF' }

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 56 }}>
      <div style={{ fontSize: 31, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{label}</div>
    </div>
  )
}

function VDiv() {
  return <div style={{ width: 1, height: 38, background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.14), transparent)' }} />
}

/**
 * OBS / стрим виджет CONDR FACEIT. Прозрачный внешний фон.
 * Круглый значок ранга (EloRing) + ник + ELO/калибровка · AVG · K/D · Rating ·
 * мир/регион · форма. Бренд: фоновый логотип + подпись CONDR FACEIT в подвале.
 */
export function StreamerWidget({ stats }: { stats: ObsStats }) {
  const rank = getEloRank(stats.elo)
  const accent = rank.color
  const calPct = Math.round((stats.calibrationPlayed / stats.calibrationTotal) * 100)

  return (
    <div style={{
      position: 'relative', width: 620, borderRadius: 22, overflow: 'hidden',
      background: `radial-gradient(120% 130% at 0% 0%, ${accent}1c, transparent 50%), linear-gradient(150deg, rgba(19,19,25,0.97), rgba(8,8,11,0.98))`,
      border: `1px solid ${accent}3a`, boxShadow: `0 18px 50px rgba(0,0,0,0.5), 0 0 44px ${accent}1c`,
      padding: '16px 20px', fontFamily: 'inherit',
    }}>
      {/* breathing accent halo */}
      <motion.div aria-hidden animate={{ opacity: [0.4, 0.75, 0.4] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', top: -70, left: -50, width: 280, height: 280, borderRadius: '50%', background: `radial-gradient(circle, ${accent}2e, transparent 70%)`, pointerEvents: 'none' }} />
      {/* CONDR logo watermark (brand) */}
      <img src="/logo_vectorized.svg" aria-hidden alt="" style={{ position: 'absolute', right: -10, top: '50%', transform: 'translateY(-50%)', width: 168, height: 168, opacity: 0.07, pointerEvents: 'none' }} />
      {/* dotted texture */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.4, pointerEvents: 'none', backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px', WebkitMaskImage: 'radial-gradient(130% 130% at 100% 0%, #000 18%, transparent 72%)' }} />

      {/* ── Main row (вертикально отцентрирован) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 15, position: 'relative' }}>
        {/* Circular rank badge (как во всех разделах) */}
        <EloRing elo={stats.elo} size={62} showLabel={false} calibrating={stats.calibrating} />

        {/* Nick + ELO / calibration */}
        <div style={{ minWidth: 0, width: 168 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', letterSpacing: '-0.02em' }}>{stats.nickname}</span>
            {stats.isVerified && <Icon name="verified" size={16} color="#3B82F6" />}
          </div>
          {stats.calibrating ? (
            <div style={{ marginTop: 6 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
                <span style={{ fontSize: 22, fontWeight: 900, color: accent, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{stats.calibrationPlayed}<span style={{ color: '#6B7280', fontSize: 15 }}>/{stats.calibrationTotal}</span></span>
                <span style={{ fontSize: 9.5, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>калибровка</span>
              </div>
              <div style={{ height: 6, marginTop: 6, borderRadius: 3, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{ width: `${calPct}%`, height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${accent}, ${accent}aa)`, boxShadow: `0 0 8px ${accent}` }} />
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 5 }}>
              <Icon name="trendingUp" size={16} color={accent} />
              <span style={{ fontSize: 27, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums', textShadow: `0 2px 14px ${accent}66` }}>{stats.elo.toLocaleString()}</span>
              <span style={{ fontSize: 10.5, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: '0.1em' }}>ELO</span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 16 }}>
          <Stat label="AVG" value={String(stats.avg)} color="#9CA3AF" />
          <VDiv />
          <Stat label="K/D" value={stats.kd.toFixed(2)} color="#EAB308" />
          <VDiv />
          <Stat label="Rating" value={stats.rating.toFixed(2)} color="#A855F7" />
        </div>
      </div>

      {/* ── Hairline ── */}
      <div style={{ height: 1, margin: '14px 0 11px', background: `linear-gradient(90deg, transparent, ${accent}99, ${accent}55, transparent)` }} />

      {/* ── Bottom row: ранги · бренд (центр) · форма ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="globe" size={15} color="#60A5FA" />
            <span style={{ fontSize: 14, fontWeight: 800, color: '#E5E7EB', fontVariantNumeric: 'tabular-nums' }}>#{stats.globalRank ?? '—'}</span>
          </span>
          {stats.region && stats.regionalRank && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Flag code={stats.region} size={15} />
              <span style={{ fontSize: 14, fontWeight: 800, color: '#E5E7EB', fontVariantNumeric: 'tabular-nums' }}>#{stats.regionalRank}</span>
            </span>
          )}
        </div>

        {/* Brand lockup — по центру подвала */}
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 6, opacity: 0.95 }}>
          <img src="/logo_vectorized.svg" alt="" style={{ width: 14, height: 14 }} />
          <span style={{ fontSize: 11.5, fontWeight: 900, letterSpacing: '0.06em' }}>
            <span style={{ color: '#fff' }}>CONDR</span>&nbsp;<span style={{ color: BRAND }}>FACEIT</span>
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          {(stats.form.length ? stats.form : ['—']).map((f, i) => (
            <span key={i} style={{ fontSize: 17, fontWeight: 900, color: FORM_C[f] || '#9CA3AF', textShadow: `0 0 10px ${(FORM_C[f] || '#9CA3AF')}66`, fontVariantNumeric: 'tabular-nums' }}>{f}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
