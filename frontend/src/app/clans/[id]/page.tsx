'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { useClanRealtime } from '@/hooks/useClanRealtime'
import { avatarBg } from '@/lib/avatar'
import { Flag } from '@/components/ui/Flag'
import { Icon } from '@/components/ui/Icon'
import { clanGrad, clanTier, ClanAvatar, GlassCard, StatTile, BackBtn, Loader } from '@/components/clans/kit'

type Role = 'leader' | 'officer' | 'member'
const ACCENT = '#22C55E'
const CARD = '#0f0f15'
const ROLE_META: Record<Role, { label: string; color: string }> = {
  leader: { label: 'Лидер', color: '#FFD700' },
  officer: { label: 'Со-Лидер', color: '#60A5FA' },
  member: { label: 'Участник', color: '#9CA3AF' },
}

export default function ClanDetailPage() {
  return <RequireRegistration><Inner /></RequireRegistration>
}

function Inner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [clan, setClan] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [requested, setRequested] = useState(false)
  const [seasons, setSeasons] = useState<any[]>([])

  const load = useCallback(async () => {
    try { setClan((await api.get(`/clans/${id}`)).data) } catch { setClan(null) } finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])
  useEffect(() => { api.get(`/clans/${id}/season-history`).then(r => setSeasons(r.data)).catch(() => {}) }, [id])
  useClanRealtime({ clanId: Number(id) }, () => load())

  const join = async () => {
    try { await api.post(`/clans/${id}/request`); setRequested(true) }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Loader /></div>
  if (!clan) return <div style={{ textAlign: 'center', padding: 80, color: '#6B7280' }}>Клан не найден</div>

  const [g1, g2] = clanGrad(clan.rating)
  const isMember = clan.myRole != null

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
      <BackBtn onClick={() => router.back()} />

      {/* Hero */}
      <div style={{ marginBottom: 12 }}>
        <GlassCard g1={g1} g2={g2} padding={20}>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <ClanAvatar url={clan.avatarUrl} tag={clan.tag} size={74} rating={clan.rating} ring glow />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: g1, background: `${g1}1f`, padding: '2px 8px', borderRadius: 7 }}>[{clan.tag}]</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${g1}, ${g2})`, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.06em', boxShadow: `0 3px 10px ${g1}55` }}>{clanTier(clan.rating).label}</span>
                {clan.region && <Flag code={clan.region} size={15} />}
              </div>
              <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.02em', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: `0 2px 20px ${g1}44` }}>{clan.name}</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
                Создан {new Date(clan.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
          {clan.description && <div style={{ marginTop: 14, fontSize: 13, color: '#B0B0B8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{clan.description}</div>}
        </GlassCard>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <StatTile big label="Рейтинг клана" numeric={clan.rating} value="" color={g1} icon="trophy" delay={0.05} />
        <StatTile big label="Место в топе" value={`#${clan.position}`} color="#F59E0B" icon="crown" delay={0.1} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
        <StatTile label="Участники" value={String(clan.memberCount)} color="#60A5FA" icon="users" delay={0.15} />
        <StatTile label="W / L" value={`${clan.wins}/${clan.losses}`} color="#22C55E" icon="swords" delay={0.2} />
        <StatTile label="Винрейт" value={`${clan.winRate}%`} color={clan.winRate >= 50 ? '#22C55E' : '#EF4444'} icon="trendingUp" delay={0.25} />
      </div>

      {/* Join CTA */}
      {!isMember && (
        <motion.button whileTap={{ scale: 0.98 }} onClick={join} disabled={requested}
          style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', cursor: requested ? 'default' : 'pointer', fontSize: 15, fontWeight: 900, color: '#fff', marginBottom: 12, position: 'relative', overflow: 'hidden', background: requested ? 'rgba(255,255,255,0.06)' : `linear-gradient(135deg, ${ACCENT}, #0EA5E9)`, boxShadow: requested ? 'none' : `0 8px 28px ${ACCENT}44, inset 0 1px 0 rgba(255,255,255,0.18)` }}>
          {!requested && <motion.div animate={{ x: ['-120%', '220%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '34%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)', pointerEvents: 'none' }} />}
          {requested ? 'Заявка отправлена' : 'Подать заявку на вступление'}
        </motion.button>
      )}

      {/* Members */}
      <div style={{ background: CARD, borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', fontSize: 13, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
          <span>Состав</span><span style={{ color: '#4B5563' }}>{clan.memberCount}</span>
        </div>
        {clan.members.map((m: any, i: number) => {
          const rm = ROLE_META[m.role as Role]
          return (
            <motion.button key={m.userId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.25) }} onClick={() => router.push(`/player/${m.userId}`)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px', background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: avatarBg(m.avatarUrl) ? avatarBg(m.avatarUrl)! : 'linear-gradient(135deg,#374151,#1f2937)', border: `1px solid ${m.role === 'leader' ? '#FFD70055' : 'rgba(255,255,255,0.08)'}` }} />
              <div style={{ minWidth: 0, textAlign: 'left', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 170 }}>{m.nickname}</span>
                  {m.isVerified && <Icon name="verified" size={13} color="#60A5FA" />}
                </div>
                <div style={{ fontSize: 11, color: rm.color, fontWeight: 700, marginTop: 1 }}>{rm.label} · {m.elo} ELO</div>
              </div>
              <Icon name="chevronRight" size={16} color="#374151" />
            </motion.button>
          )
        })}
      </div>

      {/* Season history */}
      {seasons.length > 0 && (
        <div style={{ background: CARD, borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 12 }}>
          <div style={{ padding: '14px 16px 10px', fontSize: 13, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>История сезонов</div>
          {seasons.map((s: any) => {
            const medal = s.finalRank === 1 ? '#FFD700' : s.finalRank === 2 ? '#E2E8F0' : s.finalRank === 3 ? '#F97316' : null
            const dec = s.wins + s.losses
            return (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ width: 30, textAlign: 'center', fontSize: medal ? 17 : 14, fontWeight: 900, color: medal || '#4B5563', flexShrink: 0 }}>#{s.finalRank}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Сезон {s.seasonNumber}</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 1 }}>{s.wins}W / {s.losses}L{dec > 0 ? ` · ${Math.round((s.wins / dec) * 100)}% WR` : ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{s.seasonRating}</div>
                  <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase' }}>рейтинг</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
