'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { useClanRealtime } from '@/hooks/useClanRealtime'
import { connectSocket } from '@/lib/socket'
import { avatarBg } from '@/lib/avatar'
import { useSheetDrag } from '@/lib/useSheetDrag'
import { SearchRadar } from '@/components/match/SearchRadar'
import { Flag } from '@/components/ui/Flag'
import { Icon } from '@/components/ui/Icon'
import {
  ACCENT, CARD, clanGrad, clanTier, ClanAvatar, GlassCard,
  PageHeader, StatTile, NavCard, Tabs as KitTabs, Loader, Empty,
} from '@/components/clans/kit'

// ── Types ───────────────────────────────────────────────────────────────────
type Role = 'leader' | 'officer' | 'member'
interface Member {
  userId: number; role: Role; joinedAt: string
  nickname: string; avatarUrl: string | null; elo: number
  region: string | null; isVerified: boolean
}
interface ClanDetail {
  id: number; tag: string; name: string; description: string | null
  avatarUrl: string | null; region: string | null; language: string | null
  rating: number; wins: number; losses: number; winRate: number
  leaderId: number; createdAt: string
  memberCount: number; position: number; myRole: Role | null
  pendingRequests: number; members: Member[]; recentMatches: any[]
}
interface ClanCard {
  id: number; tag: string; name: string; avatarUrl: string | null
  region: string | null; language: string | null; rating: number
  wins: number; losses: number; matchesPlayed: number; winRate: number
  memberCount: number; rank?: number
}

const REGIONS = ['ru', 'ua', 'kz', 'by', 'uz', 'az', 'am', 'ge', 'kg', 'tj', 'tm', 'md', 'tr', 'de', 'us', 'gb', 'fr', 'pl', 'br', 'cn']
const LANGS = [
  { code: 'ru', label: 'Русский' }, { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' }, { code: 'kz', label: 'Қазақша' },
]
const MAPS = ['PRISON', 'SANDSTONE', 'PROVINCE', 'BREEZE', 'HANAMI', 'RUST', 'DUNE']
const mapImg = (m: string) => `/maps/${m.charAt(0) + m.slice(1).toLowerCase()}.webp`

const ROLE_META: Record<Role, { label: string; color: string }> = {
  leader: { label: 'Лидер', color: '#FFD700' },
  officer: { label: 'Со-Лидер', color: '#60A5FA' },
  member: { label: 'Участник', color: '#9CA3AF' },
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function ClansPage() {
  return (
    <RequireRegistration>
      <ClansInner />
    </RequireRegistration>
  )
}

type Tab = 'my' | 'browse' | 'ranking'

function ClansInner() {
  const { user } = useAuthStore()
  const [tab, setTab] = useState<Tab>('my')
  const [myClan, setMyClan] = useState<ClanDetail | null>(null)
  const [loadingMine, setLoadingMine] = useState(true)

  const loadMine = useCallback(async () => {
    try {
      const r = await api.get('/clans/my')
      setMyClan(r.data || null)
    } catch { setMyClan(null) }
    finally { setLoadingMine(false) }
  }, [])

  useEffect(() => { loadMine() }, [loadMine])

  // Realtime: обновляем «Мой клан» при любых изменениях клана
  useClanRealtime({ clanId: myClan?.id ?? null }, () => loadMine())

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
      {/* Header */}
      <PageHeader title="Кланы" subtitle="Собирай команду · побеждай вместе" icon="shield" g1={ACCENT} g2="#0EA5E9" />

      {/* Tabs */}
      <KitTabs<Tab>
        tabs={[['my', 'Мой клан'], ['browse', 'Обзор'], ['ranking', 'Рейтинг']]}
        value={tab} onChange={setTab} g1={ACCENT} g2="#0EA5E9" layoutId="clanTab"
      />

      <AnimatePresence mode="wait">
        <motion.div key={tab}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}>
          {tab === 'my' && (
            loadingMine
              ? <Loader />
              : myClan
                ? <MyClanView clan={myClan} meId={user?.id} reload={loadMine} />
                : <CreateClanView onCreated={(c) => { setMyClan(c); }} />
          )}
          {tab === 'browse' && <BrowseView myClanId={myClan?.id ?? null} onJoined={loadMine} />}
          {tab === 'ranking' && <RankingView myClanId={myClan?.id ?? null} />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  CREATE
// ════════════════════════════════════════════════════════════════════════════
function CreateClanView({ onCreated }: { onCreated: (c: ClanDetail) => void }) {
  const [tag, setTag] = useState('')
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [region, setRegion] = useState<string>('')
  const [language, setLanguage] = useState<string>('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const { user } = useAuthStore()
  const CLAN_COST = 4990
  const coins = user?.coins ?? 0
  const enoughCoins = coins >= CLAN_COST
  const tagOk = /^[A-Za-z0-9]{2,5}$/.test(tag)
  const nameOk = name.trim().length >= 2 && name.trim().length <= 50
  const canSubmit = tagOk && nameOk && enoughCoins && !saving

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true); setErr(null)
    try {
      const fd = new FormData(); fd.append('avatar', file)
      const token = localStorage.getItem('condr_faceit_token')
      const res = await fetch('/api/clans/avatar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Ошибка загрузки')
      setAvatarUrl((await res.json()).avatarUrl)
    } catch (e: any) { setErr(e?.message || 'Ошибка загрузки') }
    finally { setUploading(false) }
  }

  const submit = async () => {
    setSaving(true); setErr(null)
    try {
      const r = await api.post('/clans', { tag, name: name.trim(), description: desc.trim() || undefined, avatarUrl: avatarUrl || undefined, region: region || undefined, language: language || undefined })
      onCreated(r.data)
    } catch (e: any) { setErr(e?.response?.data?.message || 'Не удалось создать клан') }
    finally { setSaving(false) }
  }

  return (
    <div>
      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '14px 0 22px', position: 'relative' }}>
        <div style={{ position: 'relative', width: 78, height: 78, margin: '0 auto 14px' }}>
          <motion.div animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.12, 1] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ position: 'absolute', inset: -10, borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}55, transparent 70%)`, pointerEvents: 'none' }} />
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 18 }}
            style={{ position: 'relative', width: 78, height: 78, borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${ACCENT}, #0EA5E9)`, boxShadow: `0 12px 36px ${ACCENT}55, inset 0 1px 0 rgba(255,255,255,0.25)` }}>
            <Icon name="shield" size={40} color="#fff" />
          </motion.div>
        </div>
        <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.02em' }}>Создай свой клан</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 5, maxWidth: 300, marginInline: 'auto' }}>
          Объединяй игроков, играй клановые бои и поднимайся в рейтинге кланов
        </div>
      </div>

      <div style={{ background: CARD, borderRadius: 20, border: '1px solid rgba(255,255,255,0.06)', padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={() => fileRef.current?.click()} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', position: 'relative' }}>
            <ClanAvatar url={avatarUrl} tag={tag || '?'} size={64} rating={1000} />
            <div style={{ position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0a0a0f' }}>
              <Icon name="camera" size={13} color="#fff" />
            </div>
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Эмблема клана</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{uploading ? 'Загрузка…' : 'JPG, PNG или WEBP · до 5 МБ'}</div>
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={upload} style={{ display: 'none' }} />
        </div>

        <Field label="Тэг" hint="2–5 символов · латиница и цифры">
          <input value={tag} onChange={e => setTag(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 5))}
            placeholder="CnDr" maxLength={5}
            style={inputStyle(tag.length > 0 && !tagOk)} />
        </Field>

        <Field label="Название" hint={`${name.length}/50`}>
          <input value={name} onChange={e => setName(e.target.value.slice(0, 50))} placeholder="Condr Esports"
            style={inputStyle(name.length > 0 && !nameOk)} />
        </Field>

        <Field label="Описание" hint={`${desc.length}/500`}>
          <textarea value={desc} onChange={e => setDesc(e.target.value.slice(0, 500))} placeholder="Расскажите о клане, требованиях и целях…"
            rows={3} style={{ ...inputStyle(false), resize: 'none', lineHeight: 1.45 }} />
        </Field>

        <Field label="Регион">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REGIONS.map(r => (
              <button key={r} onClick={() => setRegion(region === r ? '' : r)}
                style={{ padding: 4, borderRadius: 8, cursor: 'pointer', background: region === r ? `${ACCENT}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${region === r ? ACCENT : 'transparent'}`, lineHeight: 0 }}>
                <Flag code={r} size={18} />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Язык">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => setLanguage(language === l.code ? '' : l.code)}
                style={{ padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: language === l.code ? '#fff' : '#9CA3AF', background: language === l.code ? `${ACCENT}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${language === l.code ? ACCENT : 'transparent'}` }}>
                {l.label}
              </button>
            ))}
          </div>
        </Field>

        {err && <div style={{ fontSize: 13, color: '#EF4444', fontWeight: 600 }}>{err}</div>}

        {/* Цена создания */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 13, background: enoughCoins ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.1)', border: `1px solid ${enoughCoins ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.3)'}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="coins" size={18} color={enoughCoins ? '#F59E0B' : '#EF4444'} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>Стоимость создания</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 900, color: enoughCoins ? '#fff' : '#EF4444' }}>{CLAN_COST.toLocaleString()}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#6B7280' }}>COIN</span>
          </div>
        </div>
        {!enoughCoins && <div style={{ fontSize: 12, color: '#EF4444', textAlign: 'center', marginTop: -6 }}>Не хватает {(CLAN_COST - coins).toLocaleString()} COIN (у вас {coins.toLocaleString()})</div>}

        <button onClick={submit} disabled={!canSubmit}
          style={{
            width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontSize: 15, fontWeight: 800, color: '#fff',
            background: canSubmit ? `linear-gradient(135deg, ${ACCENT}, #0EA5E9)` : 'rgba(255,255,255,0.06)',
            boxShadow: canSubmit ? `0 8px 26px ${ACCENT}44` : 'none', opacity: canSubmit ? 1 : 0.5,
            transition: 'all .2s',
          }}>
          {saving ? 'Создаём…' : enoughCoins ? `Создать за ${CLAN_COST.toLocaleString()} COIN` : 'Недостаточно COIN'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: '#4B5563' }}>{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function inputStyle(error: boolean): React.CSSProperties {
  return {
    width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14, color: '#fff',
    background: 'rgba(255,255,255,0.04)', border: `1px solid ${error ? '#EF4444' : 'rgba(255,255,255,0.08)'}`,
    outline: 'none',
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  MY CLAN
// ════════════════════════════════════════════════════════════════════════════
function MyClanView({ clan, meId, reload }: { clan: ClanDetail; meId?: number; reload: () => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const isLeader = clan.myRole === 'leader'
  const isStaff = clan.myRole === 'leader' || clan.myRole === 'officer'
  const [g1, g2] = clanGrad(clan.rating)

  const act = async (fn: () => Promise<any>) => {
    if (busy) return
    setBusy(true)
    try { await fn(); reload() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBusy(false) }
  }

  const leave = () => { if (confirm('Покинуть клан?')) act(() => api.post('/clans/leave')) }
  const disband = () => { if (confirm('Распустить клан? Это действие необратимо.')) act(() => api.delete(`/clans/${clan.id}`)) }

  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const changeAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploadingAvatar(true)
    try {
      const fd = new FormData(); fd.append('avatar', file)
      const token = localStorage.getItem('condr_faceit_token')
      const res = await fetch('/api/clans/avatar', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Ошибка загрузки')
      const { avatarUrl } = await res.json()
      await api.patch(`/clans/${clan.id}`, { avatarUrl })
      reload()
    } catch (e: any) { alert(e?.message || 'Ошибка загрузки') } finally { setUploadingAvatar(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Hero card */}
      <GlassCard g1={g1} g2={g2} padding={20}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          {isLeader ? (
            <button onClick={() => fileRef.current?.click()} style={{ position: 'relative', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
              <ClanAvatar url={clan.avatarUrl} tag={clan.tag} size={74} rating={clan.rating} ring glow />
              <div style={{ position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #0a0a0f', zIndex: 2 }}>
                <Icon name="camera" size={14} color="#fff" />
              </div>
              {uploadingAvatar && <div style={{ position: 'absolute', inset: 0, borderRadius: 19, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700, zIndex: 3 }}>…</div>}
              <input ref={fileRef} type="file" accept="image/*" onChange={changeAvatar} style={{ display: 'none' }} />
            </button>
          ) : (
            <ClanAvatar url={clan.avatarUrl} tag={clan.tag} size={74} rating={clan.rating} ring glow />
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: g1, background: `${g1}1f`, padding: '2px 8px', borderRadius: 7, letterSpacing: '0.02em' }}>[{clan.tag}]</span>
              <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${g1}, ${g2})`, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.06em', boxShadow: `0 3px 10px ${g1}55` }}>{clanTier(clan.rating).label}</span>
              {clan.region && <Flag code={clan.region} size={15} />}
            </div>
            <div style={{ fontSize: 21, fontWeight: 900, letterSpacing: '-0.02em', marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textShadow: `0 2px 20px ${g1}44` }}>{clan.name}</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3 }}>
              Создан {new Date(clan.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
        {clan.description && (
          <div style={{ marginTop: 14, fontSize: 13, color: '#B0B0B8', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{clan.description}</div>
        )}
      </GlassCard>

      {/* Stat tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <StatTile big label="Рейтинг клана" numeric={clan.rating} value="" color={g1} icon="trophy" delay={0.05} />
        <StatTile big label="Место в топе" value={`#${clan.position}`} color="#F59E0B" icon="crown" delay={0.1} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
        <StatTile label="Участники" value={String(clan.memberCount)} color="#60A5FA" icon="users" delay={0.15} />
        <StatTile label="W / L" value={`${clan.wins}/${clan.losses}`} color="#22C55E" icon="swords" delay={0.2} />
        <StatTile label="Винрейт" value={`${clan.winRate}%`} color={clan.winRate >= 50 ? '#22C55E' : '#EF4444'} icon="trendingUp" delay={0.25} />
      </div>

      {/* Поиск кланового боя 5х5 */}
      <ClanSearch clan={clan} isStaff={isStaff} />

      {/* Pending requests (staff) */}
      {isStaff && clan.pendingRequests > 0 && (
        <RequestsPanel clanId={clan.id} count={clan.pendingRequests} reload={reload} />
      )}

      {/* Members */}
      <div style={{ background: CARD, borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px 10px', fontSize: 13, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
          <span>Состав</span><span style={{ color: '#4B5563' }}>{clan.memberCount}</span>
        </div>
        {clan.members.map(m => (
          <MemberRow key={m.userId} m={m} clan={clan} meId={meId} isLeader={isLeader} isStaff={isStaff} act={act} />
        ))}
      </div>

      {/* Navigation */}
      <NavCard icon="timer"  title="Расписание"           sub="Турниры, праки и события"      color="#60A5FA" delay={0.05} onClick={() => router.push(`/clans/${clan.id}/calendar`)} />
      <NavCard icon="swords" title="Праки"                sub="Найти соперника на тренировку" color="#A855F7" delay={0.1}  onClick={() => router.push(`/clans/${clan.id}/scrims`)} />
      <NavCard icon="trophy" title="История клановых боёв" sub="Все сыгранные матчи 5×5"        color="#E8092E" delay={0.15} onClick={() => router.push(`/clans/${clan.id}/battles`)} />

      {/* Confirmed praks */}
      <ConfirmedPraks clanId={clan.id} />

      {/* Actions */}
      <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
        {isLeader
          ? <button onClick={disband} style={actionBtn('rgba(239,68,68,0.12)', '#EF4444')}>Распустить</button>
          : <button onClick={leave} style={actionBtn('rgba(239,68,68,0.12)', '#EF4444')}>Покинуть клан</button>}
      </div>
    </div>
  )
}

// Подтверждённые праки (принятые матчи mode=scrim) с ready-check 5+5.
function ConfirmedPraks({ clanId }: { clanId: number }) {
  const [praks, setPraks] = useState<ClanMatchDto[]>([])
  // прак считается несостоявшимся, если тайминг прошёл (+10 мин грейс), а матч не начался
  const notExpired = (m: ClanMatchDto) => !m.scheduledAt || (new Date(m.scheduledAt).getTime() + 10 * 60 * 1000) > Date.now()
  const load = useCallback(async () => {
    try {
      const ms: ClanMatchDto[] = (await api.get(`/clans/${clanId}/matches`)).data
      setPraks(ms.filter(m => m.mode === 'scrim' && m.status === 'accepted' && notExpired(m)))
    } catch {}
  }, [clanId])
  useEffect(() => { load() }, [load])
  // периодически переоценим (тайминг мог пройти, пока экран открыт)
  useEffect(() => { const t = setInterval(() => setPraks(p => p.filter(notExpired)), 30000); return () => clearInterval(t) }, [])
  useClanRealtime({ clanId }, () => load())

  if (praks.length === 0) return null
  return (
    <div style={{ background: CARD, borderRadius: 18, border: '1px solid rgba(168,85,247,0.2)', padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: '#A855F7', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 7 }}>
        <Icon name="swords" size={15} color="#A855F7" /> Подтверждённые праки
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {praks.map(m => <PracCard key={m.id} m={m} clanId={clanId} />)}
      </div>
    </div>
  )
}

function PracCard({ m, clanId }: { m: ClanMatchDto; clanId: number }) {
  const router = useRouter()
  const opp = m.clanA?.id === clanId ? m.clanB : m.clanA
  const when = m.scheduledAt ? new Date(m.scheduledAt).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Время не указано'
  const [st, setSt] = useState<any>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try { const r = await api.get(`/matches/prac/${m.id}/status`); setSt(r.data); if (r.data?.matchId) router.push(`/match/${r.data.matchId}`) } catch {}
  }, [m.id, router])
  useEffect(() => { refresh(); const t = setInterval(refresh, 10000); return () => clearInterval(t) }, [refresh])
  useClanRealtime({ clanId }, (p) => { if (p?.reason === 'prac_ready' && p.scrimId === m.id) refresh() })
  useEffect(() => {
    const s = connectSocket(); const onFound = (d: { matchId: number }) => router.push(`/match/${d.matchId}`)
    s.on('match_found', onFound); return () => { s.off('match_found', onFound) }
  }, [router])

  const ready = async () => { setBusy(true); try { const r = await api.post(`/matches/prac/${m.id}/ready`); if (r.data?.matchId) router.push(`/match/${r.data.matchId}`); else refresh() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBusy(false) } }
  const unready = async () => { setBusy(true); try { await api.post(`/matches/prac/${m.id}/unready`); refresh() } catch {} finally { setBusy(false) } }

  const windowOpen = st?.windowOpen
  return (
    <div style={{ borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: 13 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: avatarBg(opp?.avatarUrl) ? avatarBg(opp?.avatarUrl)! : 'linear-gradient(135deg,#374151,#1f2937)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
          {!opp?.avatarUrl && <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{(opp?.tag || '?').slice(0, 2)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}><span style={{ color: '#6B7280', fontWeight: 600 }}>vs </span>[{opp?.tag}] {opp?.name}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{when}{m.map ? ` · ${m.map.charAt(0) + m.map.slice(1).toLowerCase()}` : ''}</div>
        </div>
        {st && <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#A855F7' }}>{st.readyA ?? 0}+{st.readyB ?? 0}</div>
          <div style={{ fontSize: 9, color: '#6B7280', textTransform: 'uppercase' }}>готовы /10</div>
        </div>}
      </div>
      {windowOpen ? (
        st?.iAmReady ? (
          <button onClick={unready} disabled={busy} style={{ width: '100%', marginTop: 11, padding: '11px 0', borderRadius: 11, border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.12)', color: '#22C55E', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>✓ Вы готовы · отменить</button>
        ) : (
          <button onClick={ready} disabled={busy} style={{ width: '100%', marginTop: 11, padding: '12px 0', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg, #A855F7, #E8092E)', color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', boxShadow: '0 6px 18px rgba(168,85,247,0.35)' }}>{busy ? '…' : 'Подтвердить готовность'}</button>
        )
      ) : (
        <div style={{ fontSize: 11, color: '#4B5563', marginTop: 10, textAlign: 'center' }}>Готовность откроется за 5 минут до начала</div>
      )}
    </div>
  )
}

// Поиск кланового боя 5х5: выбор состава лидером/со-лидером → очередь → экран ожидания
function ClanSearch({ clan, isStaff }: { clan: ClanDetail; isStaff: boolean }) {
  const router = useRouter()
  const [searching, setSearching] = useState(false)
  const [picking, setPicking] = useState(false)
  const pickSheet = useSheetDrag(() => setPicking(false))
  const [roster, setRoster] = useState<number[]>([])
  const [busy, setBusy] = useState(false)

  const refreshStatus = useCallback(async () => {
    try { const r = await api.get('/matches/clan-queue/status'); setSearching(!!r.data?.searching); if (r.data?.roster) setRoster(r.data.roster) } catch {}
  }, [])
  useEffect(() => { refreshStatus() }, [refreshStatus])
  useClanRealtime({ clanId: clan.id }, (p) => {
    if (p?.reason === 'searching') setSearching(true)
    if (p?.reason === 'search_cancelled') setSearching(false)
    if (p?.reason === 'match_found' && p.matchId) router.push(`/match/${p.matchId}`)
  })
  // личный сокет на match_found (на случай, если игрок открыл клан-страницу)
  useEffect(() => {
    const s = connectSocket()
    const onFound = (d: { matchId: number }) => router.push(`/match/${d.matchId}`)
    s.on('match_found', onFound)
    return () => { s.off('match_found', onFound) }
  }, [router])

  const startPick = () => { setRoster(clan.members.slice(0, 5).map(m => m.userId)); setPicking(true) }
  const toggle = (uid: number) => setRoster(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : (prev.length >= 5 ? prev : [...prev, uid]))
  const confirm = async () => {
    if (roster.length !== 5) return
    setBusy(true)
    try { await api.post('/matches/clan-queue/join', { memberIds: roster }); setSearching(true); setPicking(false) }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBusy(false) }
  }
  const cancel = async () => {
    setBusy(true)
    try { await api.post('/matches/clan-queue/leave'); setSearching(false) } catch {} finally { setBusy(false) }
  }

  if (searching) {
    // Наш состав (5) — заполненные слоты, соперник (5) — пустые. Тот же радар, что в 2х2/5х5.
    const memberById = Object.fromEntries(clan.members.map(m => [m.userId, m]))
    const ourSlots = roster.map(uid => {
      const mm = memberById[uid]
      return { avatarUrl: mm?.avatarUrl ?? null, name: mm?.nickname || '...' }
    })
    const slots = [...ourSlots, ...Array.from({ length: Math.max(0, 10 - ourSlots.length) }, () => null)]
    return (
      <SearchRadar
        slots={slots}
        filled={ourSlots.length}
        total={10}
        title="Поиск соперника"
        subtitle="Подбираем клан вашего уровня для боя 5×5"
        onCancel={isStaff ? cancel : undefined}
        cancelLabel="Отменить поиск"
      />
    )
  }

  return (
    <>
      {isStaff ? (
        <motion.button whileTap={{ scale: 0.98 }} onClick={startPick} style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, width: '100%', padding: '16px 0', borderRadius: 16, border: 'none', cursor: clan.memberCount >= 5 ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 900, color: '#fff', background: 'linear-gradient(135deg, #E8092E, #A855F7)', boxShadow: '0 8px 30px rgba(232,9,46,0.45), inset 0 1px 0 rgba(255,255,255,0.18)', opacity: clan.memberCount >= 5 ? 1 : 0.5, letterSpacing: '0.01em' }} disabled={clan.memberCount < 5}>
          {clan.memberCount >= 5 && (
            <motion.div animate={{ x: ['-120%', '220%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2.5, ease: 'linear' }}
              style={{ position: 'absolute', top: 0, bottom: 0, width: '34%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', pointerEvents: 'none' }} />
          )}
          <Icon name="swords" size={18} color="#fff" /> {clan.memberCount >= 5 ? 'Найти бой 5×5' : 'Нужно 5 участников'}
        </motion.button>
      ) : null}

      <AnimatePresence>
        {picking && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPicking(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <motion.div {...pickSheet.panelProps} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={e => e.stopPropagation()}
              style={{ width: '100%', maxWidth: 520, background: '#0a0a0f', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.08)', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
              <div {...pickSheet.handleProps} style={{ ...pickSheet.handleProps.style, padding: '4px 0 14px' }}>
                <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Состав на бой</div>
              <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Выберите ровно 5 игроков ({roster.length}/5)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {clan.members.map(m => {
                  const sel = roster.includes(m.userId)
                  return (
                    <button key={m.userId} onClick={() => toggle(m.userId)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, border: `1px solid ${sel ? '#E8092E' : 'rgba(255,255,255,0.06)'}`, background: sel ? 'rgba(232,9,46,0.12)' : CARD, cursor: 'pointer', textAlign: 'left' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: avatarBg(m.avatarUrl) ? avatarBg(m.avatarUrl)! : 'linear-gradient(135deg,#374151,#1f2937)', border: '1px solid rgba(255,255,255,0.08)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nickname}</div>
                        <div style={{ fontSize: 11, color: '#6B7280' }}>{ROLE_META[m.role].label} · {m.elo} ELO</div>
                      </div>
                      <div style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${sel ? '#E8092E' : 'rgba(255,255,255,0.2)'}`, background: sel ? '#E8092E' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {sel && <Icon name="check" size={13} color="#fff" />}
                      </div>
                    </button>
                  )
                })}
              </div>
              <button onClick={confirm} disabled={roster.length !== 5 || busy} style={{ width: '100%', marginTop: 16, padding: '14px 0', borderRadius: 14, border: 'none', cursor: roster.length === 5 ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 800, color: '#fff', background: roster.length === 5 ? 'linear-gradient(135deg, #E8092E, #A855F7)' : 'rgba(255,255,255,0.06)', opacity: roster.length === 5 ? 1 : 0.5 }}>
                {busy ? 'Запускаем поиск…' : 'Подтвердить состав и искать'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function actionBtn(bg: string, color: string): React.CSSProperties {
  return { flex: 1, padding: '12px 0', borderRadius: 13, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: bg, color }
}

function MemberRow({ m, clan, meId, isLeader, isStaff, act }: {
  m: Member; clan: ClanDetail; meId?: number; isLeader: boolean; isStaff: boolean; act: (fn: () => Promise<any>) => void
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const rm = ROLE_META[m.role]
  const isMe = m.userId === meId
  const canManage = isStaff && !isMe && m.role !== 'leader' && !(clan.myRole === 'officer' && m.role === 'officer')

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 16px' }}>
        <button onClick={() => router.push(`/player/${m.userId}`)} style={{ display: 'flex', alignItems: 'center', gap: 11, flex: 1, minWidth: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: avatarBg(m.avatarUrl) ? avatarBg(m.avatarUrl)! : 'linear-gradient(135deg,#374151,#1f2937)', border: '1px solid rgba(255,255,255,0.08)' }} />
          <div style={{ minWidth: 0, textAlign: 'left' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{m.nickname}</span>
              {m.isVerified && <Icon name="verified" size={13} color="#60A5FA" />}
            </div>
            <div style={{ fontSize: 11, color: rm.color, fontWeight: 700, marginTop: 1 }}>{rm.label} · {m.elo} ELO</div>
          </div>
        </button>
        {canManage && (
          <button onClick={() => setOpen(o => !o)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 9, width: 30, height: 30, cursor: 'pointer', color: '#9CA3AF', fontSize: 18, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⋯</button>
        )}
      </div>
      <AnimatePresence>
        {open && canManage && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: 8, padding: '0 16px 12px', flexWrap: 'wrap' }}>
              {isLeader && m.role === 'member' && (
                <MiniBtn onClick={() => { setOpen(false); act(() => api.post(`/clans/${clan.id}/officer`, { userId: m.userId, value: true })) }} color="#60A5FA">Назначить Со-Лидером</MiniBtn>
              )}
              {isLeader && m.role === 'officer' && (
                <MiniBtn onClick={() => { setOpen(false); act(() => api.post(`/clans/${clan.id}/officer`, { userId: m.userId, value: false })) }} color="#9CA3AF">Снять Со-Лидера</MiniBtn>
              )}
              {isLeader && (
                <MiniBtn onClick={() => { if (confirm(`Передать лидерство игроку ${m.nickname}?`)) { setOpen(false); act(() => api.post(`/clans/${clan.id}/transfer`, { userId: m.userId })) } }} color="#FFD700">Передать лидерство</MiniBtn>
              )}
              <MiniBtn onClick={() => { if (confirm(`Исключить ${m.nickname}?`)) { setOpen(false); act(() => api.post(`/clans/${clan.id}/kick`, { userId: m.userId })) } }} color="#EF4444">Исключить</MiniBtn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MiniBtn({ onClick, color, children }: { onClick: () => void; color: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 12px', borderRadius: 9, border: `1px solid ${color}33`, background: `${color}14`, color, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{children}</button>
  )
}

function RequestsPanel({ clanId, count, reload }: { clanId: number; count: number; reload: () => void }) {
  const [open, setOpen] = useState(false)
  const [reqs, setReqs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try { setReqs((await api.get(`/clans/${clanId}/requests`)).data) } catch {} finally { setLoading(false) }
  }
  const toggle = () => { const n = !open; setOpen(n); if (n) load() }
  const respond = async (reqId: number, accept: boolean) => {
    try { await api.post(`/clans/requests/${reqId}/respond`, { accept }); await load(); reload() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }

  return (
    <div style={{ background: `linear-gradient(135deg, ${ACCENT}14, transparent)`, borderRadius: 16, border: `1px solid ${ACCENT}33`, overflow: 'hidden' }}>
      <button onClick={toggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px', background: 'none', border: 'none', cursor: 'pointer' }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${ACCENT}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="users" size={16} color={ACCENT} />
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', flex: 1, textAlign: 'left' }}>Заявки на вступление</span>
        <span style={{ fontSize: 13, fontWeight: 800, color: ACCENT, background: `${ACCENT}22`, padding: '2px 9px', borderRadius: 20 }}>{count}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
            {loading ? <div style={{ padding: 16, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Загрузка…</div>
              : reqs.length === 0 ? <div style={{ padding: 16, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Нет заявок</div>
                : reqs.map(r => (
                  <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 11, background: avatarBg(r.avatarUrl) ? avatarBg(r.avatarUrl)! : 'linear-gradient(135deg,#374151,#1f2937)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.nickname}</div>
                      <div style={{ fontSize: 11, color: '#6B7280' }}>{r.elo} ELO</div>
                    </div>
                    <button onClick={() => respond(r.id, true)} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', background: `${ACCENT}22`, color: ACCENT, fontSize: 16 }}>✓</button>
                    <button onClick={() => respond(r.id, false)} style={{ width: 32, height: 32, borderRadius: 9, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.14)', color: '#EF4444', fontSize: 16 }}>✕</button>
                  </div>
                ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  BROWSE
// ════════════════════════════════════════════════════════════════════════════
function BrowseView({ myClanId, onJoined }: { myClanId: number | null; onJoined: () => void }) {
  const [q, setQ] = useState('')
  const [region, setRegion] = useState('')
  const [language, setLanguage] = useState('')
  const [minRating, setMinRating] = useState(0)
  const [minMembers, setMinMembers] = useState(0)
  const [sort, setSort] = useState<'rating' | 'members' | 'new'>('rating')
  const [showFilters, setShowFilters] = useState(false)
  const [list, setList] = useState<ClanCard[]>([])
  const [loading, setLoading] = useState(true)
  const [requested, setRequested] = useState<Set<number>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: any = { sort }
      if (q.trim()) params.q = q.trim()
      if (region) params.region = region
      if (language) params.language = language
      if (minRating) params.minRating = minRating
      if (minMembers) params.minMembers = minMembers
      setList((await api.get('/clans', { params })).data)
    } catch {} finally { setLoading(false) }
  }, [q, region, language, minRating, minMembers, sort])

  useEffect(() => { const t = setTimeout(load, 300); return () => clearTimeout(t) }, [load])

  const join = async (id: number) => {
    try { await api.post(`/clans/${id}/request`); setRequested(s => new Set(s).add(id)) }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }

  const activeFilters = (region ? 1 : 0) + (language ? 1 : 0) + (minRating ? 1 : 0) + (minMembers ? 1 : 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Search + filter toggle */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, background: CARD, borderRadius: 14, border: '1px solid rgba(255,255,255,0.06)', padding: '11px 14px' }}>
          <Icon name="search" size={18} color="#6B7280" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по тэгу или названию"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14 }} />
        </div>
        <button onClick={() => setShowFilters(f => !f)} style={{ position: 'relative', width: 46, borderRadius: 14, border: `1px solid ${activeFilters || showFilters ? ACCENT : 'rgba(255,255,255,0.06)'}`, background: activeFilters || showFilters ? `${ACCENT}1a` : CARD, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="barChart" size={18} color={activeFilters || showFilters ? ACCENT : '#9CA3AF'} />
          {activeFilters > 0 && <span style={{ position: 'absolute', top: -5, right: -5, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: ACCENT, color: '#fff', fontSize: 10, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{activeFilters}</span>}
        </button>
      </div>

      {/* Region filter */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
        <FilterChip active={region === ''} onClick={() => setRegion('')}>Все</FilterChip>
        {REGIONS.map(r => (
          <button key={r} onClick={() => setRegion(region === r ? '' : r)}
            style={{ padding: 6, borderRadius: 9, cursor: 'pointer', flexShrink: 0, lineHeight: 0, background: region === r ? `${ACCENT}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${region === r ? ACCENT : 'transparent'}` }}>
            <Flag code={r} size={16} />
          </button>
        ))}
      </div>

      {/* Advanced filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ background: CARD, borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <FilterRow label="Сортировка">
                {([['rating', 'По рейтингу'], ['members', 'По составу'], ['new', 'Новые']] as ['rating' | 'members' | 'new', string][]).map(([s, l]) => (
                  <Pill key={s} active={sort === s} onClick={() => setSort(s)}>{l}</Pill>
                ))}
              </FilterRow>
              <FilterRow label="Язык">
                <Pill active={language === ''} onClick={() => setLanguage('')}>Любой</Pill>
                {LANGS.map(l => <Pill key={l.code} active={language === l.code} onClick={() => setLanguage(language === l.code ? '' : l.code)}>{l.label}</Pill>)}
              </FilterRow>
              <FilterRow label="Рейтинг от">
                {[0, 1000, 1200, 1400, 1600].map(v => <Pill key={v} active={minRating === v} onClick={() => setMinRating(v)}>{v === 0 ? 'Любой' : v}</Pill>)}
              </FilterRow>
              <FilterRow label="Участников от">
                {[0, 3, 5, 8].map(v => <Pill key={v} active={minMembers === v} onClick={() => setMinMembers(v)}>{v === 0 ? 'Любой' : v}</Pill>)}
              </FilterRow>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <Loader />
        : list.length === 0 ? <Empty text="Кланы не найдены" />
          : list.map((c, i) => (
            <ClanRow key={c.id} c={c} index={i}
              right={
                myClanId === c.id ? <Badge color="#22C55E">Ваш клан</Badge>
                  : myClanId ? null
                    : requested.has(c.id) ? <Badge color="#9CA3AF">Заявка</Badge>
                      : <button onClick={() => join(c.id)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #0EA5E9)`, boxShadow: `0 4px 14px ${ACCENT}33` }}>Вступить</button>
              } />
          ))}
    </div>
  )
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>{children}</div>
    </div>
  )
}
function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700, color: active ? '#fff' : '#9CA3AF', background: active ? `${ACCENT}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? ACCENT : 'transparent'}` }}>{children}</button>
  )
}
function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ padding: '7px 14px', borderRadius: 9, cursor: 'pointer', flexShrink: 0, fontSize: 13, fontWeight: 700, color: active ? '#fff' : '#9CA3AF', background: active ? `${ACCENT}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? ACCENT : 'transparent'}` }}>{children}</button>
  )
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}1c`, padding: '6px 12px', borderRadius: 9 }}>{children}</span>
}

// ════════════════════════════════════════════════════════════════════════════
//  CLAN BATTLES
// ════════════════════════════════════════════════════════════════════════════
interface ClanBrief { id: number; tag: string; name: string; avatarUrl: string | null; rating: number }
interface ClanMatchDto {
  id: number; mode: string; status: string; map: string | null; scheduledAt: string | null; createdBy: number
  clanA: ClanBrief | null; clanB: ClanBrief | null
  scoreA: number | null; scoreB: number | null; winnerClanId: number | null; ratingDelta: number | null
  createdAt: string; completedAt: string | null; isIncoming?: boolean; isOutgoing?: boolean
}
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'Ожидает ответа', color: '#F59E0B' },
  accepted: { label: 'Принят · идёт', color: '#22C55E' },
  awaiting_confirm: { label: 'Подтвердите счёт', color: '#60A5FA' },
  disputed: { label: 'Спор по счёту', color: '#EF4444' },
}

function ClanBattles({ clan, isStaff, reload }: { clan: ClanDetail; isStaff: boolean; reload: () => void }) {
  const [matches, setMatches] = useState<ClanMatchDto[]>([])
  const [history, setHistory] = useState<ClanMatchDto[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    try {
      const [m, h] = await Promise.all([
        api.get(`/clans/${clan.id}/matches`),
        api.get(`/clans/${clan.id}/history`),
      ])
      setMatches(m.data); setHistory(h.data)
    } catch {} finally { setLoading(false) }
  }, [clan.id])
  useEffect(() => { load() }, [load])
  useClanRealtime({ clanId: clan.id }, () => load())

  const refresh = () => { load(); reload() }

  return (
    <div style={{ background: CARD, borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Клановые бои</span>
        {isStaff && (
          <button onClick={() => setCreating(true)} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #0EA5E9)` }}>
            <Icon name="swords" size={14} color="#fff" /> Вызвать клан
          </button>
        )}
      </div>

      {loading ? <div style={{ padding: 20, textAlign: 'center', color: '#6B7280', fontSize: 13 }}>Загрузка…</div> : (
        <>
          {matches.length === 0 && history.length === 0 && (
            <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5, textAlign: 'center', padding: '8px 0 4px' }}>
              Пока нет боёв. {isStaff ? 'Вызовите другой клан на «Клановый бой» — победа поднимет рейтинг клана.' : 'Бои назначают глава и офицеры.'}
            </div>
          )}

          {/* Active */}
          {matches.map(m => (
            <MatchRow key={m.id} m={m} clanId={clan.id} isStaff={isStaff} refresh={refresh} />
          ))}

          {/* History */}
          {history.length > 0 && (
            <div style={{ marginTop: matches.length ? 14 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>История</div>
              {history.map(m => <MatchRow key={m.id} m={m} clanId={clan.id} isStaff={isStaff} refresh={refresh} />)}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {creating && <CreateChallengeModal clanId={clan.id} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); refresh() }} />}
      </AnimatePresence>
    </div>
  )
}

function MatchRow({ m, clanId, isStaff, refresh }: { m: ClanMatchDto; clanId: number; isStaff: boolean; refresh: () => void }) {
  const opp = m.clanA?.id === clanId ? m.clanB : m.clanA
  const completed = m.status === 'completed'
  const weAreA = m.clanA?.id === clanId
  const won = completed && m.winnerClanId === clanId
  const sm = STATUS_META[m.status]
  const [reporting, setReporting] = useState(false)

  const respond = async (accept: boolean) => {
    try { await api.post(`/clans/matches/${m.id}/respond`, { accept }); refresh() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }
  const cancel = async () => {
    if (!confirm('Отменить вызов?')) return
    try { await api.post(`/clans/matches/${m.id}/cancel`); refresh() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', padding: '11px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        {/* opponent avatar */}
        <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: avatarBg(opp?.avatarUrl) ? avatarBg(opp?.avatarUrl)! : 'linear-gradient(135deg,#374151,#1f2937)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.08)' }}>
          {!opp?.avatarUrl && <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{(opp?.tag || '?').slice(0, 2)}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
              <span style={{ color: '#6B7280', fontWeight: 600 }}>vs </span>[{opp?.tag}] {opp?.name}
            </div>
            {m.mode === 'scrim' && <span style={{ flexShrink: 0, fontSize: 9, fontWeight: 800, color: '#A855F7', background: 'rgba(168,85,247,0.16)', padding: '2px 6px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Прак</span>}
          </div>
          <div style={{ fontSize: 11, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {completed ? (
              <>
                <span style={{ fontWeight: 800, color: won ? '#22C55E' : '#EF4444' }}>
                  {won ? 'Победа' : 'Поражение'} {weAreA ? m.scoreA : m.scoreB}:{weAreA ? m.scoreB : m.scoreA}
                </span>
                {m.ratingDelta != null && <span style={{ color: won ? '#22C55E' : '#EF4444', fontWeight: 700 }}>{won ? '+' : '−'}{m.ratingDelta}</span>}
              </>
            ) : (
              <span style={{ color: sm?.color || '#9CA3AF', fontWeight: 700 }}>{sm?.label || m.status}</span>
            )}
            {m.map && <span style={{ color: '#4B5563' }}>· {m.map.charAt(0) + m.map.slice(1).toLowerCase()}</span>}
          </div>
        </div>
      </div>

      {/* Staff actions on active matches */}
      {isStaff && !completed && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {m.status === 'pending' && m.isIncoming && (
            <>
              <MiniBtn onClick={() => respond(true)} color="#22C55E">Принять</MiniBtn>
              <MiniBtn onClick={() => respond(false)} color="#EF4444">Отклонить</MiniBtn>
            </>
          )}
          {m.status === 'pending' && m.isOutgoing && (
            <MiniBtn onClick={cancel} color="#9CA3AF">Отменить вызов</MiniBtn>
          )}
          {(m.status === 'accepted' || m.status === 'awaiting_confirm' || m.status === 'disputed') && (
            <MiniBtn onClick={() => setReporting(true)} color="#60A5FA">Внести счёт</MiniBtn>
          )}
        </div>
      )}

      <AnimatePresence>
        {reporting && (
          <ReportScoreInline m={m} clanId={clanId} onClose={() => setReporting(false)} onDone={() => { setReporting(false); refresh() }} />
        )}
      </AnimatePresence>
    </div>
  )
}

function ReportScoreInline({ m, clanId, onClose, onDone }: { m: ClanMatchDto; clanId: number; onClose: () => void; onDone: () => void }) {
  const weAreA = m.clanA?.id === clanId
  const myTag = weAreA ? m.clanA?.tag : m.clanB?.tag
  const oppTag = weAreA ? m.clanB?.tag : m.clanA?.tag
  const [my, setMy] = useState('')
  const [opp, setOpp] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    const mv = parseInt(my, 10), ov = parseInt(opp, 10)
    if (isNaN(mv) || isNaN(ov) || mv === ov) { alert('Укажите счёт без ничьей'); return }
    setSaving(true)
    try {
      const scoreA = weAreA ? mv : ov
      const scoreB = weAreA ? ov : mv
      await api.post(`/clans/matches/${m.id}/report`, { scoreA, scoreB })
      onDone()
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setSaving(false) }
  }

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
      <div style={{ marginTop: 10, padding: 12, borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <ScoreInput label={`[${myTag}]`} value={my} onChange={setMy} />
          <span style={{ fontSize: 18, fontWeight: 900, color: '#4B5563' }}>:</span>
          <ScoreInput label={`[${oppTag}]`} value={opp} onChange={setOpp} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#9CA3AF', fontSize: 13, fontWeight: 700 }}>Отмена</button>
          <button onClick={submit} disabled={saving} style={{ flex: 2, padding: '9px 0', borderRadius: 10, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${ACCENT}, #0EA5E9)`, color: '#fff', fontSize: 13, fontWeight: 800 }}>{saving ? '…' : 'Отправить счёт'}</button>
        </div>
        <div style={{ fontSize: 11, color: '#4B5563', textAlign: 'center', marginTop: 8 }}>Счёт подтверждается, когда обе стороны введут одинаковый результат</div>
      </div>
    </motion.div>
  )
}

function ScoreInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 700, marginBottom: 5 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="0"
        style={{ width: 56, textAlign: 'center', padding: '10px 0', borderRadius: 10, fontSize: 20, fontWeight: 900, color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }} />
    </div>
  )
}

function CreateChallengeModal({ clanId, onClose, onCreated }: { clanId: number; onClose: () => void; onCreated: () => void }) {
  const sheet = useSheetDrag(onClose)
  const [q, setQ] = useState('')
  const [list, setList] = useState<ClanCard[]>([])
  const [opponent, setOpponent] = useState<ClanCard | null>(null)
  const [map, setMap] = useState<string>('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const params: any = {}; if (q.trim()) params.q = q.trim()
        setList((await api.get('/clans', { params })).data.filter((c: ClanCard) => c.id !== clanId))
      } catch {}
    }, 300)
    return () => clearTimeout(t)
  }, [q, clanId])

  const submit = async () => {
    if (!opponent) return
    setSaving(true)
    try {
      await api.post('/clans/matches', { opponentClanId: opponent.id, map: map || undefined })
      onCreated()
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setSaving(false) }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div {...sheet.panelProps} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: '#0a0a0f', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.08)', padding: 20, maxHeight: '85vh', overflowY: 'auto' }}>
        <div {...sheet.handleProps} style={{ ...sheet.handleProps.style, padding: '4px 0 14px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Вызвать клан на бой</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Выберите соперника. Победа влияет на рейтинг клана.</div>

        {!opponent ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: CARD, borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '10px 14px', marginBottom: 12 }}>
              <Icon name="search" size={18} color="#6B7280" />
              <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск клана по тэгу или названию" autoFocus
                style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#fff', fontSize: 14 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.length === 0 ? <div style={{ textAlign: 'center', color: '#6B7280', fontSize: 13, padding: 20 }}>Кланы не найдены</div>
                : list.map(c => {
                  const [g1] = clanGrad(c.rating)
                  return (
                    <button key={c.id} onClick={() => setOpponent(c)} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', background: CARD, cursor: 'pointer', textAlign: 'left' }}>
                      <ClanAvatar url={c.avatarUrl} tag={c.tag} size={40} rating={c.rating} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color: g1 }}>[{c.tag}]</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: g1 }}>{c.rating}</div>
                    </button>
                  )
                })}
            </div>
          </>
        ) : (
          <>
            <button onClick={() => setOpponent(null)} style={{ display: 'flex', alignItems: 'center', gap: 11, width: '100%', padding: '12px 14px', borderRadius: 14, border: `1px solid ${ACCENT}44`, background: `${ACCENT}12`, cursor: 'pointer', marginBottom: 16 }}>
              <ClanAvatar url={opponent.avatarUrl} tag={opponent.tag} size={44} rating={opponent.rating} />
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: ACCENT }}>[{opponent.tag}] · {opponent.rating}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{opponent.name}</div>
              </div>
              <span style={{ fontSize: 12, color: '#6B7280' }}>Сменить</span>
            </button>

            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Карта (необязательно)</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
              {MAPS.map(mp => (
                <button key={mp} onClick={() => setMap(map === mp ? '' : mp)}
                  style={{ position: 'relative', height: 54, borderRadius: 12, overflow: 'hidden', cursor: 'pointer', border: `2px solid ${map === mp ? ACCENT : 'transparent'}`, background: `url(${mapImg(mp)}) center/cover`, padding: 0 }}>
                  <div style={{ position: 'absolute', inset: 0, background: map === mp ? `linear-gradient(0deg, ${ACCENT}66, rgba(0,0,0,0.4))` : 'linear-gradient(0deg, rgba(0,0,0,0.7), rgba(0,0,0,0.2))' }} />
                  <span style={{ position: 'absolute', left: 10, bottom: 7, fontSize: 12, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>{mp.charAt(0) + mp.slice(1).toLowerCase()}</span>
                </button>
              ))}
            </div>

            <button onClick={submit} disabled={saving}
              style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #0EA5E9)`, boxShadow: `0 8px 26px ${ACCENT}44` }}>
              {saving ? 'Отправляем…' : 'Отправить вызов'}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
//  RANKING
// ════════════════════════════════════════════════════════════════════════════
function RankingView({ myClanId }: { myClanId: number | null }) {
  const [list, setList] = useState<ClanCard[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => { try { setList((await api.get('/clans/leaderboard')).data) } catch {} finally { setLoading(false) } })()
  }, [])

  if (loading) return <Loader />
  if (list.length === 0) return <Empty text="Пока нет кланов в рейтинге" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {list.map((c, i) => (
        <ClanRow key={c.id} c={c} index={i} rank={c.rank ?? i + 1} highlight={myClanId === c.id} />
      ))}
    </div>
  )
}

// ── Shared clan row ─────────────────────────────────────────────────────────
function ClanRow({ c, index, right, rank, highlight, ratingOverride }: { c: ClanCard; index: number; right?: React.ReactNode; rank?: number; highlight?: boolean; ratingOverride?: number }) {
  const router = useRouter()
  const displayRating = ratingOverride ?? c.rating
  const [g1, g2] = clanGrad(displayRating)
  const medal = rank === 1 ? '#FFD700' : rank === 2 ? '#E2E8F0' : rank === 3 ? '#F97316' : null
  const isPodium = !!medal

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(index * 0.03, 0.3), type: 'spring', stiffness: 260, damping: 24 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => router.push(`/clans/${c.id}`)}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
        background: highlight
          ? `linear-gradient(135deg, ${ACCENT}1f, ${CARD} 60%)`
          : isPodium ? `linear-gradient(135deg, ${medal}14, ${CARD} 58%)` : CARD,
        borderRadius: 16, border: `1px solid ${highlight ? `${ACCENT}55` : isPodium ? `${medal}3a` : 'rgba(255,255,255,0.06)'}`,
        boxShadow: isPodium ? `0 8px 26px ${medal}14` : 'none',
      }}>
      {isPodium && <div style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, background: `linear-gradient(90deg, transparent, ${medal}aa, transparent)` }} />}
      {rank != null && (
        <div style={{ width: 28, flexShrink: 0, display: 'flex', justifyContent: 'center', position: 'relative' }}>
          {medal
            ? <div style={{ width: 26, height: 26, borderRadius: 9, background: `${medal}1f`, border: `1px solid ${medal}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color: medal, boxShadow: `0 0 12px ${medal}44` }}>{rank}</div>
            : <span style={{ fontSize: 14, fontWeight: 900, color: '#4B5563' }}>{rank}</span>}
        </div>
      )}
      <ClanAvatar url={c.avatarUrl} tag={c.tag} size={46} rating={c.rating} ring={isPodium} />
      <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 12, fontWeight: 800, color: g1 }}>[{c.tag}]</span>
          {c.region && <Flag code={c.region} size={13} />}
        </div>
        <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>{c.name}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{c.memberCount} уч. · {c.winRate}% WR</div>
      </div>
      {right ?? (
        <div style={{ textAlign: 'right', flexShrink: 0, position: 'relative' }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: g1, letterSpacing: '-0.02em' }}>{displayRating.toLocaleString()}</div>
          <div style={{ fontSize: 10, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{ratingOverride != null ? 'сезон' : 'рейтинг'}</div>
        </div>
      )}
    </motion.div>
  )
}
