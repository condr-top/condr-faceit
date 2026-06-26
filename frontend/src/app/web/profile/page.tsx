'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Avatar } from '@/components/ui/Avatar'
import { EloRing } from '@/components/ui/EloRing'
import { EloChart } from '@/components/ui/EloChart'
import { getEloRank, getRankProgress, ELO_RANKS } from '@/lib/eloRank'
import { Flag } from '@/components/ui/Flag'
import { Icon, IconName } from '@/components/ui/Icon'

function Stat({ label, value, color, icon }: { label: string; value: string | number; color: string; icon: IconName }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}26`, borderRadius: 14, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: -8, right: -6, opacity: 0.08 }}><Icon name={icon} size={48} color={color} /></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 7 }}>
        <Icon name={icon} size={14} color={color} />
        <span style={{ fontSize: 10.5, color: '#6B7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      </div>
      <div style={{ fontSize: 23, fontWeight: 900, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
    </div>
  )
}

export default function WebProfile() {
  const { user, refreshUser } = useAuthStore()
  const [ach, setAch] = useState<any[]>([])

  useEffect(() => {
    refreshUser()
    api.get('/achievements').then(r => setAch(r.data?.achievements ?? [])).catch(() => {})
  }, [])

  if (!user) return null
  const rank = getEloRank(user.elo)
  const nextRank = ELO_RANKS.find(r => r.min > user.elo) || null
  const segPct = rank.max === Infinity ? 100 : Math.round(getRankProgress(user.elo) * 100)
  const GREEN = '#22C55E', YELLOW = '#EAB308', RED = '#EF4444'
  const kd = Number(user.kdr ?? 0), rating = Number(user.ratingOverall ?? 0)
  const kdColor = kd > 1.1 ? GREEN : kd >= 0.9 ? YELLOW : RED
  const ratingColor = rating > 1.1 ? GREEN : rating >= 0.9 ? YELLOW : RED
  const unlocked = ach.filter(a => a.unlocked)

  return (
    <div>
      <motion.h1 initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 22px' }}>Профиль</motion.h1>

      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 20, alignItems: 'start' }}>
        {/* Left: identity card */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
          style={{ borderRadius: 22, padding: 24, textAlign: 'center', position: 'relative', overflow: 'hidden',
            background: `radial-gradient(130% 120% at 50% 0%, ${rank.color}22, transparent 55%), linear-gradient(160deg, #0c0c11, #08080b)`, border: `1px solid ${rank.color}33` }}>
          <div style={{ position: 'relative', width: 120, height: 120, margin: '0 auto 16px' }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
              style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: `conic-gradient(${rank.color}, transparent 55%, ${rank.color})`, boxShadow: `0 0 24px ${rank.color}55` }} />
            <div style={{ position: 'absolute', inset: 5, borderRadius: '50%', overflow: 'hidden', background: '#0a0a0e' }}>
              <Avatar avatarUrl={user.avatarUrl} name={user.gameNickname || user.firstName} size={110} style={{ borderRadius: '50%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {user.region && <Flag code={user.region} size={16} />}
            <span style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', textShadow: `0 2px 20px ${rank.color}55` }}>{user.gameNickname || user.firstName}</span>
            {user.isVerified && <Icon name="verified" size={19} />}
          </div>
          {user.gameId && <div style={{ fontSize: 12, color: '#4B5563', marginTop: 5 }}>ID: {user.gameId}</div>}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginTop: 18, padding: '14px 18px', borderRadius: 18, background: `${rank.color}10`, border: `1px solid ${rank.color}33` }}>
            <div style={{ filter: `drop-shadow(0 0 14px ${rank.color}88)` }}><EloRing elo={user.elo} size={66} showLabel={false} /></div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 9, color: '#6B7280', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ранг</div>
              <div style={{ fontSize: 17, fontWeight: 900, color: rank.color, lineHeight: 1.1 }}>{rank.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.04em' }}>{user.elo.toLocaleString()}</span>
                <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 700 }}>ELO</span>
              </div>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#6B7280', marginBottom: 6, fontWeight: 700 }}>
              <span style={{ color: rank.color }}>{rank.label}</span>
              <span>{nextRank ? `${nextRank.min - user.elo} до ${nextRank.label}` : 'Макс. ранг'}</span>
            </div>
            <div style={{ height: 7, background: 'rgba(255,255,255,0.07)', borderRadius: 4, overflow: 'hidden' }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${segPct}%` }} transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }} style={{ height: '100%', borderRadius: 4, background: `linear-gradient(90deg, ${rank.color}aa, ${rank.color})`, boxShadow: `0 0 10px ${rank.color}88` }} />
            </div>
          </div>
        </motion.div>

        {/* Right: stats + chart + achievements */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
            <Stat label="Матчи" value={user.matchesPlayed} color="#60A5FA" icon="gamepad" />
            <Stat label="Винрейт" value={`${user.winRate}%`} color={user.winRate >= 50 ? GREEN : YELLOW} icon="trendingUp" />
            <Stat label="W / L" value={`${user.matchesWon}/${user.matchesLost}`} color={GREEN} icon="trophy" />
            <Stat label="K/D" value={kd.toFixed(2)} color={kdColor} icon="swords" />
            <Stat label="Ср. убийств" value={Number(user.avgKills ?? 0).toFixed(1)} color="#A855F7" icon="skull" />
            <Stat label="Рейтинг" value={rating.toFixed(2)} color={ratingColor} icon="barChart" />
          </div>

          <EloChart userId={user.id} currentElo={user.elo} />

          {unlocked.length > 0 && (
            <div style={{ borderRadius: 18, padding: 18, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ fontSize: 11, color: '#374151', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14 }}>Достижения · {unlocked.length}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                {unlocked.map((a: any) => (
                  <div key={a.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 13, background: `${a.color}10`, border: `1px solid ${a.color}30` }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `linear-gradient(135deg, ${a.color}, ${a.color}99)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 3px 10px ${a.color}44` }}>
                      <Icon name={(a.icon || 'medal') as IconName} size={17} color="#fff" />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
