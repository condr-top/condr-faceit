'use client'

import { useEffect, useState } from 'react'
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/lib/api'

interface EloPoint {
  elo: number
  change: number
  won: boolean
  date: string
}

interface EloHistoryData {
  points: EloPoint[]
  wins: number
  losses: number
  eloChange: number
}

interface Props {
  userId?: number   // if undefined → fetch /users/me/elo-history
  currentElo: number
}

export function EloChart({ userId, currentElo }: Props) {
  const [data, setData] = useState<EloHistoryData | null>(null)

  useEffect(() => {
    const url = userId ? `/users/${userId}/elo-history` : `/users/me/elo-history`
    api.get(url).then(r => setData(r.data)).catch(() => {})
  }, [userId])

  if (!data || data.points.length < 2) return null

  // Find the last continuous segment — split where ELO jumps by more than 300
  // (those are untracked admin adjustments, not real match progression)
  const allPoints = data.points
  let segmentStart = 0
  for (let i = 1; i < allPoints.length; i++) {
    if (Math.abs(allPoints[i].elo - allPoints[i - 1].elo) > 300) {
      segmentStart = i
    }
  }
  const rawPoints = allPoints.slice(segmentStart)
  if (rawPoints.length < 2) return null

  // Recalculate change as visual diff between consecutive points
  // so tooltip always matches what the chart shows
  const points = rawPoints.map((p, i, arr) => ({
    ...p,
    change: i === 0 ? p.change : p.elo - arr[i - 1].elo,
  }))

  const wins   = points.filter(p => p.change > 0).length
  const losses = points.filter(p => p.change < 0).length
  const eloChange = points[points.length - 1].elo - points[0].elo


  const eloPositive = eloChange >= 0
  const chartColor = eloPositive ? '#E8092E' : '#6366f1'

  // Y-axis domain with small padding — computed from the visible segment only
  const elos = points.map(p => p.elo)
  const minElo = Math.min(...elos)
  const maxElo = Math.max(...elos)
  const pad = Math.max(30, (maxElo - minElo) * 0.15)
  const domainMin = Math.floor((minElo - pad) / 50) * 50
  const domainMax = Math.ceil((maxElo + pad) / 50) * 50

  // Y-axis tick values
  const step = Math.ceil((domainMax - domainMin) / 4 / 50) * 50
  const ticks: number[] = []
  for (let v = domainMin; v <= domainMax; v += step) ticks.push(v)

  return (
    <div style={{
      background: 'rgba(10,10,10,0.95)',
      borderRadius: 16,
      padding: '18px 16px 12px',
      marginBottom: 16,
      border: '1px solid rgba(255,255,255,0.06)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, color: '#4B5563', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
            Динамика ELO
          </div>
          <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-1px' }}>
            {currentElo.toLocaleString()}
          </div>
        </div>
        <div style={{
          background: eloPositive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
          border: `1px solid ${eloPositive ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
          borderRadius: 20,
          padding: '4px 12px',
          fontSize: 13,
          fontWeight: 800,
          color: eloPositive ? '#22C55E' : '#EF4444',
        }}>
          {eloPositive ? '+' : ''}{eloChange}
        </div>
      </div>

      {/* Chart */}
      <div style={{ height: 120, marginLeft: -8, marginRight: -4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`eloGrad${userId ?? 'me'}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={chartColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis
              domain={[domainMin, domainMax]}
              ticks={ticks}
              tick={{ fill: '#4B5563', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const p = payload[0].payload as EloPoint
                return (
                  <div style={{
                    background: '#111', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 8, padding: '6px 10px', fontSize: 12,
                  }}>
                    <div style={{ fontWeight: 800, color: '#fff' }}>{p.elo} ELO</div>
                    <div style={{ color: p.change >= 0 ? '#22C55E' : '#EF4444', fontWeight: 700 }}>
                      {p.change >= 0 ? '+' : ''}{p.change}
                    </div>
                  </div>
                )
              }}
            />
            <Area
              type="monotone"
              dataKey="elo"
              stroke={chartColor}
              strokeWidth={2}
              fill={`url(#eloGrad${userId ?? 'me'})`}
              dot={false}
              activeDot={{ r: 4, fill: chartColor, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Win/loss bars */}
      <div style={{ display: 'flex', gap: 3, marginTop: 10, marginBottom: 10 }}>
        {points.map((p, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: p.change > 0 ? '#22C55E' : p.change < 0 ? '#EF4444' : '#6B7280',
            }}
          />
        ))}
      </div>

      {/* W / L */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          background: 'rgba(34,197,94,0.12)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: 8, padding: '5px 14px',
          fontSize: 13, fontWeight: 800, color: '#22C55E',
        }}>
          W {wins}
        </div>
        <div style={{
          background: 'rgba(239,68,68,0.12)',
          border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, padding: '5px 14px',
          fontSize: 13, fontWeight: 800, color: '#EF4444',
        }}>
          L {losses}
        </div>
      </div>
    </div>
  )
}
