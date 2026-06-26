'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { Icon } from '@/components/ui/Icon'

const GREEN = '#22C55E', YELLOW = '#EAB308', RED = '#EF4444', GREY = '#6B7280'

interface MapStat {
  map: string
  played: number
  wins: number
  losses: number
  winRate: number
  avgRating: number
  avgKills: number
}

const mapImg = (m: string) => `/maps/${m.charAt(0).toUpperCase()}${m.slice(1).toLowerCase()}.webp`
const mapName = (m: string) => m.charAt(0).toUpperCase() + m.slice(1).toLowerCase()

const winColor = (v: number) => (v >= 55 ? GREEN : v >= 45 ? YELLOW : RED)
const ratColor = (v: number) => (v > 1.1 ? GREEN : v >= 0.9 ? YELLOW : RED)

export default function MapStatsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const league = searchParams.get('league')
  const [stats, setStats] = useState<MapStat[]>([])
  const [metric, setMetric] = useState<'winrate' | 'rating'>('winrate')
  const [loading, setLoading] = useState(true)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(320)

  useEffect(() => {
    const q = league === 'cpl' || league === 'cplq' ? `?league=${league}` : ''
    api.get(`/matches/map-stats${q}`).then(r => setStats(r.data || [])).catch(() => {}).finally(() => setLoading(false))
  }, [league])

  useEffect(() => {
    const update = () => { if (wrapRef.current) setSize(wrapRef.current.offsetWidth) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [stats])

  const accent = metric === 'winrate' ? GREEN : '#A855F7'
  const N = stats.length || 7
  const cx = size / 2, cy = size / 2
  const R = size * 0.27
  const labelR = size * 0.40
  const thumb = Math.round(size * 0.155)

  const angle = (i: number) => ((-90 + i * (360 / N)) * Math.PI) / 180
  const ptOnAxis = (i: number, r: number) => ({ x: cx + r * Math.cos(angle(i)), y: cy + r * Math.sin(angle(i)) })

  const valueOf = (s: MapStat) => metric === 'winrate'
    ? Math.min(1, s.winRate / 100)
    : Math.min(1, s.avgRating / 2)

  // data polygon points
  const dataPts = stats.map((s, i) => {
    const v = valueOf(s)
    return ptOnAxis(i, R * v)
  })
  const dataPath = dataPts.map(p => `${p.x},${p.y}`).join(' ')

  // sorted list for the bottom section
  const sorted = [...stats].sort((a, b) =>
    metric === 'winrate' ? b.winRate - a.winRate : b.avgRating - a.avgRating)

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
          <Icon name="target" size={16} />Статистика по картам
        </div>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* Metric toggle */}
        <div style={{ display: 'flex', gap: 5, background: '#0f0f15', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 4, marginBottom: 14 }}>
          {([
            { k: 'winrate', label: 'Винрейт', icon: 'trophy' as const, c: GREEN },
            { k: 'rating', label: 'Рейтинг', icon: 'star' as const, c: '#A855F7' },
          ]).map(t => {
            const on = metric === t.k
            return (
              <button key={t.k} onClick={() => setMetric(t.k as any)} style={{
                flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 800, transition: 'all 0.2s',
                background: on ? `linear-gradient(135deg, ${t.c}d0, ${t.c}90)` : 'transparent',
                color: on ? '#fff' : '#4B5563',
                boxShadow: on ? `0 2px 12px ${t.c}40` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Icon name={t.icon} size={13} />{t.label}
              </button>
            )
          })}
        </div>

        {/* ── RADAR ── */}
        <div style={{
          background: `radial-gradient(120% 120% at 50% 30%, ${accent}10, transparent 60%), #0f0f15`,
          border: `1px solid ${accent}26`, borderRadius: 20, padding: '14px 10px 18px', marginBottom: 16,
          position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 1, background: `linear-gradient(90deg, transparent, ${accent}88, transparent)` }} />
          <div ref={wrapRef} style={{ position: 'relative', width: '100%', height: size }}>
            {/* SVG radar */}
            <svg width={size} height={size} style={{ position: 'absolute', inset: 0 }}>
              <defs>
                <radialGradient id="radarFill" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={accent} stopOpacity="0.5" />
                  <stop offset="100%" stopColor={accent} stopOpacity="0.18" />
                </radialGradient>
              </defs>
              {/* grid rings */}
              {[0.25, 0.5, 0.75, 1].map((lvl, li) => (
                <polygon key={li}
                  points={stats.map((_, i) => { const p = ptOnAxis(i, R * lvl); return `${p.x},${p.y}` }).join(' ')}
                  fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={1}
                />
              ))}
              {/* spokes */}
              {stats.map((_, i) => { const p = ptOnAxis(i, R); return (
                <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              )})}
              {/* data polygon */}
              {dataPts.length > 0 && (
                <motion.polygon
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  style={{ transformOrigin: `${cx}px ${cy}px` }}
                  points={dataPath}
                  fill="url(#radarFill)"
                  stroke={accent}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  filter={`drop-shadow(0 0 6px ${accent}88)`}
                />
              )}
              {/* data vertices */}
              {dataPts.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" stroke={accent} strokeWidth={1.5} />
              ))}
            </svg>

            {/* Map thumbnails around */}
            {stats.map((s, i) => {
              const p = ptOnAxis(i, labelR)
              const val = metric === 'winrate' ? `${s.winRate}%` : s.avgRating.toFixed(2)
              const vc = metric === 'winrate' ? winColor(s.winRate) : ratColor(s.avgRating)
              return (
                <div key={s.map} style={{
                  position: 'absolute', left: p.x, top: p.y, transform: 'translate(-50%, -50%)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: thumb + 20,
                }}>
                  <div style={{
                    width: thumb, height: thumb, borderRadius: 12, overflow: 'hidden',
                    border: `1.5px solid ${s.played > 0 ? accent + '66' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: s.played > 0 ? `0 0 12px ${accent}30` : 'none',
                    backgroundImage: `url(${mapImg(s.map)})`, backgroundSize: 'cover', backgroundPosition: 'center',
                    position: 'relative',
                  }}>
                    {s.played === 0 && <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,6,8,0.55)' }} />}
                  </div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: '#D1D5DB', whiteSpace: 'nowrap' }}>{mapName(s.map)}</div>
                  <div style={{ fontSize: 9, fontWeight: 900, color: s.played > 0 ? vc : '#374151', lineHeight: 1 }}>
                    {s.played > 0 ? val : '—'}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── PER-MAP LIST ── */}
        <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
          {metric === 'winrate' ? 'Винрейт по картам' : 'Средний рейтинг по картам'}
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <div style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTop: `2px solid ${accent}`, animation: 'spin 0.8s linear infinite' }} />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <AnimatePresence mode="popLayout">
              {sorted.map((s, i) => {
                const value = metric === 'winrate' ? s.winRate : s.avgRating
                const vc = metric === 'winrate' ? winColor(s.winRate) : ratColor(s.avgRating)
                const barPct = metric === 'winrate' ? s.winRate : Math.min(100, (s.avgRating / 2) * 100)
                const empty = s.played === 0
                return (
                  <motion.div
                    key={s.map}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, type: 'spring', stiffness: 320, damping: 26 }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: '#0f0f15', borderRadius: 16, padding: 10,
                      border: '1px solid rgba(255,255,255,0.06)',
                      borderLeft: `3px solid ${empty ? 'rgba(255,255,255,0.08)' : vc}`,
                      opacity: empty ? 0.55 : 1,
                    }}
                  >
                    <div style={{
                      width: 52, height: 40, borderRadius: 10, flexShrink: 0,
                      backgroundImage: `url(${mapImg(s.map)})`, backgroundSize: 'cover', backgroundPosition: 'center',
                      border: '1px solid rgba(255,255,255,0.08)',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{mapName(s.map)}</span>
                        <span style={{ fontSize: 15, fontWeight: 900, color: empty ? '#374151' : vc, letterSpacing: '-0.3px' }}>
                          {empty ? '—' : (metric === 'winrate' ? `${value}%` : value.toFixed(2))}
                        </span>
                      </div>
                      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${empty ? 0 : barPct}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut', delay: i * 0.03 }}
                          style={{ height: '100%', borderRadius: 2, background: `linear-gradient(90deg, ${vc}88, ${vc})`, boxShadow: `0 0 5px ${vc}70` }}
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 9, color: '#6B7280', fontWeight: 600 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon name="gamepad" size={9} />{s.played} игр</span>
                        {s.played > 0 && <span style={{ color: GREEN }}>{s.wins}W</span>}
                        {s.played > 0 && <span style={{ color: RED }}>{s.losses}L</span>}
                        {s.played > 0 && metric === 'winrate' && <span style={{ color: '#A855F7' }}>рейтинг {s.avgRating.toFixed(2)}</span>}
                        {s.played > 0 && metric === 'rating' && <span style={{ color: GREEN }}>{s.winRate}% WR</span>}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  )
}
