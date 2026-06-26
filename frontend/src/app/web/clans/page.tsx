'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { avatarBg } from '@/lib/avatar'
import { Icon, IconName } from '@/components/ui/Icon'

const ACCENT = '#22C55E'
type Tab = 'my' | 'browse' | 'ranking'
const ROLE: Record<string, { label: string; color: string }> = { leader: { label: 'Лидер', color: '#FFD700' }, officer: { label: 'Со-Лидер', color: '#60A5FA' }, member: { label: 'Участник', color: '#9CA3AF' } }

function clanGrad(r: number): [string, string] { if (r >= 1600) return ['#A855F7', '#E8092E']; if (r >= 1300) return ['#F59E0B', '#EF4444']; if (r >= 1100) return ['#22C55E', '#0EA5E9']; return ['#64748B', '#475569'] }
function tierLabel(r: number) { if (r >= 1600) return 'ЭЛИТА'; if (r >= 1300) return 'ВЕТЕРАН'; if (r >= 1100) return 'БОЕЦ'; return 'НОВИЧОК' }

function ClanEmblem({ url, tag, size, rating }: { url: string | null; tag: string; size: number; rating: number }) {
  const [g1, g2] = clanGrad(rating); const bg = avatarBg(url)
  return <div style={{ width: size, height: size, borderRadius: size * 0.26, flexShrink: 0, background: bg || `linear-gradient(135deg, ${g1}, ${g2})`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.12)', boxShadow: `0 6px 22px ${g1}33`, overflow: 'hidden' }}>{!bg && <span style={{ fontSize: size * 0.34, fontWeight: 900, color: '#fff' }}>{tag.slice(0, 2).toUpperCase()}</span>}</div>
}

function Tile({ label, value, color, icon }: { label: string; value: string; color: string; icon: IconName }) {
  return <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${color}26`, borderRadius: 14, padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: -8, right: -6, opacity: 0.08 }}><Icon name={icon} size={48} color={color} /></div>
    <div style={{ fontSize: 24, fontWeight: 900, color, letterSpacing: '-0.02em' }}>{value}</div>
    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
  </div>
}

export default function WebClans() {
  const { user } = useAuthStore()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('my')
  const [myClan, setMyClan] = useState<any>(null)
  const [loadingMine, setLoadingMine] = useState(true)
  const [browse, setBrowse] = useState<any[]>([])
  const [ranking, setRanking] = useState<any[]>([])
  const [q, setQ] = useState('')

  const loadMine = useCallback(() => { api.get('/clans/my').then(r => setMyClan(r.data || null)).catch(() => setMyClan(null)).finally(() => setLoadingMine(false)) }, [])
  useEffect(() => { loadMine() }, [loadMine])
  useEffect(() => { if (tab === 'browse') { const t = setTimeout(() => api.get('/clans', { params: q.trim() ? { q: q.trim() } : {} }).then(r => setBrowse(r.data)).catch(() => {}), 250); return () => clearTimeout(t) } }, [tab, q])
  useEffect(() => { if (tab === 'ranking') api.get('/clans/leaderboard').then(r => setRanking(r.data)).catch(() => {}) }, [tab])

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20 }}>
        <div style={{ position: 'relative', width: 46, height: 46, borderRadius: 14, background: `linear-gradient(135deg, ${ACCENT}, #0EA5E9)`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 22px ${ACCENT}55` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)' }} />
          <Icon name="shield" size={23} color="#fff" />
        </div>
        <div><h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>Кланы</h1><div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>Собирай команду · побеждай вместе</div></div>
      </motion.div>

      <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 14, padding: 4, marginBottom: 20, maxWidth: 420 }}>
        {([['my', 'Мой клан'], ['browse', 'Обзор'], ['ranking', 'Рейтинг']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, position: 'relative', padding: '10px 0', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: 'none', border: 'none', color: tab === t ? '#fff' : '#6B7280' }}>
            {tab === t && <motion.div layoutId="webClanTab" style={{ position: 'absolute', inset: 0, borderRadius: 10, background: `linear-gradient(135deg, ${ACCENT}cc, #0EA5E9cc)`, zIndex: -1, boxShadow: `0 4px 14px ${ACCENT}40` }} />}{l}
          </button>
        ))}
      </div>

      {/* MY CLAN */}
      {tab === 'my' && (loadingMine ? <Loader /> : myClan ? <MyClan clan={myClan} router={router} /> : <CreateClan user={user} onCreated={loadMine} />)}

      {/* BROWSE */}
      {tab === 'browse' && (
        <div>
          <div style={{ position: 'relative', marginBottom: 16, maxWidth: 520 }}>
            <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#6B7280' }}><Icon name="search" size={16} /></div>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по тэгу или названию" style={{ width: '100%', boxSizing: 'border-box', borderRadius: 14, padding: '13px 16px 13px 42px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {browse.map(c => <ClanRow key={c.id} c={c} router={router} />)}
          </div>
        </div>
      )}

      {/* RANKING */}
      {tab === 'ranking' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {ranking.map((c, i) => <ClanRow key={c.id} c={c} rank={c.rank ?? i + 1} router={router} />)}
        </div>
      )}
    </div>
  )
}

function Loader() { return <div style={{ padding: 60, textAlign: 'center' }}><motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: ACCENT, margin: '0 auto' }} /></div> }

function MyClan({ clan, router }: { clan: any; router: any }) {
  const [g1, g2] = clanGrad(clan.rating)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ borderRadius: 22, padding: 22, position: 'relative', overflow: 'hidden', background: `radial-gradient(130% 120% at 0% 0%, ${g1}22, transparent 52%), linear-gradient(160deg, #0c0c11, #08080b)`, border: `1px solid ${g1}33` }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <ClanEmblem url={clan.avatarUrl} tag={clan.tag} size={78} rating={clan.rating} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: g1, background: `${g1}1f`, padding: '2px 8px', borderRadius: 7 }}>[{clan.tag}]</span>
                <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${g1}, ${g2})`, padding: '3px 8px', borderRadius: 6, letterSpacing: '0.06em' }}>{tierLabel(clan.rating)}</span>
              </div>
              <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em', marginTop: 7 }}>{clan.name}</div>
            </div>
          </div>
          {clan.description && <div style={{ marginTop: 14, fontSize: 13, color: '#B0B0B8', lineHeight: 1.5 }}>{clan.description}</div>}
        </div>
        <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
          <div style={{ padding: '14px 18px 10px', fontSize: 12, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Состав · {clan.memberCount}</div>
          {clan.members.map((m: any) => {
            const rm = ROLE[m.role]
            return (
              <button key={m.userId} onClick={() => router.push(`/player/${m.userId}`)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '11px 18px', background: 'none', border: 'none', borderTop: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: avatarBg(m.avatarUrl) || 'linear-gradient(135deg,#374151,#1f2937)', border: '1px solid rgba(255,255,255,0.08)' }} />
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nickname}</div>
                  <div style={{ fontSize: 11, color: rm.color, fontWeight: 700 }}>{rm.label} · {m.elo} ELO</div>
                </div>
                <Icon name="chevronRight" size={16} color="#374151" />
              </button>
            )
          })}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Tile label="Рейтинг" value={clan.rating.toLocaleString()} color={g1} icon="trophy" />
          <Tile label="Место" value={`#${clan.position}`} color="#F59E0B" icon="crown" />
          <Tile label="Участники" value={String(clan.memberCount)} color="#60A5FA" icon="users" />
          <Tile label="Винрейт" value={`${clan.winRate}%`} color={clan.winRate >= 50 ? '#22C55E' : '#EF4444'} icon="trendingUp" />
        </div>
        <div style={{ borderRadius: 16, padding: 16, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 12.5, color: '#6B7280', lineHeight: 1.5 }}>
          <Icon name="rocket" size={16} color="#6B7280" /> Расписание, праки, клановые бои 5×5 и поиск боёв скоро появятся и на сайте. Пока они доступны в приложении.
        </div>
      </div>
    </div>
  )
}

function CreateClan({ user, onCreated }: { user: any; onCreated: () => void }) {
  const [tag, setTag] = useState(''); const [name, setName] = useState(''); const [desc, setDesc] = useState('')
  const [saving, setSaving] = useState(false); const [err, setErr] = useState('')
  const COST = 4990
  const tagOk = /^[A-Za-z0-9]{2,5}$/.test(tag), nameOk = name.trim().length >= 2
  const enough = (user?.coins ?? 0) >= COST
  const submit = async () => {
    setSaving(true); setErr('')
    try { await api.post('/clans', { tag, name: name.trim(), description: desc.trim() || undefined }); onCreated() }
    catch (e: any) { setErr(e?.response?.data?.message || 'Не удалось создать клан') } finally { setSaving(false) }
  }
  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ borderRadius: 22, padding: 24, background: `radial-gradient(120% 120% at 0% 0%, ${ACCENT}18, transparent 55%), linear-gradient(160deg, #0c0c11, #08080b)`, border: `1px solid ${ACCENT}33` }}>
        <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>Создай свой клан</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Объединяй игроков и поднимайся в рейтинге кланов</div>
        <Field label="Тэг (2–5, латиница/цифры)"><input value={tag} onChange={e => setTag(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 5))} placeholder="CnDr" style={inp(tag.length > 0 && !tagOk)} /></Field>
        <Field label="Название"><input value={name} onChange={e => setName(e.target.value.slice(0, 50))} placeholder="Condr Esports" style={inp(name.length > 0 && !nameOk)} /></Field>
        <Field label="Описание"><textarea value={desc} onChange={e => setDesc(e.target.value.slice(0, 500))} rows={3} placeholder="О клане…" style={{ ...inp(false), resize: 'none', lineHeight: 1.45 }} /></Field>
        {err && <div style={{ fontSize: 13, color: '#EF4444', marginBottom: 10 }}>{err}</div>}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 12, background: enough ? 'rgba(255,255,255,0.04)' : 'rgba(239,68,68,0.1)', border: `1px solid ${enough ? 'rgba(255,255,255,0.08)' : 'rgba(239,68,68,0.3)'}`, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#9CA3AF' }}>Стоимость создания</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: enough ? '#fff' : '#EF4444' }}>{COST.toLocaleString()} COIN</span>
        </div>
        <button onClick={submit} disabled={!tagOk || !nameOk || !enough || saving} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: tagOk && nameOk && enough ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 800, color: '#fff', background: tagOk && nameOk && enough ? `linear-gradient(135deg, ${ACCENT}, #0EA5E9)` : 'rgba(255,255,255,0.06)', opacity: tagOk && nameOk && enough ? 1 : 0.5 }}>
          {saving ? 'Создаём…' : enough ? `Создать за ${COST.toLocaleString()} COIN` : 'Недостаточно COIN'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div style={{ marginBottom: 14 }}><div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 }}>{label}</div>{children}</div> }
function inp(error: boolean): React.CSSProperties { return { width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, fontSize: 14, color: '#fff', background: 'rgba(255,255,255,0.04)', border: `1px solid ${error ? '#EF4444' : 'rgba(255,255,255,0.1)'}`, outline: 'none' } }

function ClanRow({ c, rank, router }: { c: any; rank?: number; router: any }) {
  const [g1] = clanGrad(c.rating)
  const medal = rank === 1 ? '#FFD700' : rank === 2 ? '#E2E8F0' : rank === 3 ? '#F97316' : null
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => router.push(`/clans/${c.id}`)}
      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, cursor: 'pointer', background: medal ? `linear-gradient(135deg, ${medal}12, rgba(255,255,255,0.02))` : 'rgba(255,255,255,0.02)', border: `1px solid ${medal ? medal + '3a' : 'rgba(255,255,255,0.07)'}` }}>
      {rank != null && <div style={{ width: 28, textAlign: 'center', fontSize: 15, fontWeight: 900, color: medal || '#4B5563', flexShrink: 0 }}>{rank}</div>}
      <ClanEmblem url={c.avatarUrl} tag={c.tag} size={46} rating={c.rating} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: g1 }}>[{c.tag}]</div>
        <div style={{ fontSize: 15, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
        <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{c.memberCount} уч. · {c.winRate}% WR</div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}><div style={{ fontSize: 17, fontWeight: 900, color: g1 }}>{c.rating.toLocaleString()}</div><div style={{ fontSize: 9, color: '#4B5563', fontWeight: 700, textTransform: 'uppercase' }}>рейтинг</div></div>
    </motion.div>
  )
}
