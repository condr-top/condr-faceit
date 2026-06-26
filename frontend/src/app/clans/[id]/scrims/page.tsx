'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { useClanRealtime } from '@/hooks/useClanRealtime'
import { avatarBg } from '@/lib/avatar'
import { Flag } from '@/components/ui/Flag'
import { Icon } from '@/components/ui/Icon'
import { useSheetDrag } from '@/lib/useSheetDrag'

const CARD = '#0f0f15'
const MAPS = ['PRISON', 'SANDSTONE', 'PROVINCE', 'BREEZE', 'HANAMI', 'RUST', 'DUNE']
const mapImg = (m: string) => `/maps/${m.charAt(0) + m.slice(1).toLowerCase()}.webp`
const mapLabel = (m: string) => m.charAt(0) + m.slice(1).toLowerCase()
const REGIONS = ['ru', 'ua', 'kz', 'by', 'uz', 'az', 'am', 'ge', 'kg', 'tj', 'tm', 'md', 'tr', 'de', 'us', 'gb', 'fr', 'pl', 'br', 'cn']

type Tier = 'main' | 'semi' | 'pro'
const TIERS: { key: Tier; label: string; topN: number; color: string; g2: string; icon: any; desc: string }[] = [
  { key: 'main', label: 'MAIN', topN: Infinity, color: '#22C55E', g2: '#0EA5E9', icon: 'users', desc: 'Открытый поиск для всех кланов' },
  { key: 'semi', label: 'SEMI-PRO', topN: 25, color: '#0EA5E9', g2: '#22C55E', icon: 'shield', desc: 'Для кланов из топ-25 рейтинга' },
  { key: 'pro', label: 'PRO', topN: 10, color: '#F59E0B', g2: '#E8092E', icon: 'crown', desc: 'Профессиональный поиск — топ-10' },
]
const tierMeta = (t: Tier) => TIERS.find(x => x.key === t)!

const SERVERS = [
  { code: 'ru', label: 'Россия', flag: 'ru' }, { code: 'nl', label: 'Нидерланды', flag: 'nl' },
  { code: 'fr', label: 'Франция', flag: 'fr' }, { code: 'pl', label: 'Польша', flag: 'pl' },
  { code: 'tr', label: 'Турция', flag: 'tr' }, { code: 'us-w', label: 'Запад США', flag: 'us' },
  { code: 'us-e', label: 'Восток США', flag: 'us' }, { code: 'br', label: 'Бразилия', flag: 'br' },
]
const SERVER_LABEL: Record<string, string> = Object.fromEntries(SERVERS.map(s => [s.code, s.label]))

function clanGrad(rating: number) {
  if (rating >= 1600) return ['#A855F7', '#E8092E']
  if (rating >= 1300) return ['#F59E0B', '#EF4444']
  if (rating >= 1100) return ['#22C55E', '#0EA5E9']
  return ['#475569', '#64748B']
}

interface ClanBrief { id: number; tag: string; name: string; avatarUrl: string | null; rating: number; region?: string | null; winRate?: number }
interface Listing {
  id: number; status: string; tier: Tier; server: string | null; scheduledAt: string | null
  maps: string[]; note: string | null; matchId: number | null; createdAt: string; responseCount?: number
  clan: ClanBrief | null
}
interface ScrimResponse { id: number; listingId: number; map: string | null; scheduledAt: string | null; server: string | null; tier: Tier; clan: ClanBrief | null }

const fmtWhen = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  : 'Время не указано'

export default function ScrimsPage() {
  return <RequireRegistration><Inner /></RequireRegistration>
}

type Tab = 'search' | 'mine' | 'responses'

function Inner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [tier, setTier] = useState<Tier | null>(null)
  const [position, setPosition] = useState<number | null>(null)
  const [canEdit, setCanEdit] = useState(false)
  const [tab, setTab] = useState<Tab>('search')
  const [search, setSearch] = useState<Listing[]>([])
  const [mine, setMine] = useState<Listing[]>([])
  const [responses, setResponses] = useState<ScrimResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [respondTo, setRespondTo] = useState<Listing | null>(null)
  const [doneMsg, setDoneMsg] = useState<string | null>(null)

  const loadRole = useCallback(async () => {
    try { const c = await api.get(`/clans/${id}`); setCanEdit(c.data?.myRole === 'leader' || c.data?.myRole === 'officer'); setPosition(c.data?.position ?? null) } catch {}
  }, [id])

  const load = useCallback(async () => {
    if (!tier) return
    setLoading(true)
    try {
      const [se, mn, rs] = await Promise.all([
        api.get('/clans/scrims/exchange', { params: { tier } }),
        api.get('/clans/scrims/mine').catch(() => ({ data: [] })),
        api.get('/clans/scrims/responses').catch(() => ({ data: [] })),
      ])
      setSearch(se.data); setMine(mn.data); setResponses(rs.data)
    } catch {} finally { setLoading(false) }
  }, [tier])

  useEffect(() => { loadRole() }, [loadRole])
  useEffect(() => { load() }, [load])
  useClanRealtime({ clanId: Number(id), exchange: true }, () => load())

  const respondDirect = async (l: Listing, map?: string) => {
    try {
      await api.post(`/clans/scrims/${l.id}/respond`, map ? { map } : {})
      setDoneMsg('Отклик отправлен! Дождитесь подтверждения от клана.')
      setRespondTo(null); load()
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }
  const onRespond = (l: Listing) => { if ((l.maps?.length ?? 0) > 1) setRespondTo(l); else respondDirect(l, l.maps?.[0]) }
  const remove = async (l: Listing) => { if (!confirm('Удалить заявку?')) return; try { await api.post(`/clans/scrims/${l.id}/cancel`); load() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } }
  const accept = async (r: ScrimResponse) => { try { await api.post(`/clans/scrims/responses/${r.id}/accept`); setDoneMsg('Прак подтверждён и добавлен в расписание!'); load() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } }
  const reject = async (r: ScrimResponse) => { try { await api.post(`/clans/scrims/responses/${r.id}/reject`); load() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } }

  const myTier = tier ? mine.filter(l => l.tier === tier) : mine

  // ── Гейт выбора уровня поиска ──
  if (!tier) {
    return (
      <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
        <BackBtn onClick={() => router.back()} label="Назад" />
        <Header title="Праки" subtitle="Выберите уровень поиска" color="#A855F7" g2="#E8092E" icon="swords" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {TIERS.map((t, i) => {
            const unlocked = position != null && position <= t.topN
            return (
              <motion.button key={t.key} onClick={() => unlocked && setTier(t.key)} disabled={!unlocked}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07, type: 'spring', stiffness: 280, damping: 24 }}
                whileTap={unlocked ? { scale: 0.985 } : undefined}
                style={{ position: 'relative', overflow: 'hidden', textAlign: 'left', padding: 20, borderRadius: 22, cursor: unlocked ? 'pointer' : 'not-allowed', opacity: unlocked ? 1 : 0.8,
                  border: `1px solid ${unlocked ? `${t.color}55` : 'rgba(255,255,255,0.06)'}`,
                  background: unlocked ? `radial-gradient(130% 130% at 100% 0%, ${t.color}26, transparent 50%), linear-gradient(135deg, ${t.color}14, #0c0c11)` : '#0d0d12',
                  boxShadow: unlocked ? `0 12px 36px ${t.color}1f` : 'none' }}>
                {unlocked && <>
                  <div style={{ position: 'absolute', top: -30, right: -20, width: 130, height: 130, borderRadius: '50%', background: `radial-gradient(circle, ${t.color}44, transparent 70%)`, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, background: `linear-gradient(90deg, transparent, ${t.color}aa, transparent)` }} />
                  <div style={{ position: 'absolute', top: 6, right: 12, opacity: 0.1, pointerEvents: 'none' }}><Icon name={t.icon} size={72} color={t.color} /></div>
                  <motion.div animate={{ x: ['-130%', '240%'] }} transition={{ duration: 4.5, repeat: Infinity, repeatDelay: 4, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '26%', background: `linear-gradient(90deg, transparent, ${t.color}18, transparent)`, pointerEvents: 'none' }} />
                </>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, position: 'relative' }}>
                  <div style={{ position: 'relative', width: 52, height: 52, borderRadius: 16, background: unlocked ? `linear-gradient(135deg, ${t.color}, ${t.g2})` : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: unlocked ? `0 8px 22px ${t.color}55` : 'none' }}>
                    {unlocked && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '16px 16px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.28), transparent)' }} />}
                    {unlocked ? <Icon name={t.icon} size={25} color="#fff" /> : <Icon name="lock" size={22} color="#6B7280" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.02em', color: unlocked ? '#fff' : '#9CA3AF', textShadow: unlocked ? `0 2px 16px ${t.color}55` : 'none' }}>{t.label}</span>
                      {t.topN !== Infinity && <span style={{ fontSize: 9, fontWeight: 900, color: unlocked ? '#fff' : t.color, background: unlocked ? `${t.color}` : `${t.color}24`, padding: '2px 7px', borderRadius: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Топ-{t.topN}</span>}
                    </div>
                    <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 3 }}>{unlocked ? t.desc : `Доступно только кланам из топ-${t.topN}`}</div>
                  </div>
                  {unlocked ? <Icon name="chevronRight" size={22} color={t.color} /> : <Icon name="lock" size={18} color="#6B7280" />}
                </div>
              </motion.button>
            )
          })}
        </div>
      </div>
    )
  }

  const tm = tierMeta(tier)
  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
      <BackBtn onClick={() => setTier(null)} label="Уровень поиска" />
      <Header title={`Праки · ${tm.label}`} subtitle="Тренировочные матчи · без рейтинга" color={tm.color} g2={tm.g2} icon={tm.icon} />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 14 }}>
        {([['search', 'Поиск'], ['mine', 'Мои заявки'], ['responses', 'Отклики']] as [Tab, string][]).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, position: 'relative', padding: '9px 0', border: 'none', cursor: 'pointer', background: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, color: tab === t ? '#fff' : '#6B7280' }}>
            {tab === t && <motion.div layoutId="scrimTab" style={{ position: 'absolute', inset: 0, borderRadius: 10, background: `linear-gradient(135deg, ${tm.color}cc, ${tm.g2}cc)`, zIndex: -1 }} />}
            {label}
            {t === 'responses' && responses.length > 0 && (
              <span style={{ position: 'absolute', top: 3, right: 8, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#E8092E', color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{responses.length}</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {doneMsg && (
          <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} onAnimationComplete={() => setTimeout(() => setDoneMsg(null), 3500)}
            style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontSize: 13, fontWeight: 600 }}>{doneMsg}</motion.div>
        )}
      </AnimatePresence>

      {tab === 'mine' && canEdit && (
        <button onClick={() => setCreating(true)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px 0', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${tm.color}, ${tm.g2})`, boxShadow: `0 8px 24px ${tm.color}40`, marginBottom: 12 }}>
          <Icon name="plus" size={16} color="#fff" /> Разместить заявку
        </button>
      )}

      {loading ? <Loader /> : (
        tab === 'search' ? (
          search.length === 0 ? <Empty text="Пока нет открытых заявок на этом уровне" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{search.map(l => <ListingCard key={l.id} l={l} mode="search" canEdit={canEdit} tm={tm} onRespond={() => onRespond(l)} />)}</div>
        ) : tab === 'mine' ? (
          myTier.length === 0 ? <Empty text={canEdit ? 'У вашего клана нет заявок' : 'Заявки размещают лидер и со-лидеры'} />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{myTier.map(l => <ListingCard key={l.id} l={l} mode="mine" canEdit={canEdit} tm={tm} onCancel={() => remove(l)} />)}</div>
        ) : (
          responses.length === 0 ? <Empty text="Откликов на ваши заявки пока нет" />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{responses.map(r => <ResponseCard key={r.id} r={r} canEdit={canEdit} onAccept={() => accept(r)} onReject={() => reject(r)} />)}</div>
        )
      )}

      <AnimatePresence>
        {creating && <CreateListingModal tier={tier} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); setTab('mine'); load() }} />}
        {respondTo && <RespondModal listing={respondTo} onClose={() => setRespondTo(null)} onPick={(map) => respondDirect(respondTo, map)} />}
      </AnimatePresence>
    </div>
  )
}

// ── Shared bits ──
function BackBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}><Icon name="chevronLeft" size={18} color="#9CA3AF" /> {label}</button>
}
function Header({ title, subtitle, color, g2, icon }: { title: string; subtitle: string; color: string; g2: string; icon: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
      <div style={{ position: 'relative', width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${color}, ${g2})`, boxShadow: `0 8px 22px ${color}55` }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)' }} />
        <Icon name={icon} size={23} color="#fff" />
      </div>
      <div>
        <h1 style={{ fontSize: 23, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>{title}</h1>
        <div style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>{subtitle}</div>
      </div>
    </motion.div>
  )
}
function MapChips({ maps, color }: { maps: string[]; color: string }) {
  if (!maps?.length) return <span style={{ fontSize: 12, color: '#6B7280' }}>Любая карта</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {maps.map(m => (
        <span key={m} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#D1D5DB', background: 'rgba(255,255,255,0.05)', padding: '3px 8px 3px 4px', borderRadius: 7, border: `1px solid ${color}22` }}>
          <span style={{ width: 18, height: 13, borderRadius: 3, background: `url(${mapImg(m)}) center/cover`, border: '1px solid rgba(255,255,255,0.1)' }} />{mapLabel(m)}
        </span>
      ))}
    </div>
  )
}

function ListingCard({ l, mode, canEdit, tm, onRespond, onCancel }: { l: Listing; mode: 'search' | 'mine'; canEdit: boolean; tm: typeof TIERS[number]; onRespond?: () => void; onCancel?: () => void }) {
  const c = l.clan
  const [g1] = clanGrad(c?.rating ?? 1000)
  return (
    <div style={{ background: CARD, borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: avatarBg(c?.avatarUrl) ? avatarBg(c?.avatarUrl)! : `linear-gradient(135deg, ${g1}, #1f2937)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
          {!c?.avatarUrl && <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{(c?.tag || '?').slice(0, 2)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: g1 }}>[{c?.tag}]</span>
            {c?.region && <Flag code={c.region} size={13} />}
            <span style={{ fontSize: 11, color: '#6B7280' }}>· {c?.rating} рейт · {c?.winRate}% WR</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{c?.name}</div>
        </div>
        {mode === 'mine' && (l.responseCount ?? 0) > 0 && (
          <span style={{ fontSize: 11, fontWeight: 800, color: '#E8092E', background: 'rgba(232,9,46,0.14)', padding: '4px 9px', borderRadius: 20, flexShrink: 0 }}>{l.responseCount} откл.</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 11, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9CA3AF' }}><Icon name="timer" size={14} color="#6B7280" /> {fmtWhen(l.scheduledAt)}</div>
        {l.server && <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9CA3AF' }}><Icon name="globe" size={13} color="#6B7280" /> {SERVER_LABEL[l.server] || l.server}</div>}
      </div>

      <div style={{ marginTop: 10 }}><MapChips maps={l.maps} color={tm.color} /></div>
      {l.note && <div style={{ fontSize: 13, color: '#B0B0B8', marginTop: 9, lineHeight: 1.4 }}>{l.note}</div>}

      {mode === 'search' && canEdit && (
        <button onClick={onRespond} style={{ width: '100%', marginTop: 12, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${tm.color}, ${tm.g2})` }}>
          {(l.maps?.length ?? 0) > 1 ? 'Откликнуться · выбрать карту' : 'Откликнуться'}
        </button>
      )}
      {mode === 'mine' && canEdit && (
        <button onClick={onCancel} style={{ width: '100%', marginTop: 12, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.12)' }}>Удалить заявку</button>
      )}
    </div>
  )
}

function ResponseCard({ r, canEdit, onAccept, onReject }: { r: ScrimResponse; canEdit: boolean; onAccept: () => void; onReject: () => void }) {
  const c = r.clan
  const [g1] = clanGrad(c?.rating ?? 1000)
  return (
    <div style={{ background: CARD, borderRadius: 16, border: '1px solid rgba(232,9,46,0.18)', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 44, height: 44, borderRadius: 13, flexShrink: 0, background: avatarBg(c?.avatarUrl) ? avatarBg(c?.avatarUrl)! : `linear-gradient(135deg, ${g1}, #1f2937)`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
          {!c?.avatarUrl && <span style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{(c?.tag || '?').slice(0, 2)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: g1 }}>[{c?.tag}]</span>
            {c?.region && <Flag code={c.region} size={13} />}
            <span style={{ fontSize: 11, color: '#6B7280' }}>· {c?.rating} рейт</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{c?.name}</div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 11, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9CA3AF' }}><Icon name="timer" size={14} color="#6B7280" /> {fmtWhen(r.scheduledAt)}</div>
        {r.map && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: '#fff' }}>
            <span style={{ width: 24, height: 17, borderRadius: 4, background: `url(${mapImg(r.map)}) center/cover`, border: '1px solid rgba(255,255,255,0.12)' }} /> Предлагает: {mapLabel(r.map)}
          </div>
        )}
      </div>

      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onReject} style={{ flex: 1, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#EF4444', background: 'rgba(239,68,68,0.12)' }}>Отклонить</button>
          <button onClick={onAccept} style={{ flex: 2, padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #22C55E, #0EA5E9)' }}>Подтвердить прак</button>
        </div>
      )}
    </div>
  )
}

// ── Respond: choose one of the offered maps ──
function RespondModal({ listing, onClose, onPick }: { listing: Listing; onClose: () => void; onPick: (map: string) => void }) {
  const [map, setMap] = useState('')
  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Выберите карту</div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Клан [{listing.clan?.tag}] предлагает несколько карт — выберите одну, что хотите сыграть.</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9, marginBottom: 18 }}>
        {listing.maps.map(mp => <MapTile key={mp} map={mp} selected={map === mp} color="#A855F7" onClick={() => setMap(mp)} />)}
      </div>
      <button onClick={() => map && onPick(map)} disabled={!map} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: map ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 800, color: '#fff', background: map ? 'linear-gradient(135deg, #A855F7, #E8092E)' : 'rgba(255,255,255,0.06)', opacity: map ? 1 : 0.5 }}>
        Откликнуться
      </button>
    </Sheet>
  )
}

function CreateListingModal({ tier, onClose, onSaved }: { tier: Tier; onClose: () => void; onSaved: () => void }) {
  const tm = tierMeta(tier)
  const [maps, setMaps] = useState<string[]>([])
  const [server, setServer] = useState('')
  const [day, setDay] = useState('')
  const [times, setTimes] = useState<string[]>([])
  const [timeInput, setTimeInput] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const toggleMap = (m: string) => setMaps(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  const addTime = () => { if (timeInput && !times.includes(timeInput)) { setTimes(prev => [...prev, timeInput].sort()); setTimeInput('') } }
  const removeTime = (t: string) => setTimes(prev => prev.filter(x => x !== t))

  const valid = !!day && times.length > 0 && maps.length > 0 && !!server
  const missing = [!day && 'дату', times.length === 0 && 'тайминг', maps.length === 0 && 'карту', !server && 'сервер'].filter(Boolean) as string[]

  const submit = async () => {
    if (!valid) return
    setSaving(true)
    try {
      const isoTimes = times.map(t => new Date(`${day}T${t}`).toISOString())
      await api.post('/clans/scrims', { tier, maps, server, times: isoTimes, note: note.trim() || undefined })
      onSaved()
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setSaving(false) }
  }

  return (
    <Sheet onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Заявка на прак · {tm.label}</div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 18 }}>Можно указать несколько таймингов и карт — заявка появится на каждый тайминг.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Дата + тайминги */}
        <div>
          <Lbl>Дата *</Lbl>
          <input type="date" value={day} onChange={e => setDay(e.target.value)} style={inp} />
        </div>
        <div>
          <Lbl>Тайминги (мин. 1) *</Lbl>
          <div style={{ display: 'flex', gap: 8, marginBottom: times.length ? 10 : 0 }}>
            <input type="time" value={timeInput} onChange={e => setTimeInput(e.target.value)} style={{ ...inp, flex: 1 }} />
            <button onClick={addTime} disabled={!timeInput} style={{ padding: '0 18px', borderRadius: 12, border: 'none', cursor: timeInput ? 'pointer' : 'not-allowed', fontSize: 20, fontWeight: 800, color: '#fff', background: timeInput ? `${tm.color}33` : 'rgba(255,255,255,0.05)' }}>+</button>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {times.map(t => (
              <span key={t} onClick={() => removeTime(t)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 10, fontSize: 13, fontWeight: 800, color: '#fff', background: `${tm.color}22`, border: `1px solid ${tm.color}`, cursor: 'pointer' }}>
                {t} <Icon name="x" size={12} color="#fff" />
              </span>
            ))}
          </div>
          {!day && times.length > 0 && <div style={{ fontSize: 11, color: '#EF4444', marginTop: 6 }}>Укажите дату для таймингов</div>}
        </div>

        {/* Карты */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
            <Lbl>Искомые карты *</Lbl>
            <span style={{ fontSize: 11, color: maps.length ? '#6B7280' : '#EF4444' }}>{maps.length ? `${maps.length} выбрано` : 'мин. 1'}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
            {MAPS.map(mp => <MapTile key={mp} map={mp} selected={maps.includes(mp)} color={tm.color} onClick={() => toggleMap(mp)} />)}
          </div>
        </div>

        {/* Сервер */}
        <div>
          <Lbl>Сервер *</Lbl>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
            {SERVERS.map(s => {
              const sel = server === s.code
              return (
                <button key={s.code} onClick={() => setServer(sel ? '' : s.code)} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 12px', borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: sel ? '#fff' : '#9CA3AF', background: sel ? `${tm.color}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${sel ? tm.color : 'transparent'}` }}>
                  <Flag code={s.flag} size={14} /> {s.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <Lbl>Комментарий</Lbl>
          <textarea value={note} onChange={e => setNote(e.target.value.slice(0, 300))} rows={2} placeholder="Например: ищем равный по силе клан" style={{ ...inp, resize: 'none', lineHeight: 1.45 }} />
        </div>

        {!valid && (
          <div style={{ fontSize: 12, color: '#EF4444', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <Icon name="warning" size={13} color="#EF4444" />Укажите: {missing.join(', ')}
          </div>
        )}
        <button onClick={submit} disabled={saving || !valid} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: saving || !valid ? 'not-allowed' : 'pointer', fontSize: 15, fontWeight: 800, color: valid ? '#fff' : '#4B5563', background: valid ? `linear-gradient(135deg, ${tm.color}, ${tm.g2})` : 'rgba(255,255,255,0.06)', boxShadow: valid ? `0 8px 26px ${tm.color}44` : 'none', opacity: saving ? 0.7 : 1, transition: 'all .2s' }}>
          {saving ? 'Размещаем…' : times.length > 1 ? `Разместить ${times.length} заявки` : 'Разместить заявку'}
        </button>
      </div>
    </Sheet>
  )
}

function MapTile({ map, selected, color, onClick }: { map: string; selected: boolean; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0, transform: selected ? 'translateY(-2px)' : 'none', transition: 'transform .15s', boxShadow: selected ? `0 8px 20px ${color}44` : '0 2px 8px rgba(0,0,0,0.3)' }}>
      <div style={{ position: 'absolute', inset: 0, background: `url(${mapImg(map)}) center/cover`, transform: selected ? 'scale(1.08)' : 'scale(1)', transition: 'transform .2s' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)' }} />
      {selected && <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: `2.5px solid ${color}`, background: `${color}22` }} />}
      {selected && <div style={{ position: 'absolute', top: 6, right: 6, width: 20, height: 20, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={13} color="#fff" /></div>}
      <span style={{ position: 'absolute', left: 8, right: 8, bottom: 7, fontSize: 11, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{mapLabel(map)}</span>
    </button>
  )
}

function Sheet({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const sheet = useSheetDrag(onClose)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div {...sheet.panelProps} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: '#0a0a0f', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.08)', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div {...sheet.handleProps} style={{ ...sheet.handleProps.style, padding: '4px 0 14px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}

function Loader() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}><motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#A855F7' }} /></div>
}
function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: 'center', padding: '46px 20px', color: '#6B7280', fontSize: 14 }}>{text}</div>
}
function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 }}>{children}</div>
}
const inp: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', colorScheme: 'dark' }
