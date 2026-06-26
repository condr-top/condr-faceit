'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Icon } from '@/components/ui/Icon'
import { avatarBg } from '@/lib/avatar'
import { PageHeader, BackBtn, Loader, Empty, mapImg, mapLabel } from '@/components/clans/kit'

const CARD = '#0f0f15'

interface Brief { id: number; tag: string; name: string; avatarUrl: string | null; rating: number }
interface Battle {
  id: number; mode: string; status: string; map: string | null
  clanA: Brief | null; clanB: Brief | null
  scoreA: number | null; scoreB: number | null; winnerClanId: number | null
  ratingDelta: number | null; completedAt: string | null
}

export default function BattlesPage() {
  return <RequireRegistration><Inner /></RequireRegistration>
}

function Inner() {
  const { id } = useParams<{ id: string }>()
  const clanId = Number(id)
  const router = useRouter()
  const [list, setList] = useState<Battle[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const data: Battle[] = (await api.get(`/clans/${id}/history`)).data
      setList(data.filter(m => m.mode === 'clan_battle'))
    } catch {} finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])

  const wins = list.filter(m => m.winnerClanId === clanId).length

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
      <BackBtn onClick={() => router.back()} />
      <PageHeader title="Клановые бои" subtitle="История матчей 5×5" icon="trophy" g1="#E8092E" g2="#A855F7" />

      {!loading && list.length > 0 && (
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          <MiniStat label="Всего боёв" value={list.length} color="#A855F7" />
          <MiniStat label="Побед" value={wins} color="#22C55E" />
          <MiniStat label="Поражений" value={list.length - wins} color="#EF4444" />
        </div>
      )}

      {loading ? <Loader color="#E8092E" />
        : list.length === 0 ? <Empty text="Клановых боёв пока не было" icon="trophy" />
          : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {list.map((m, i) => <BattleTile key={m.id} m={m} clanId={clanId} index={i} />)}
            </div>
          )}
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ flex: 1, background: CARD, border: `1px solid ${color}26`, borderRadius: 14, padding: '11px 12px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: '16%', right: '16%', height: 1, background: `linear-gradient(90deg, transparent, ${color}aa, transparent)` }} />
      <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.02em', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#6B7280', marginTop: 5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function BattleTile({ m, clanId, index }: { m: Battle; clanId: number; index: number }) {
  const weAreA = m.clanA?.id === clanId
  const opp = weAreA ? m.clanB : m.clanA
  const won = m.winnerClanId === clanId
  const myScore = weAreA ? m.scoreA : m.scoreB
  const oppScore = weAreA ? m.scoreB : m.scoreA
  const accent = won ? '#22C55E' : '#EF4444'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.3), type: 'spring', stiffness: 260, damping: 24 }}
      style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', border: `1px solid ${accent}2e`, background: CARD, boxShadow: `0 8px 26px ${accent}12` }}>
      {/* Map background */}
      {m.map && <div style={{ position: 'absolute', inset: 0, background: `url(${mapImg(m.map)}) center/cover`, opacity: 0.18 }} />}
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(100deg, ${accent}14, transparent 55%)`, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: `linear-gradient(180deg, ${accent}, ${accent}66)` }} />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px 13px 18px' }}>
        {/* Opponent avatar */}
        <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: avatarBg(opp?.avatarUrl) ? avatarBg(opp?.avatarUrl)! : 'linear-gradient(135deg,#374151,#1f2937)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 4px 14px rgba(0,0,0,0.3)' }}>
          {!opp?.avatarUrl && <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{(opp?.tag || '?').slice(0, 2)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 900, color: accent, textTransform: 'uppercase', letterSpacing: '0.06em', background: `${accent}1a`, padding: '2px 7px', borderRadius: 6 }}>
            <Icon name={won ? 'trophy' : 'skull'} size={11} color={accent} />{won ? 'Победа' : 'Поражение'}
          </div>
          <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 4 }}>
            <span style={{ color: '#6B7280', fontWeight: 600 }}>vs </span>[{opp?.tag}] {opp?.name}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            {m.map ? mapLabel(m.map) : 'Карта неизвестна'}{m.completedAt ? ` · ${new Date(m.completedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}` : ''}
          </div>
        </div>
        {/* Score */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', textShadow: `0 2px 14px ${accent}44` }}>
            <span style={{ color: accent }}>{myScore ?? 0}</span>
            <span style={{ color: '#4B5563' }}> : </span>
            <span style={{ color: '#9CA3AF' }}>{oppScore ?? 0}</span>
          </div>
          {m.ratingDelta != null && (
            <div style={{ display: 'inline-block', marginTop: 3, fontSize: 12, fontWeight: 900, color: accent, background: `${accent}1a`, padding: '1px 8px', borderRadius: 20 }}>{won ? '+' : '−'}{m.ratingDelta}</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
