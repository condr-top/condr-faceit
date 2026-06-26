'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useMatchStore } from '@/store/matchStore'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'
import { Avatar } from '@/components/ui/Avatar'
import { EloRing } from '@/components/ui/EloRing'
import { getEloRank } from '@/lib/eloRank'
import { Icon } from '@/components/ui/Icon'

const ACCENT = '#E8092E'
const mapImg = (n: string) => `/maps/${n.charAt(0).toUpperCase()}${n.slice(1).toLowerCase()}.webp`
const mapLabel = (n: string) => n.charAt(0) + n.slice(1).toLowerCase()

export default function WebMatch() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuthStore()
  const { currentMatch, fetchMatch } = useMatchStore()
  const [players, setPlayers] = useState<Record<number, any>>({})
  const [scoreA, setScoreA] = useState(''); const [scoreB, setScoreB] = useState('')
  const [shot, setShot] = useState<File | null>(null); const [shotPrev, setShotPrev] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [linkInput, setLinkInput] = useState(''); const [savingLink, setSavingLink] = useState(false)
  const [unlockLeft, setUnlockLeft] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchMatch(Number(id))
    const s = connectSocket()
    s.emit('join_match', Number(id))
    s.on('match_updated', (m: any) => useMatchStore.setState({ currentMatch: m }))
    const poll = setInterval(() => fetchMatch(Number(id)), 3000)
    return () => { s.off('match_updated'); s.emit('leave_match', Number(id)); clearInterval(poll) }
  }, [id])

  useEffect(() => {
    const ids = [...new Set([...(currentMatch?.teamAIds ?? []), ...(currentMatch?.teamBIds ?? [])])].filter(Boolean)
    if (!ids.length) return
    api.get('/users/batch', { params: { ids: ids.join(',') } }).then(r => {
      if (!Array.isArray(r.data)) return
      const map: Record<number, any> = {}; r.data.forEach((p: any) => { map[p.id] = p })
      setPlayers(prev => ({ ...prev, ...map }))
    }).catch(() => {})
  }, [id, currentMatch?.status, currentMatch?.teamAIds?.join(','), currentMatch?.teamBIds?.join(',')])

  useEffect(() => {
    if (currentMatch?.status !== 'in_progress' || !currentMatch.startedAt) { setUnlockLeft(null); return }
    const tick = () => setUnlockLeft(Math.max(0, Math.ceil((5 * 60 * 1000 - (Date.now() - new Date(currentMatch.startedAt!).getTime())) / 1000)))
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t)
  }, [currentMatch?.status, currentMatch?.startedAt])

  if (!currentMatch || !user) return <div style={{ padding: 60, textAlign: 'center' }}><motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: ACCENT, margin: '0 auto' }} /></div>

  const m = currentMatch
  const allIds = [...m.teamAIds, ...m.teamBIds]
  const isFull = new Set(allIds).size === allIds.length
  const filled = new Set(allIds).size
  const total = allIds.length
  const inA = m.teamAIds.includes(user.id), inB = m.teamBIds.includes(user.id)
  const myTeam: 'A' | 'B' | null = inA ? 'A' : inB ? 'B' : null
  const myCaptain = myTeam === 'A' ? m.captainAId : myTeam === 'B' ? m.captainBId : null
  const iAmCaptain = user.id === myCaptain
  const isMyVetoTurn = m.vetoTurn === myTeam && iAmCaptain
  const teamASide = m.teamASide, teamBSide = teamASide === 'T' ? 'CT' : teamASide === 'CT' ? 'T' : null
  const mySide = myTeam === 'A' ? teamASide : myTeam === 'B' ? teamBSide : null
  const isHost = m.hostId === user.id
  const mySubmitted = (myTeam === 'A' && !!m.resultScreenshotA) || (myTeam === 'B' && !!m.resultScreenshotB)
  const voiceLink = mySide === 'T' ? m.voiceInviteT : mySide === 'CT' ? m.voiceInviteCT : (m.voiceInviteT || m.voiceInviteCT)

  const ready = () => api.post(`/matches/${id}/ready`).catch((e: any) => alert(e?.response?.data?.message || 'Ошибка'))
  const veto = (map: string) => api.post(`/matches/${id}/veto`, { map }).catch((e: any) => alert(e?.response?.data?.message || 'Ошибка'))
  const leave = async () => { await api.post('/matches/lobby/leave').catch(() => {}); router.push('/web') }
  const publishLink = async () => {
    const val = linkInput.trim(); if (!val) return
    setSavingLink(true)
    try { await api.post(`/matches/${id}/lobby-link`, { link: val }); setLinkInput('') } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setSavingLink(false) }
  }
  const joinLobby = () => api.post(`/matches/${id}/lobby-join`).catch(() => {})
  const onShot = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (!f) return; setShot(f); setShotPrev(URL.createObjectURL(f)) }
  const submitResult = async () => {
    if (!shot || !scoreA || !scoreB) return
    setSubmitting(true)
    try {
      const fd = new FormData(); fd.append('screenshot', shot)
      const token = localStorage.getItem('condr_faceit_token')
      const up = await fetch(`/api/matches/${id}/screenshot`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
      if (!up.ok) throw new Error('Ошибка загрузки скрина')
      const { url } = await up.json()
      await api.post(`/matches/${id}/result`, { scoreA: Number(scoreA), scoreB: Number(scoreB), screenshotUrl: url })
      fetchMatch(Number(id))
    } catch (e: any) { alert(e?.message || e?.response?.data?.message || 'Ошибка') } finally { setSubmitting(false) }
  }

  const Roster = ({ team, side }: { team: 'A' | 'B'; side: string | null }) => {
    const ids = team === 'A' ? m.teamAIds : m.teamBIds
    const cap = team === 'A' ? m.captainAId : m.captainBId
    const mine = myTeam === team
    const sideColor = side === 'T' ? '#EAB308' : side === 'CT' ? '#60A5FA' : '#6B7280'
    return (
      <div style={{ flex: 1, borderRadius: 18, padding: 16, background: mine ? `radial-gradient(120% 120% at 50% 0%, ${sideColor}14, transparent 55%), rgba(255,255,255,0.02)` : 'rgba(255,255,255,0.02)', border: `1px solid ${mine ? sideColor + '33' : 'rgba(255,255,255,0.07)'}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, marginBottom: 14, fontSize: 13, fontWeight: 800, color: sideColor }}>
          {side === 'T' ? <><Icon name="terrorist" size={15} color={sideColor} />Террористы</> : side === 'CT' ? <><Icon name="shield" size={15} color={sideColor} />Спецназ</> : `Команда ${team}`}
          {mine && <span style={{ fontSize: 10, color: '#fff', background: sideColor, padding: '1px 7px', borderRadius: 6 }}>ВЫ</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[...new Set(ids)].map(pid => {
            const p = players[pid] || {}
            const rk = getEloRank(p.elo ?? 1000)
            return (
              <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px', borderRadius: 12, background: pid === user.id ? `${sideColor}12` : 'rgba(255,255,255,0.02)', border: `1px solid ${pid === user.id ? sideColor + '30' : 'rgba(255,255,255,0.05)'}` }}>
                <Avatar avatarUrl={p.avatarUrl} name={p.gameNickname || `#${pid}`} size={34} style={{ border: `2px solid ${rk.color}40` }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.gameNickname || `Игрок ${pid}`}</span>
                    {pid === cap && <Icon name="crown" size={12} color="#FFD700" />}
                    {p.isVerified && <Icon name="verified" size={12} color="#60A5FA" />}
                  </div>
                  <div style={{ fontSize: 10.5, color: rk.color, fontWeight: 700 }}>{rk.label} · {p.elo ?? '—'} ELO</div>
                </div>
                <EloRing elo={p.elo ?? 1000} size={28} showLabel={false} />
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Status chrome ──
  const statusMeta: Record<string, { label: string; color: string }> = {
    ready_check: { label: isFull ? 'Проверка готовности' : 'Поиск игроков', color: ACCENT },
    map_veto: { label: 'Выбор карты', color: '#A855F7' },
    in_progress: { label: 'Матч идёт', color: '#22C55E' },
    completed: { label: 'Матч завершён', color: '#6B7280' },
    cancelled: { label: 'Матч отменён', color: '#EF4444' },
  }
  const sm = statusMeta[m.status] || { label: m.status, color: '#6B7280' }
  const over = m.status === 'completed' || m.status === 'cancelled'

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>
      <button onClick={() => router.push('/web')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#9CA3AF', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginBottom: 14, padding: 0 }}>
        <Icon name="chevronLeft" size={18} color="#9CA3AF" /> К дашборду
      </button>

      {/* Status header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 15px', borderRadius: 12, background: `${sm.color}14`, border: `1px solid ${sm.color}40` }}>
            <motion.div animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }} transition={{ duration: 1.1, repeat: Infinity }} style={{ width: 8, height: 8, borderRadius: '50%', background: sm.color }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: sm.color }}>{sm.label}</span>
          </div>
          <span style={{ fontSize: 12, color: '#4B5563', fontWeight: 700 }}>Матч #{m.id}</span>
        </div>
        {(over || mySubmitted) && <button onClick={() => router.push('/web')} style={{ padding: '8px 16px', borderRadius: 11, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Выйти</button>}
      </div>

      {/* READY CHECK — filling */}
      {m.status === 'ready_check' && !isFull && (
        <div style={{ textAlign: 'center', padding: '30px 0' }}>
          <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 6 }}>Подбираем игроков</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Лобби общее с приложением · {filled}/{total}</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap', maxWidth: 420, margin: '0 auto 24px' }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{ width: 44, height: 44, borderRadius: 12, background: i < filled ? `${ACCENT}22` : 'rgba(255,255,255,0.03)', border: `1.5px solid ${i < filled ? ACCENT : 'rgba(255,255,255,0.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {i < filled ? <Icon name="check" size={18} color={ACCENT} /> : <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />}
              </div>
            ))}
          </div>
          <button onClick={leave} style={{ padding: '10px 22px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Выйти из очереди</button>
        </div>
      )}

      {/* READY CHECK — full, confirm */}
      {m.status === 'ready_check' && isFull && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 20, fontWeight: 900 }}>Подтвердите готовность</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>{m.readyPlayers?.length ?? 0}/{filled} готовы</div>
          </div>
          <div style={{ display: 'flex', gap: 14, marginBottom: 18 }}><Roster team="A" side={null} /><Roster team="B" side={null} /></div>
          {myTeam && (m.readyPlayers?.includes(user.id)
            ? <div style={{ textAlign: 'center', padding: '14px 0', borderRadius: 14, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontWeight: 800 }}>✓ Вы готовы · ждём остальных</div>
            : <button onClick={ready} style={{ width: '100%', padding: '16px 0', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #b8001e)`, boxShadow: `0 8px 28px ${ACCENT}44` }}>Подтвердить готовность</button>)}
        </div>
      )}

      {/* MAP VETO */}
      {m.status === 'map_veto' && (
        <div>
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{ fontSize: 19, fontWeight: 900 }}>Выбор карты</div>
            <div style={{ fontSize: 13, color: isMyVetoTurn ? '#A855F7' : '#6B7280', marginTop: 5, fontWeight: 700 }}>
              {isMyVetoTurn ? 'Ваш ход — забаньте карту' : iAmCaptain ? 'Ход соперника…' : `Капитаны выбирают карту · ход команды ${m.vetoTurn}`}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {(m.availableMaps ?? []).map((mp: string) => (
              <button key={mp} onClick={() => isMyVetoTurn && veto(mp)} disabled={!isMyVetoTurn}
                style={{ position: 'relative', height: 100, borderRadius: 14, overflow: 'hidden', border: 'none', padding: 0, cursor: isMyVetoTurn ? 'pointer' : 'default' }}>
                <div style={{ position: 'absolute', inset: 0, background: `url(${mapImg(mp)}) center/cover` }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0.1))' }} />
                {isMyVetoTurn && <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity .15s', background: 'rgba(239,68,68,0.3)' }} className="veto-hover" />}
                <span style={{ position: 'absolute', left: 10, bottom: 8, fontSize: 13, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.9)' }}>{mapLabel(mp)}</span>
                {isMyVetoTurn && <span style={{ position: 'absolute', top: 8, right: 8, fontSize: 9, fontWeight: 900, color: '#fff', background: 'rgba(239,68,68,0.85)', padding: '2px 7px', borderRadius: 6 }}>БАН</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* IN PROGRESS */}
      {m.status === 'in_progress' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* map banner */}
          {m.map && (
            <div style={{ position: 'relative', height: 130, borderRadius: 18, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', inset: 0, background: `url(${mapImg(m.map)}) center/cover` }} />
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(6,6,9,0.92), rgba(6,6,9,0.2))' }} />
              <div style={{ position: 'absolute', left: 18, bottom: 14 }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Карта</div>
                <div style={{ fontSize: 24, fontWeight: 900, textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>{mapLabel(m.map)}</div>
              </div>
            </div>
          )}

          {/* lobby link */}
          {isHost ? (
            <div style={{ borderRadius: 16, padding: 16, background: 'rgba(232,9,46,0.06)', border: '1px solid rgba(232,9,46,0.3)' }}>
              <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="link" size={15} color={ACCENT} />Вы хост — опубликуйте ссылку на лобби Standoff 2</div>
              {m.lobbyLink ? <div style={{ fontSize: 13, color: '#86efac', wordBreak: 'break-all' }}>✓ Ссылка опубликована: <a href={m.lobbyLink} target="_blank" rel="noreferrer" style={{ color: '#60A5FA' }}>{m.lobbyLink}</a></div>
                : <div style={{ display: 'flex', gap: 8 }}>
                  <input value={linkInput} onChange={e => setLinkInput(e.target.value)} placeholder="https://link.standoff2.com/…/lobby/join/…" style={{ flex: 1, padding: '11px 13px', borderRadius: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none' }} />
                  <button onClick={publishLink} disabled={savingLink} style={{ padding: '0 18px', borderRadius: 11, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #b8001e)` }}>{savingLink ? '…' : 'Опубликовать'}</button>
                </div>}
            </div>
          ) : m.lobbyLink ? (
            <div style={{ borderRadius: 16, padding: 16, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Icon name="link" size={18} color="#22C55E" />
              <a href={m.lobbyLink} target="_blank" rel="noreferrer" style={{ flex: 1, color: '#60A5FA', fontSize: 13, fontWeight: 700, wordBreak: 'break-all' }}>Перейти в лобби Standoff 2</a>
              {!m.lobbyJoinedPlayers?.includes(user.id) && <button onClick={joinLobby} style={{ padding: '9px 15px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 800, color: '#fff', background: 'linear-gradient(135deg, #22C55E, #16a34a)' }}>Я зашёл</button>}
            </div>
          ) : (
            <div style={{ borderRadius: 16, padding: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 13, color: '#9CA3AF', textAlign: 'center' }}>Ждём, пока хост опубликует ссылку на лобби…</div>
          )}

          {/* voice */}
          {voiceLink && (
            <a href={voiceLink} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, padding: '13px 0', borderRadius: 14, background: 'rgba(88,101,242,0.12)', border: '1px solid rgba(88,101,242,0.4)', color: '#a5b4fc', fontSize: 14, fontWeight: 800, textDecoration: 'none' }}>
              <Icon name="mic" size={17} color="#a5b4fc" /> Голосовой чат команды (Discord)
            </a>
          )}

          {/* rosters */}
          <div style={{ display: 'flex', gap: 14 }}><Roster team="A" side={teamASide} /><Roster team="B" side={teamBSide} /></div>

          {/* result submission (captains) */}
          {iAmCaptain && !mySubmitted && (
            unlockLeft && unlockLeft > 0 ? (
              <div style={{ textAlign: 'center', padding: '14px 0', borderRadius: 14, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 13, color: '#9CA3AF' }}>
                Внести результат можно через {Math.floor(unlockLeft / 60)}:{String(unlockLeft % 60).padStart(2, '0')}
              </div>
            ) : (
              <div style={{ borderRadius: 18, padding: 18, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 14, textAlign: 'center' }}>Внести результат матча</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 5 }}>Команда A</div><input value={scoreA} onChange={e => setScoreA(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="0" style={{ width: 60, textAlign: 'center', padding: '10px 0', borderRadius: 11, fontSize: 22, fontWeight: 900, color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }} /></div>
                  <span style={{ fontSize: 20, fontWeight: 900, color: '#4B5563' }}>:</span>
                  <div style={{ textAlign: 'center' }}><div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 5 }}>Команда B</div><input value={scoreB} onChange={e => setScoreB(e.target.value.replace(/\D/g, '').slice(0, 2))} inputMode="numeric" placeholder="0" style={{ width: 60, textAlign: 'center', padding: '10px 0', borderRadius: 11, fontSize: 22, fontWeight: 900, color: '#fff', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', outline: 'none' }} /></div>
                </div>
                <input ref={fileRef} type="file" accept="image/*" onChange={onShot} style={{ display: 'none' }} />
                <button onClick={() => fileRef.current?.click()} style={{ width: '100%', padding: '12px 0', borderRadius: 12, border: `1px dashed ${shotPrev ? '#22C55E' : 'rgba(255,255,255,0.2)'}`, background: shotPrev ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)', color: shotPrev ? '#22C55E' : '#9CA3AF', fontSize: 13, fontWeight: 700, cursor: 'pointer', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <Icon name={shotPrev ? 'check' : 'camera'} size={15} color={shotPrev ? '#22C55E' : '#9CA3AF'} />{shotPrev ? 'Скриншот выбран' : 'Прикрепить скриншот результата'}
                </button>
                <button onClick={submitResult} disabled={!shot || !scoreA || !scoreB || submitting} style={{ width: '100%', padding: '14px 0', borderRadius: 13, border: 'none', cursor: shot && scoreA && scoreB ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 900, color: '#fff', background: shot && scoreA && scoreB ? `linear-gradient(135deg, ${ACCENT}, #b8001e)` : 'rgba(255,255,255,0.06)', opacity: submitting ? 0.6 : 1 }}>{submitting ? 'Отправляем…' : 'Отправить результат'}</button>
              </div>
            )
          )}
          {mySubmitted && <div style={{ textAlign: 'center', padding: '14px 0', borderRadius: 14, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22C55E', fontWeight: 800 }}>✓ Ваша команда внесла результат</div>}
        </div>
      )}

      {/* COMPLETED / CANCELLED */}
      {over && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          {m.status === 'completed' && m.winnerTeam ? (
            <>
              <div style={{ fontSize: 16, fontWeight: 800, color: myTeam && m.winnerTeam === myTeam ? '#22C55E' : '#EF4444', marginBottom: 8 }}>{myTeam ? (m.winnerTeam === myTeam ? 'Победа! 🏆' : 'Поражение') : 'Матч завершён'}</div>
              <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-0.03em' }}>{m.scoreA ?? 0} : {m.scoreB ?? 0}</div>
            </>
          ) : <div style={{ fontSize: 18, fontWeight: 800, color: '#9CA3AF' }}>Матч {m.status === 'cancelled' ? 'отменён' : 'завершён'}</div>}
          <button onClick={() => router.push('/web')} style={{ marginTop: 22, padding: '12px 26px', borderRadius: 13, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #b8001e)` }}>На дашборд</button>
        </div>
      )}
    </div>
  )
}
