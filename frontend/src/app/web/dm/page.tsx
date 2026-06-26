'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { connectSocket } from '@/lib/socket'
import { Avatar } from '@/components/ui/Avatar'
import { avatarBg } from '@/lib/avatar'
import { Icon, IconName } from '@/components/ui/Icon'
import { useSheetDrag } from '@/lib/useSheetDrag'

const ORANGE = '#F97316'
const RED = '#E8092E'
const PURPLE = '#A855F7'
const CARD = '#0f0f15'
const MAPS = ['PRISON', 'SANDSTONE', 'PROVINCE', 'BREEZE', 'HANAMI', 'RUST', 'DUNE']
const mapImg = (m: string) => `/maps/${m.charAt(0) + m.slice(1).toLowerCase()}.webp`
const mapLabel = (m: string) => m.charAt(0) + m.slice(1).toLowerCase()
const WEAPONS: { key: string; label: string }[] = [
  { key: 'pistols', label: 'Пистолеты' }, { key: 'akr', label: 'AKR' }, { key: 'snipers', label: 'Снайперки' }, { key: 'all', label: 'Всё оружие' },
]
const weaponLabel = (k: string) => WEAPONS.find(w => w.key === k)?.label ?? 'Всё оружие'
const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

interface QueueStatus { inQueue: boolean; size: number; max: number; members: { id: number; nickname: string; avatarUrl: string | null }[]; countdownExpires: number | null; activeMatchId: string | null }
interface ProLobby { id: number; map: string; weapons: string; condition: string; link: string; hostId: number; host: { id: number; nickname: string; avatarUrl: string | null } | null }

function Chip({ icon, text, color }: { icon: IconName; text: string; color: string }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: '#D1D5DB', background: 'rgba(255,255,255,0.05)', padding: '5px 10px', borderRadius: 9, border: `1px solid ${color}26` }}><Icon name={icon} size={13} color={color} /> {text}</span>
}

function ProTile({ l, mine, onDelete }: { l: ProLobby; mine: boolean; onDelete: () => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} style={{ borderRadius: 20, overflow: 'hidden', position: 'relative', background: '#0c0c11', border: `1px solid ${PURPLE}38`, boxShadow: `0 16px 38px ${PURPLE}16` }}>
      <div style={{ position: 'relative', height: 120, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: `url(${mapImg(l.map)}) center/cover` }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.32) 0%, transparent 30%, rgba(12,12,17,0.55) 82%, #0c0c11 100%)' }} />
        <div style={{ position: 'absolute', top: 11, left: 12, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${PURPLE}, #7c3aed)`, padding: '4px 10px', borderRadius: 9, textTransform: 'uppercase', boxShadow: `0 4px 14px ${PURPLE}55` }}><Icon name="crown" size={12} color="#fff" /> PRO Host</div>
        {mine && <button onClick={onDelete} style={{ position: 'absolute', top: 10, right: 10, width: 32, height: 32, borderRadius: 10, border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', background: 'rgba(20,8,10,0.55)', color: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="x" size={16} /></button>}
      </div>
      <div style={{ padding: '0 15px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginTop: -30 }}>
          <Avatar avatarUrl={l.host?.avatarUrl ?? null} name={l.host?.nickname || '?'} size={56} style={{ border: '3px solid #0c0c11', boxShadow: `0 0 0 2px ${PURPLE}b3, 0 8px 20px ${PURPLE}73` }} />
          <div style={{ flex: 1, minWidth: 0, paddingBottom: 5 }}><div style={{ fontSize: 17, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.host?.nickname || 'Хост'}</div><div style={{ fontSize: 11, color: PURPLE, fontWeight: 700, marginTop: 1 }}>Хост лобби</div></div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 13 }}>
          <Chip icon="pin" text={mapLabel(l.map)} color="#60A5FA" />
          <Chip icon="swords" text={weaponLabel(l.weapons)} color={PURPLE} />
          {l.condition === 'hs' && <Chip icon="target" text="Only HS" color={RED} />}
        </div>
        <a href={l.link} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: 14, padding: '13px 0', borderRadius: 14, fontSize: 15, fontWeight: 900, color: '#fff', textDecoration: 'none', background: `linear-gradient(135deg, ${PURPLE}, #7c3aed)`, boxShadow: `0 8px 24px ${PURPLE}80` }}><Icon name="rocket" size={17} color="#fff" /> Подключиться</a>
      </div>
    </motion.div>
  )
}

function CreateProModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const sheet = useSheetDrag(onClose)
  const [map, setMap] = useState(''); const [weapons, setWeapons] = useState('all'); const [condition, setCondition] = useState('none'); const [link, setLink] = useState(''); const [saving, setSaving] = useState(false)
  const linkOk = /^https:\/\/link\.standoff2\.com\/.+\/lobby\/join\/.+/i.test(link.trim())
  const canSave = map && linkOk && !saving
  const submit = async () => { setSaving(true); try { await api.post('/dm/pro', { map, weapons, condition, link: link.trim() }); onSaved() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setSaving(false) } }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div {...sheet.panelProps} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: 'linear-gradient(180deg, #101016, #0a0a0f)', borderRadius: '26px 26px 0 0', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none', padding: 24, paddingBottom: 32, maxHeight: '90vh', overflowY: 'auto' }}>
        <div {...sheet.handleProps} style={{ ...sheet.handleProps.style, padding: '4px 0 16px' }}><div style={{ width: 42, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} /></div>
        <div style={{ fontSize: 19, fontWeight: 900, marginBottom: 4 }}>Своё PRO DM-лобби</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 18 }}>Настрой параметры и оставь ссылку на лобби</div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Карта</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9, marginBottom: 18 }}>
          {MAPS.map(mp => { const sel = map === mp; return (
            <button key={mp} onClick={() => setMap(mp)} style={{ position: 'relative', aspectRatio: '1.4', borderRadius: 13, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0, boxShadow: sel ? `0 8px 20px ${PURPLE}66` : 'none' }}>
              <div style={{ position: 'absolute', inset: 0, background: `url(${mapImg(mp)}) center/cover`, transform: sel ? 'scale(1.08)' : 'scale(1)', transition: 'transform .2s' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent 60%)' }} />
              {sel && <div style={{ position: 'absolute', inset: 0, border: `2.5px solid ${PURPLE}`, borderRadius: 13, background: `${PURPLE}33` }} />}
              <span style={{ position: 'absolute', left: 7, bottom: 5, fontSize: 10.5, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{mapLabel(mp)}</span>
            </button>
          )})}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Оружие</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 18 }}>
          {WEAPONS.map(w => { const sel = weapons === w.key; return <button key={w.key} onClick={() => setWeapons(w.key)} style={{ padding: '9px 14px', borderRadius: 11, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: sel ? '#fff' : '#9CA3AF', background: sel ? `${PURPLE}38` : 'rgba(255,255,255,0.04)', border: `1px solid ${sel ? PURPLE : 'transparent'}` }}>{w.label}</button> })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Особые условия</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {([['none', 'Без условий'], ['hs', 'Only HS']] as const).map(([k, lbl]) => { const sel = condition === k; return <button key={k} onClick={() => setCondition(k)} style={{ flex: 1, padding: '11px 0', borderRadius: 11, cursor: 'pointer', fontSize: 13.5, fontWeight: 800, color: sel ? '#fff' : '#9CA3AF', background: sel ? 'rgba(232,9,46,0.18)' : 'rgba(255,255,255,0.04)', border: `1px solid ${sel ? RED : 'transparent'}` }}>{lbl}</button> })}
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Ссылка на лобби</div>
        <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://link.standoff2.com/…/lobby/join/…" style={{ width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 13, color: '#fff', background: 'rgba(255,255,255,0.04)', border: `1px solid ${link && !linkOk ? '#EF4444' : 'rgba(255,255,255,0.08)'}`, outline: 'none', boxSizing: 'border-box', marginBottom: 18 }} />
        <button onClick={submit} disabled={!canSave} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 800, color: '#fff', background: canSave ? `linear-gradient(135deg, ${PURPLE}, #7c3aed)` : 'rgba(255,255,255,0.06)', opacity: canSave ? 1 : 0.5 }}>{saving ? 'Создаём…' : 'Создать лобби'}</button>
      </motion.div>
    </motion.div>
  )
}

export default function WebDM() {
  const router = useRouter()
  const { user } = useAuthStore()
  const [q, setQ] = useState<QueueStatus | null>(null)
  const [pro, setPro] = useState<ProLobby[]>([])
  const [busy, setBusy] = useState(false)
  const [creating, setCreating] = useState(false)
  const [now, setNow] = useState(Date.now())

  const loadQueue = useCallback(async () => { try { const r = await api.get('/dm/queue/status'); setQ(r.data); if (r.data?.activeMatchId) router.push(`/dm/match/${r.data.activeMatchId}`) } catch {} }, [router])
  const loadPro = useCallback(async () => { try { setPro((await api.get('/dm/pro')).data) } catch {} }, [])

  useEffect(() => {
    loadQueue(); loadPro()
    const s = connectSocket()
    const onQ = () => loadQueue(); const onFound = (d: { id: string }) => router.push(`/dm/match/${d.id}`); const onPro = () => loadPro()
    s.on('dm_queue_updated', onQ); s.on('dm_match_found', onFound); s.on('dm_pro_updated', onPro)
    const poll = setInterval(loadQueue, 3000); const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { s.off('dm_queue_updated', onQ); s.off('dm_match_found', onFound); s.off('dm_pro_updated', onPro); clearInterval(poll); clearInterval(tick) }
  }, [loadQueue, loadPro, router])

  const join = async () => { setBusy(true); try { const r = await api.post('/dm/queue/join'); setQ(r.data); if (r.data?.activeMatchId) router.push(`/dm/match/${r.data.activeMatchId}`) } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setBusy(false) } }
  const leave = async () => { setBusy(true); try { setQ((await api.post('/dm/queue/leave')).data) } catch {} finally { setBusy(false) } }
  const removePro = async (id: number) => { if (!confirm('Удалить лобби?')) return; try { await api.delete(`/dm/pro/${id}`); loadPro() } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } }

  if (!user) return null
  const inQueue = q?.inQueue
  const countdownLeft = q?.countdownExpires ? q.countdownExpires - now : null

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 18, display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 50, height: 50, borderRadius: 15, background: `linear-gradient(135deg, ${ORANGE}, ${RED})`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 22px ${ORANGE}66` }}><Icon name="flame" size={26} color="#fff" /></div>
        <div><h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.03em', margin: 0 }}>CONDR DM</h1><div style={{ fontSize: 14, color: '#6B7280', marginTop: 3 }}>Дезматч без рейтинга и статистики.</div></div>
      </motion.div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: 18, alignItems: 'start' }}>
        {/* RANDOM queue */}
        <div>
          <div style={{ fontSize: 12, color: '#E5E7EB', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 3, height: 14, borderRadius: 2, background: ORANGE }} />Рандом</div>
          <AnimatePresence mode="wait">
            {inQueue ? (
              <motion.div key="inq" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} style={{ borderRadius: 20, padding: 20, position: 'relative', overflow: 'hidden', background: `radial-gradient(120% 120% at 0% 0%, ${ORANGE}1f, transparent 55%), ${CARD}`, border: `1px solid ${ORANGE}44` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1, repeat: Infinity }} style={{ width: 9, height: 9, borderRadius: '50%', background: ORANGE }} />
                  <span style={{ fontWeight: 900, fontSize: 15, flex: 1 }}>Поиск DM-лобби</span>
                  <span style={{ fontSize: 14, fontWeight: 900, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>{q!.size}/{q!.max}</span>
                </div>
                {countdownLeft != null && countdownLeft > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '9px 13px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Icon name="timer" size={15} color={ORANGE} /><span style={{ fontSize: 12, color: '#9CA3AF', flex: 1 }}>Старт через</span><span style={{ fontSize: 18, fontWeight: 900, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{mmss(countdownLeft)}</span>
                  </div>
                )}
                <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}><motion.div animate={{ width: `${(q!.size / q!.max) * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} style={{ height: '100%', borderRadius: 3, background: `linear-gradient(90deg, ${ORANGE}, ${RED})` }} /></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 6, marginBottom: 14 }}>
                  {Array.from({ length: q!.max }).map((_, i) => { const m = q!.members[i]; if (m) { const bg = avatarBg(m.avatarUrl); return <div key={m.id} style={{ position: 'relative', width: '100%', aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', boxSizing: 'border-box', border: `2px solid ${m.id === user.id ? RED : ORANGE + '55'}`, background: bg || 'linear-gradient(135deg,#374151,#1f2937)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{!bg && <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>{(m.nickname || '?')[0].toUpperCase()}</span>}</div> } return <div key={`e${i}`} style={{ width: '100%', aspectRatio: '1', borderRadius: '50%', boxSizing: 'border-box', border: '1.5px dashed rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.02)' }} /> })}
                </div>
                <button onClick={leave} disabled={busy} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.05)', color: '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="x" size={14} color="#9CA3AF" /> Выйти из очереди</button>
              </motion.div>
            ) : (
              <motion.button key="rnd" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} whileTap={{ scale: 0.98 }} onClick={join} disabled={busy}
                style={{ width: '100%', borderRadius: 20, border: 'none', cursor: 'pointer', padding: '28px 0', position: 'relative', overflow: 'hidden', background: `linear-gradient(135deg, ${ORANGE}, ${RED})`, boxShadow: `0 10px 36px ${ORANGE}55, inset 0 1px 0 rgba(255,255,255,0.18)`, opacity: busy ? 0.6 : 1 }}>
                <motion.div animate={{ x: ['-100%', '220%'] }} transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 2, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '34%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)', pointerEvents: 'none' }} />
                <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Icon name="flame" size={26} color="#fff" /><span style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '0.02em' }}>{busy ? 'ПОДКЛЮЧАЕМСЯ…' : 'РАНДОМ'}</span></div>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>До 16 игроков · карта голосованием</span>
                </div>
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* PRO lobbies */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontSize: 12, color: '#E5E7EB', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em', display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ width: 3, height: 14, borderRadius: 2, background: PURPLE }} />DM от PRO</span>
            {(user as any).isDmHost && <button onClick={() => setCreating(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 11, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${PURPLE}, #7c3aed)`, color: '#fff', fontSize: 13, fontWeight: 800, boxShadow: `0 4px 14px ${PURPLE}55` }}><Icon name="plus" size={15} color="#fff" />Создать лобби</button>}
          </div>
          {pro.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: '#6B7280', borderRadius: 18, background: CARD, border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: 18, background: `${PURPLE}14`, border: `1px solid ${PURPLE}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="crown" size={26} color={PURPLE} /></div>
              <div style={{ fontSize: 14 }}>Пока нет активных PRO-лобби</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {pro.map(l => <ProTile key={l.id} l={l} mine={l.hostId === user.id} onDelete={() => removePro(l.id)} />)}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>{creating && <CreateProModal onClose={() => setCreating(false)} onSaved={() => { setCreating(false); loadPro() }} />}</AnimatePresence>
    </div>
  )
}
