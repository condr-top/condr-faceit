'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { connectSocket } from '@/lib/socket'
import { Avatar } from '@/components/ui/Avatar'
import { Icon } from '@/components/ui/Icon'

const ORANGE = '#F97316'
const RED = '#E8092E'
const CARD = '#0f0f15'
const MAPS = ['PRISON', 'SANDSTONE', 'PROVINCE', 'BREEZE', 'HANAMI', 'RUST', 'DUNE']
const mapImg = (m: string) => `/maps/${m.charAt(0) + m.slice(1).toLowerCase()}.webp`
const mapLabel = (m: string) => m.charAt(0) + m.slice(1).toLowerCase()
const LOBBY_RE = /^https:\/\/link\.standoff2\.com\/.+\/lobby\/join\/.+/i

interface Player { id: number; nickname: string; avatarUrl: string | null; elo: number }
interface DmState {
  id: string; phase: 'vote' | 'live'; players: Player[]; hostId: number; isHost: boolean; inLobby: boolean
  voteExpires: number; voteCounts: Record<string, number>; myVote: string | null
  map: string | null; link: string | null; linkExpires: number
}

const mmss = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

export default function DmMatchPage() {
  return <RequireRegistration><Inner /></RequireRegistration>
}

function Inner() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const [m, setM] = useState<DmState | null>(null)
  const [now, setNow] = useState(Date.now())
  const [reveal, setReveal] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const [saving, setSaving] = useState(false)
  const prevPhase = useRef<string | null>(null)
  const gone = useRef(false)

  const load = useCallback(async () => {
    try {
      const r = await api.get(`/dm/match/${id}`)
      if (!r.data) { if (!gone.current) router.replace('/dm'); return }
      const data: DmState = r.data
      if (prevPhase.current === 'vote' && data.phase === 'live') { setReveal(true); setTimeout(() => setReveal(false), 2600) }
      prevPhase.current = data.phase
      setM(data)
      if (!data.inLobby && !gone.current) { gone.current = true; router.replace('/dm') }
    } catch { if (!gone.current) router.replace('/dm') }
  }, [id, router])

  useEffect(() => {
    load()
    const s = connectSocket()
    const onUpd = (d: { id: string }) => { if (d.id === id) load() }
    s.on('dm_match_updated', onUpd)
    const poll = setInterval(load, 2500)
    const tick = setInterval(() => setNow(Date.now()), 500)
    return () => { s.off('dm_match_updated', onUpd); clearInterval(poll); clearInterval(tick) }
  }, [load, id])

  const vote = async (map: string) => { try { setM((await api.post(`/dm/match/${id}/vote`, { map })).data) } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } }
  const leaveMatch = async () => { gone.current = true; try { await api.post(`/dm/match/${id}/leave`) } catch {} router.replace('/dm') }
  const submitLink = async () => {
    const v = linkInput.trim()
    if (!LOBBY_RE.test(v)) { alert('Вставьте ссылку на лобби Standoff 2\nПример: https://link.standoff2.com/ru/lobby/join/...'); return }
    setSaving(true)
    try { setM((await api.post(`/dm/match/${id}/link`, { link: v })).data) } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setSaving(false) }
  }

  if (!m) return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 30, height: 30, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: ORANGE }} />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '14px 14px 96px', maxWidth: 520, margin: '0 auto' }}>
      {/* Status chip */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 13px', borderRadius: 20, background: `${ORANGE}14`, border: `1px solid ${ORANGE}40` }}>
          <Icon name="flame" size={15} color={ORANGE} />
          <span style={{ fontSize: 12.5, fontWeight: 900, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em' }}>CONDR DM</span>
        </div>
        <button onClick={leaveMatch} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 11, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.1)', color: '#EF4444', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>
          <Icon name="logout" size={14} color="#EF4444" /> Выйти
        </button>
      </div>

      {m.phase === 'vote' ? <VoteView m={m} now={now} onVote={vote} /> : <LiveView m={m} now={now} userId={user?.id} linkInput={linkInput} setLinkInput={setLinkInput} saving={saving} onSubmitLink={submitLink} />}

      {/* Map reveal overlay */}
      <AnimatePresence>
        {reveal && m.map && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <motion.div initial={{ scale: 0.7, opacity: 0, rotateY: 40 }} animate={{ scale: 1, opacity: 1, rotateY: 0 }} transition={{ type: 'spring', stiffness: 180, damping: 18 }}
              style={{ width: 'min(86%, 360px)', borderRadius: 24, overflow: 'hidden', position: 'relative', border: `2px solid ${ORANGE}`, boxShadow: `0 0 50px ${ORANGE}66` }}>
              <div style={{ aspectRatio: '16/10', background: `url(${mapImg(m.map)}) center/cover` }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent 55%)' }} />
              <motion.div animate={{ x: ['-120%', '220%'] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }} style={{ position: 'absolute', top: 0, bottom: 0, width: '40%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)' }} />
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 18, textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 900, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.12em' }}>Карта выбрана</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', textShadow: `0 2px 20px ${ORANGE}88` }}>{mapLabel(m.map)}</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Voting ────────────────────────────────────────────────────────────────────────
function VoteView({ m, now, onVote }: { m: DmState; now: number; onVote: (map: string) => void }) {
  const left = m.voteExpires - now
  const totalSecs = 25
  const pct = Math.max(0, Math.min(1, left / 1000 / totalSecs))
  const R = 44, C = 2 * Math.PI * R

  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: 18 }}>
        <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 12px' }}>
          <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="50" cy="50" r={R} fill="none" stroke="rgba(249,115,22,0.15)" strokeWidth="5" />
            <motion.circle cx="50" cy="50" r={R} fill="none" stroke={ORANGE} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - pct) }} style={{ filter: `drop-shadow(0 0 6px ${ORANGE}88)` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 900, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>{Math.max(0, Math.ceil(left / 1000))}</div>
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Голосование за карту</div>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 3 }}>Победит карта с большинством голосов</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {MAPS.map((mp, i) => {
          const sel = m.myVote === mp
          const votes = m.voteCounts[mp] ?? 0
          return (
            <motion.button key={mp} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}
              whileTap={{ scale: 0.97 }} onClick={() => onVote(mp)}
              style={{ position: 'relative', height: 92, borderRadius: 16, overflow: 'hidden', cursor: 'pointer', border: 'none', padding: 0, boxShadow: sel ? `0 8px 22px ${ORANGE}44` : '0 2px 8px rgba(0,0,0,0.3)' }}>
              <div style={{ position: 'absolute', inset: 0, background: `url(${mapImg(mp)}) center/cover`, transform: sel ? 'scale(1.08)' : 'scale(1)', transition: 'transform .25s' }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.1) 60%)' }} />
              {sel && <div style={{ position: 'absolute', inset: 0, border: `2.5px solid ${ORANGE}`, borderRadius: 16, background: `${ORANGE}1c` }} />}
              {votes > 0 && (
                <div style={{ position: 'absolute', top: 7, right: 7, minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: sel ? ORANGE : 'rgba(0,0,0,0.6)', border: `1px solid ${sel ? ORANGE : 'rgba(255,255,255,0.2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, color: '#fff' }}>{votes}</div>
              )}
              <span style={{ position: 'absolute', left: 10, bottom: 8, fontSize: 13.5, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{mapLabel(mp)}</span>
              {sel && <div style={{ position: 'absolute', left: 10, top: 8, display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 900, color: '#fff', background: ORANGE, padding: '2px 6px', borderRadius: 5 }}><Icon name="check" size={9} color="#fff" />ВЫ</div>}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ── Live ────────────────────────────────────────────────────────────────────────
function LiveView({ m, now, userId, linkInput, setLinkInput, saving, onSubmitLink }: {
  m: DmState; now: number; userId?: number; linkInput: string; setLinkInput: (v: string) => void; saving: boolean; onSubmitLink: () => void
}) {
  const linkLeft = m.linkExpires - now
  return (
    <div>
      {/* Selected map hero */}
      {m.map && (
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }}
          style={{ borderRadius: 18, overflow: 'hidden', position: 'relative', marginBottom: 14, border: `1px solid ${ORANGE}40` }}>
          <div style={{ aspectRatio: '16/7', background: `url(${mapImg(m.map)}) center/cover` }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(8,8,11,0.95), rgba(0,0,0,0.2) 60%)' }} />
          <div style={{ position: 'absolute', left: 14, bottom: 11 }}>
            <div style={{ fontSize: 10, fontWeight: 900, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.1em' }}>Карта</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 2px 14px rgba(0,0,0,0.8)' }}>{mapLabel(m.map)}</div>
          </div>
        </motion.div>
      )}

      {/* Host lobby link */}
      <div style={{ borderRadius: 16, padding: 16, marginBottom: 14, background: `radial-gradient(120% 120% at 0% 0%, ${ORANGE}12, transparent 55%), ${CARD}`, border: `1px solid ${ORANGE}33` }}>
        {m.link ? (
          <>
            <div style={{ fontSize: 11, color: '#6B7280', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Icon name="link" size={13} color={ORANGE} />Лобби готово</div>
            <a href={m.link} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '14px 0', borderRadius: 13, fontSize: 15, fontWeight: 900, color: '#fff', textDecoration: 'none', background: `linear-gradient(135deg, ${ORANGE}, ${RED})`, boxShadow: `0 8px 24px ${ORANGE}50` }}>
              <Icon name="rocket" size={18} color="#fff" /> Подключиться к лобби
            </a>
          </>
        ) : m.isHost ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="crown" size={15} color="#FFD700" />
              <span style={{ fontSize: 13, fontWeight: 800, color: '#fff', flex: 1 }}>Вы — хост. Создайте лобби и вставьте ссылку</span>
              {linkLeft > 0 && <span style={{ fontSize: 13, fontWeight: 900, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>{mmss(linkLeft)}</span>}
            </div>
            <input value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="https://link.standoff2.com/…/lobby/join/…"
              style={{ width: '100%', padding: '12px 14px', borderRadius: 12, fontSize: 13, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }} />
            <button onClick={onSubmitLink} disabled={saving} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${ORANGE}, ${RED})`, boxShadow: `0 6px 18px ${ORANGE}44`, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Публикуем…' : 'Опубликовать ссылку'}
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.1, repeat: Infinity, ease: 'linear' }} style={{ width: 22, height: 22, borderRadius: '50%', border: '2.5px solid rgba(249,115,22,0.25)', borderTopColor: ORANGE, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Хост готовит лобби…</div>
              <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 1 }}>Ссылка появится здесь автоматически</div>
            </div>
            {linkLeft > 0 && <span style={{ fontSize: 14, fontWeight: 900, color: ORANGE, fontVariantNumeric: 'tabular-nums' }}>{mmss(linkLeft)}</span>}
          </div>
        )}
      </div>

      {/* Players (single list, no teams) */}
      <div style={{ background: CARD, borderRadius: 16, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ padding: '13px 16px 10px', fontSize: 13, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', justifyContent: 'space-between' }}>
          <span>Игроки</span><span style={{ color: '#4B5563' }}>{m.players.length}</span>
        </div>
        {m.players.map((p, i) => (
          <motion.div key={p.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}
            style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <Avatar avatarUrl={p.avatarUrl} name={p.nickname} size={36} style={{ border: `1px solid ${p.id === m.hostId ? '#FFD70066' : 'rgba(255,255,255,0.08)'}` }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: p.id === userId ? ORANGE : '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{p.nickname}</span>
                {p.id === m.hostId && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9, fontWeight: 900, color: '#FFD700', background: 'rgba(255,215,0,0.12)', padding: '2px 6px', borderRadius: 5 }}><Icon name="crown" size={9} color="#FFD700" />ХОСТ</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
