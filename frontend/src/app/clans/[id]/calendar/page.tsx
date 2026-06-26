'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { useClanRealtime } from '@/hooks/useClanRealtime'
import { Icon } from '@/components/ui/Icon'
import { useSheetDrag } from '@/lib/useSheetDrag'

const ACCENT = '#22C55E'
const CARD = '#0f0f15'
const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']

const TYPE_META: Record<string, { label: string; color: string; icon: any }> = {
  clan_battle: { label: 'Клановый бой', color: '#EF4444', icon: 'swords' },
  tournament: { label: 'Турнир', color: '#F59E0B', icon: 'trophy' },
  scrim: { label: 'Прак', color: '#A855F7', icon: 'swords' },
  training: { label: 'Тренировка', color: '#22C55E', icon: 'target' },
  meeting: { label: 'Сбор', color: '#60A5FA', icon: 'users' },
  custom: { label: 'Событие', color: '#9CA3AF', icon: 'star' },
}
const MAPS = ['PRISON', 'SANDSTONE', 'PROVINCE', 'BREEZE', 'HANAMI', 'RUST', 'DUNE']
const mapImg = (m: string) => `/maps/${m.charAt(0) + m.slice(1).toLowerCase()}.webp`
const FORMAT_MAPS: Record<string, number> = { bo1: 1, bo3: 3, bo5: 5 }

interface CalItem {
  kind: 'event' | 'match'
  id: number; type: string; title: string; description?: string | null
  startsAt: string; endsAt?: string | null; createdBy?: number
  map?: string | null; status?: string; opponentTag?: string | null; matchId?: number
  lobbyHost?: string | null; opponentExtId?: string | null; format?: string | null; maps?: string[]
}

type ViewMode = 'month' | 'week' | 'day'

// date helpers (local)
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const startOfWeek = (d: Date) => { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x }
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export default function CalendarPage() {
  return <RequireRegistration><Inner /></RequireRegistration>
}

function Inner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [items, setItems] = useState<CalItem[]>([])
  const [loading, setLoading] = useState(true)
  const [canEdit, setCanEdit] = useState(false)
  const [view, setView] = useState<ViewMode>('month')
  const [cursor, setCursor] = useState(new Date())          // anchor date for current view
  const [selected, setSelected] = useState<Date>(new Date()) // selected day
  const [creating, setCreating] = useState<Date | null>(null)
  const [editing, setEditing] = useState<CalItem | null>(null)

  const load = useCallback(async () => {
    try {
      const [cal, clan] = await Promise.all([
        api.get(`/clans/${id}/calendar`),
        api.get(`/clans/${id}`).catch(() => null),
      ])
      setItems(cal.data)
      const role = clan?.data?.myRole
      setCanEdit(role === 'leader' || role === 'officer')
    } catch {} finally { setLoading(false) }
  }, [id])
  useEffect(() => { load() }, [load])
  useClanRealtime({ clanId: Number(id) }, () => load())

  const itemsByDay = (d: Date) => items
    .filter(it => sameDay(new Date(it.startsAt), d))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())

  const daysWithItems = new Set(items.map(it => ymd(new Date(it.startsAt))))

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}>
        <Icon name="chevronLeft" size={18} color="#9CA3AF" /> Назад
      </button>

      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
        <div style={{ position: 'relative', width: 42, height: 42, borderRadius: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${ACCENT}, #0EA5E9)`, boxShadow: `0 8px 22px ${ACCENT}55` }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '45%', borderRadius: '14px 14px 0 0', background: 'linear-gradient(180deg, rgba(255,255,255,0.25), transparent)' }} />
          <Icon name="timer" size={22} color="#fff" />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1 }}>Расписание</h1>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, whiteSpace: 'nowrap' }}>Турниры · праки · события</div>
        </div>
      </motion.div>

      {/* view switch — отдельная строка, во всю ширину (не вылезает за экран) */}
      <div style={{ display: 'flex', gap: 4, background: 'rgba(255,255,255,0.04)', padding: 4, borderRadius: 12, marginBottom: 14 }}>
        {(['month', 'week', 'day'] as ViewMode[]).map(v => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, position: 'relative', padding: '9px 0', border: 'none', cursor: 'pointer', background: 'none', borderRadius: 9, fontSize: 13, fontWeight: 700, color: view === v ? '#fff' : '#6B7280' }}>
            {view === v && <motion.div layoutId="calView" style={{ position: 'absolute', inset: 0, borderRadius: 9, background: `linear-gradient(135deg, ${ACCENT}cc, #0EA5E9cc)`, zIndex: -1, boxShadow: `0 4px 14px ${ACCENT}40` }} />}
            {v === 'month' ? 'Месяц' : v === 'week' ? 'Неделя' : 'День'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: ACCENT }} />
        </div>
      ) : (
        <>
          {view === 'month' && <MonthView cursor={cursor} setCursor={setCursor} selected={selected} setSelected={(d) => { setSelected(d); }} daysWithItems={daysWithItems} />}
          {view === 'week' && <WeekView cursor={cursor} setCursor={setCursor} selected={selected} setSelected={setSelected} daysWithItems={daysWithItems} />}

          {/* Day agenda (shown in month & week below grid, and as main in day view) */}
          <DayAgenda
            date={view === 'day' ? cursor : selected}
            setDate={view === 'day' ? setCursor : setSelected}
            dayMode={view === 'day'}
            items={itemsByDay(view === 'day' ? cursor : selected)}
            canEdit={canEdit}
            onAdd={(d) => setCreating(d)}
            onEdit={(it) => setEditing(it)}
            clanId={Number(id)}
          />
        </>
      )}

      <AnimatePresence>
        {creating && <EventModal clanId={Number(id)} date={creating} onClose={() => setCreating(null)} onSaved={() => { setCreating(null); load() }} />}
        {editing && <EventModal clanId={Number(id)} editItem={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      </AnimatePresence>
    </div>
  )
}

// ── Month grid ────────────────────────────────────────────────────────────────
function MonthView({ cursor, setCursor, selected, setSelected, daysWithItems }: { cursor: Date; setCursor: (d: Date) => void; selected: Date; setSelected: (d: Date) => void; daysWithItems: Set<string> }) {
  const year = cursor.getFullYear(), month = cursor.getMonth()
  const first = new Date(year, month, 1)
  const startPad = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()

  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div style={{ background: CARD, borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', padding: 14, marginBottom: 12 }}>
      <Header label={`${MONTHS[month]} ${year}`} onPrev={() => setCursor(new Date(year, month - 1, 1))} onNext={() => setCursor(new Date(year, month + 1, 1))} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4, marginBottom: 4 }}>
        {WD.map(w => <div key={w} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: '#4B5563', padding: '4px 0' }}>{w}</div>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />
          const isToday = sameDay(d, today)
          const isSel = sameDay(d, selected)
          const has = daysWithItems.has(ymd(d))
          return (
            <button key={i} onClick={() => setSelected(d)}
              style={{ aspectRatio: '1', borderRadius: 10, border: isSel ? `1.5px solid ${ACCENT}` : '1.5px solid transparent', background: isSel ? `${ACCENT}1f` : isToday ? 'rgba(255,255,255,0.05)' : 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', padding: 0 }}>
              <span style={{ fontSize: 13, fontWeight: isSel || isToday ? 800 : 500, color: isSel ? ACCENT : isToday ? '#fff' : '#9CA3AF' }}>{d.getDate()}</span>
              {has && <div style={{ position: 'absolute', bottom: 5, width: 5, height: 5, borderRadius: '50%', background: isSel ? ACCENT : '#60A5FA' }} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Week strip ────────────────────────────────────────────────────────────────
function WeekView({ cursor, setCursor, selected, setSelected, daysWithItems }: { cursor: Date; setCursor: (d: Date) => void; selected: Date; setSelected: (d: Date) => void; daysWithItems: Set<string> }) {
  const ws = startOfWeek(cursor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i))
  const today = new Date()
  const label = `${days[0].getDate()} ${MONTHS[days[0].getMonth()].slice(0, 3)} — ${days[6].getDate()} ${MONTHS[days[6].getMonth()].slice(0, 3)}`
  return (
    <div style={{ background: CARD, borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', padding: 14, marginBottom: 12 }}>
      <Header label={label} onPrev={() => setCursor(addDays(ws, -7))} onNext={() => setCursor(addDays(ws, 7))} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
        {days.map((d, i) => {
          const isToday = sameDay(d, today)
          const isSel = sameDay(d, selected)
          const has = daysWithItems.has(ymd(d))
          return (
            <button key={i} onClick={() => setSelected(d)}
              style={{ borderRadius: 12, border: isSel ? `1.5px solid ${ACCENT}` : '1.5px solid transparent', background: isSel ? `${ACCENT}1f` : isToday ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)', cursor: 'pointer', padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#4B5563' }}>{WD[i]}</span>
              <span style={{ fontSize: 16, fontWeight: isSel || isToday ? 800 : 600, color: isSel ? ACCENT : isToday ? '#fff' : '#9CA3AF' }}>{d.getDate()}</span>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: has ? (isSel ? ACCENT : '#60A5FA') : 'transparent' }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Header({ label, onPrev, onNext }: { label: string; onPrev: () => void; onNext: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <button onClick={onPrev} style={navArrow}><Icon name="chevronLeft" size={18} color="#9CA3AF" /></button>
      <span style={{ fontSize: 15, fontWeight: 800 }}>{label}</span>
      <button onClick={onNext} style={navArrow}><Icon name="chevronRight" size={18} color="#9CA3AF" /></button>
    </div>
  )
}
const navArrow: React.CSSProperties = { width: 34, height: 34, borderRadius: 10, border: 'none', background: 'rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

// ── Day agenda ────────────────────────────────────────────────────────────────
function DayAgenda({ date, setDate, dayMode, items, canEdit, onAdd, onEdit }: {
  date: Date; setDate: (d: Date) => void; dayMode: boolean; items: CalItem[]; canEdit: boolean; onAdd: (d: Date) => void; onEdit: (it: CalItem) => void; clanId: number
}) {
  const today = new Date()
  const dateLabel = sameDay(date, today) ? 'Сегодня' : `${date.getDate()} ${MONTHS[date.getMonth()]}`
  return (
    <div style={{ background: CARD, borderRadius: 18, border: '1px solid rgba(255,255,255,0.06)', padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        {dayMode ? (
          <Header label={dateLabel + ` · ${WD[(date.getDay() + 6) % 7]}`} onPrev={() => setDate(addDays(date, -1))} onNext={() => setDate(addDays(date, 1))} />
        ) : (
          <span style={{ fontSize: 14, fontWeight: 800 }}>{dateLabel}</span>
        )}
        {!dayMode && canEdit && (
          <button onClick={() => onAdd(date)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 11px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #0EA5E9)` }}>
            <Icon name="plus" size={13} color="#fff" /> Событие
          </button>
        )}
      </div>

      {dayMode && canEdit && (
        <button onClick={() => onAdd(date)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '11px 0', borderRadius: 12, border: `1px dashed ${ACCENT}55`, background: `${ACCENT}0e`, color: ACCENT, fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 12 }}>
          <Icon name="plus" size={15} color={ACCENT} /> Добавить событие
        </button>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0', color: '#4B5563', fontSize: 13 }}>На этот день событий нет</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {items.map(it => {
            const tm = TYPE_META[it.type] || TYPE_META.custom
            const t = new Date(it.startsAt)
            const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`
            const editable = canEdit && it.kind === 'event'
            return (
              <motion.div key={`${it.kind}-${it.id}`} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} onClick={() => editable && onEdit(it)}
                style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 14, background: `linear-gradient(100deg, ${tm.color}10, rgba(255,255,255,0.03) 55%)`, border: `1px solid ${tm.color}22`, borderLeft: `3px solid ${tm.color}`, cursor: editable ? 'pointer' : 'default' }}>
                <div style={{ position: 'absolute', top: -10, right: -6, opacity: 0.07, pointerEvents: 'none' }}><Icon name={tm.icon} size={52} color={tm.color} /></div>
                <div style={{ textAlign: 'center', minWidth: 44, position: 'relative' }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{time}</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 9, background: `${tm.color}1c`, border: `1px solid ${tm.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
                  <Icon name={tm.icon} size={16} color={tm.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.title}</div>
                  <div style={{ fontSize: 11, color: tm.color, fontWeight: 600, marginTop: 1 }}>
                    {tm.label}
                    {it.opponentTag ? ` · vs [${it.opponentTag}]` : ''}
                    {it.format ? ` · ${it.format.toUpperCase()}` : ''}
                    {it.map ? ` · ${it.map.charAt(0) + it.map.slice(1).toLowerCase()}` : ''}
                    {it.kind === 'match' && it.status === 'completed' ? ' · завершён' : ''}
                  </div>
                  {it.maps && it.maps.length > 0 && (
                    <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>{it.maps.map(m => m === 'LOBBY' ? 'В лобби' : m.charAt(0) + m.slice(1).toLowerCase()).join(', ')}</div>
                  )}
                  {it.description && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, lineHeight: 1.4 }}>{it.description}</div>}
                </div>
                {editable && <Icon name="pencil" size={14} color="#4B5563" style={{ position: 'relative' }} />}
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Event create / edit modal ─────────────────────────────────────────────────
function EventModal({ clanId, date, editItem, onClose, onSaved }: { clanId: number; date?: Date; editItem?: CalItem; onClose: () => void; onSaved: () => void }) {
  const sheet = useSheetDrag(onClose)
  const init = editItem ? new Date(editItem.startsAt) : (date || new Date())
  const [title, setTitle] = useState(editItem?.title || '')
  const [type, setType] = useState(editItem?.type && editItem.type !== 'clan_battle' ? editItem.type : 'tournament')
  const [desc, setDesc] = useState(editItem?.description || '')
  const [day, setDay] = useState(ymd(init))
  const [time, setTime] = useState(`${String(init.getHours()).padStart(2, '0')}:${String(init.getMinutes()).padStart(2, '0')}`)
  const [oppTag, setOppTag] = useState(editItem?.opponentTag || '')
  const [lobbyHost, setLobbyHost] = useState<string>(editItem?.lobbyHost || 'us')
  const [oppId, setOppId] = useState(editItem?.opponentExtId || '')
  const [format, setFormat] = useState<string>(editItem?.format || 'bo1')
  const [maps, setMaps] = useState<string[]>(editItem?.maps || [])
  const [saving, setSaving] = useState(false)

  const isCompetitive = type === 'tournament' || type === 'scrim'
  const isLobby = maps.includes('LOBBY')
  const maxMaps = FORMAT_MAPS[format] || 1
  const toggleMap = (m: string) => {
    if (m === 'LOBBY') { setMaps(prev => prev.includes('LOBBY') ? [] : ['LOBBY']); return }
    setMaps(prev => {
      const base = prev.filter(x => x !== 'LOBBY') // обычная карта снимает «в лобби»
      return base.includes(m) ? base.filter(x => x !== m) : (base.length >= maxMaps ? [...base.slice(1), m] : [...base, m])
    })
  }
  const changeFormat = (f: string) => { setFormat(f); setMaps(prev => prev.includes('LOBBY') ? prev : prev.slice(0, FORMAT_MAPS[f] || 1)) }

  const titleOk = title.trim().length >= 2
  const accent = (TYPE_META[type] || TYPE_META.custom).color
  const submit = async () => {
    if (!titleOk) return
    setSaving(true)
    try {
      const startsAt = new Date(`${day}T${time || '00:00'}`).toISOString()
      const payload: any = { title: title.trim(), type, description: desc.trim(), startsAt }
      if (isCompetitive) {
        payload.opponentTag = oppTag.trim() || null
        payload.lobbyHost = lobbyHost
        payload.opponentExtId = lobbyHost === 'us' ? (oppId.trim() || null) : null
        payload.format = format
        payload.maps = maps
      }
      if (editItem) await api.patch(`/clans/events/${editItem.id}`, payload)
      else await api.post('/clans/events', { clanId, ...payload })
      onSaved()
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setSaving(false) }
  }
  const remove = async () => {
    if (!editItem || !confirm('Удалить событие?')) return
    setSaving(true)
    try { await api.delete(`/clans/events/${editItem.id}`); onSaved() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setSaving(false) }
  }

  const TYPES: { v: string; label: string }[] = [
    { v: 'tournament', label: 'Турнир' }, { v: 'scrim', label: 'Прак' },
    { v: 'training', label: 'Тренировка' }, { v: 'meeting', label: 'Сбор' },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div {...sheet.panelProps} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: '#0a0a0f', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.08)', padding: 20, maxHeight: '90vh', overflowY: 'auto' }}>
        <div {...sheet.handleProps} style={{ ...sheet.handleProps.style, padding: '4px 0 14px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} />
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 16 }}>{editItem ? 'Редактировать' : 'Новое событие'}</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          <div>
            <Lbl>Тип</Lbl>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {TYPES.map(t => (
                <button key={t.v} onClick={() => setType(t.v)} style={{ padding: '8px 13px', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: type === t.v ? '#fff' : '#9CA3AF', background: type === t.v ? `${(TYPE_META[t.v] || TYPE_META.custom).color}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${type === t.v ? (TYPE_META[t.v] || TYPE_META.custom).color : 'transparent'}` }}>{t.label}</button>
              ))}
            </div>
          </div>

          <div>
            <Lbl>Название</Lbl>
            <input value={title} onChange={e => setTitle(e.target.value.slice(0, 100))} placeholder={type === 'tournament' ? 'Кубок CONDR' : 'Тренировка по раскидкам'} style={inp(title.length > 0 && !titleOk)} />
          </div>

          {isCompetitive && (
            <>
              <div>
                <Lbl>Тэг соперника</Lbl>
                <input value={oppTag} onChange={e => setOppTag(e.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 5))} placeholder="напр. CnDr" style={inp(false)} />
              </div>

              <div>
                <Lbl>Кто создаёт лобби?</Lbl>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['us', 'Мы'], ['them', 'Они']].map(([v, l]) => (
                    <button key={v} onClick={() => setLobbyHost(v)} style={{ flex: 1, padding: '11px 0', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: 700, color: lobbyHost === v ? '#fff' : '#9CA3AF', background: lobbyHost === v ? `${accent}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${lobbyHost === v ? accent : 'transparent'}` }}>{l}</button>
                  ))}
                </div>
              </div>

              {lobbyHost === 'us' && (
                <div>
                  <Lbl>ID соперника</Lbl>
                  <input value={oppId} onChange={e => setOppId(e.target.value.slice(0, 40))} placeholder="Игровой ID соперника" style={inp(false)} />
                </div>
              )}

              <div>
                <Lbl>Формат</Lbl>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['bo1', 'bo3', 'bo5'].map(f => (
                    <button key={f} onClick={() => changeFormat(f)} style={{ flex: 1, padding: '11px 0', borderRadius: 11, cursor: 'pointer', fontSize: 14, fontWeight: 800, color: format === f ? '#fff' : '#9CA3AF', background: format === f ? `${accent}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${format === f ? accent : 'transparent'}` }}>{f.toUpperCase()}</button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                  <Lbl>Карты</Lbl>
                  {!isLobby && <span style={{ fontSize: 11, color: maps.length === maxMaps ? accent : '#6B7280', fontWeight: 700 }}>{maps.length} / {maxMaps}</span>}
                </div>
                {/* «В лобби» — только для турнира, вместо выбора карты */}
                {type === 'tournament' && (
                  <button onClick={() => toggleMap('LOBBY')}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 0', borderRadius: 12, marginBottom: 10, cursor: 'pointer', fontSize: 14, fontWeight: 800, color: isLobby ? '#fff' : '#9CA3AF', background: isLobby ? `${accent}22` : 'rgba(255,255,255,0.04)', border: `1px solid ${isLobby ? accent : 'rgba(255,255,255,0.08)'}` }}>
                    <Icon name="gamepad" size={16} color={isLobby ? accent : '#9CA3AF'} /> В лобби (без выбора карты)
                  </button>
                )}
                {!isLobby && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 9 }}>
                  {MAPS.map(mp => {
                    const idx = maps.indexOf(mp); const sel = idx >= 0
                    return (
                      <button key={mp} onClick={() => toggleMap(mp)}
                        style={{ position: 'relative', aspectRatio: '1', borderRadius: 14, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0, transform: sel ? 'translateY(-2px)' : 'none', transition: 'transform .15s', boxShadow: sel ? `0 8px 20px ${accent}44` : '0 2px 8px rgba(0,0,0,0.3)' }}>
                        <div style={{ position: 'absolute', inset: 0, background: `url(${mapImg(mp)}) center/cover`, transform: sel ? 'scale(1.08)' : 'scale(1)', transition: 'transform .2s' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 55%, transparent 100%)' }} />
                        {sel && <div style={{ position: 'absolute', inset: 0, borderRadius: 14, border: `2.5px solid ${accent}`, background: `${accent}22` }} />}
                        {sel && (
                          <div style={{ position: 'absolute', top: 6, right: 6, minWidth: 20, height: 20, padding: '0 5px', borderRadius: 10, background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,0.4)', fontSize: 11, fontWeight: 900, color: '#fff' }}>{idx + 1}</div>
                        )}
                        <span style={{ position: 'absolute', left: 8, right: 8, bottom: 7, fontSize: 11, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{mp.charAt(0) + mp.slice(1).toLowerCase()}</span>
                      </button>
                    )
                  })}
                </div>
                )}
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Lbl>Дата</Lbl>
              <input type="date" value={day} onChange={e => setDay(e.target.value)} style={inp(false)} />
            </div>
            <div style={{ width: 120 }}>
              <Lbl>Время</Lbl>
              <input type="time" value={time} onChange={e => setTime(e.target.value)} style={inp(false)} />
            </div>
          </div>
          <div>
            <Lbl>Описание</Lbl>
            <textarea value={desc} onChange={e => setDesc(e.target.value.slice(0, 500))} rows={2} placeholder="Необязательно" style={{ ...inp(false), resize: 'none', lineHeight: 1.45 }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {editItem && <button onClick={remove} disabled={saving} style={{ padding: '13px 18px', borderRadius: 13, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700, background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>Удалить</button>}
            <button onClick={submit} disabled={!titleOk || saving} style={{ flex: 1, padding: '13px 0', borderRadius: 13, border: 'none', cursor: titleOk ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 800, color: '#fff', background: titleOk ? `linear-gradient(135deg, ${accent}, ${accent}aa)` : 'rgba(255,255,255,0.06)', opacity: titleOk ? 1 : 0.5 }}>{saving ? '…' : editItem ? 'Сохранить' : 'Создать'}</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 7 }}>{children}</div>
}
function inp(error: boolean): React.CSSProperties {
  return { width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 14, color: '#fff', background: 'rgba(255,255,255,0.04)', border: `1px solid ${error ? '#EF4444' : 'rgba(255,255,255,0.08)'}`, outline: 'none', colorScheme: 'dark' }
}
