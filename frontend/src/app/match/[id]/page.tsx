'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useParams, useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { useMatchStore } from '@/store/matchStore'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'
import { MAPS } from '@/lib/constants'
import { playMatchFound, playReadyCheck } from '@/lib/sounds'

// Shared card style
const cardStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 14,
  padding: '14px',
}

export default function MatchPage() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const { currentMatch, fetchMatch, setMatch } = useMatchStore()
  const router = useRouter()
  const [countdown, setCountdown] = useState(30)

  const [scoreA, setScoreA] = useState('')
  const [scoreB, setScoreB] = useState('')
  const [screenshot, setScreenshot] = useState<File | null>(null)
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [players, setPlayers] = useState<Record<number, { gameNickname: string; gameId: string }>>({})
  const [lobbyLinkInput, setLobbyLinkInput] = useState('')
  const [lobbyLinkSaving, setLobbyLinkSaving] = useState(false)
  const [submitUnlockSecondsLeft, setSubmitUnlockSecondsLeft] = useState<number | null>(null)
  const [resultDeadlineLeft, setResultDeadlineLeft] = useState<number | null>(null)

  useEffect(() => {
    const teamAIds = currentMatch?.teamAIds ?? []
    const teamBIds = currentMatch?.teamBIds ?? []
    const ids = [...new Set([...teamAIds, ...teamBIds])].filter(Boolean)
    if (!ids.length) return
    api.get('/users/batch', { params: { ids: ids.join(',') } })
      .then((r) => {
        if (!Array.isArray(r.data) || !r.data.length) return
        const map: Record<number, { gameNickname: string; gameId: string }> = {}
        r.data.forEach((p: any) => { map[p.id] = { gameNickname: p.gameNickname, gameId: p.gameId } })
        setPlayers((prev) => ({ ...prev, ...map }))
      })
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentMatch?.status, currentMatch?.teamAIds?.join(','), currentMatch?.teamBIds?.join(',')])

  // Track previous lobby fullness to play sound exactly once when lobby fills
  const prevLobbyFullRef = useRef(false)

  useEffect(() => {
    fetchMatch(Number(id))
    const socket = connectSocket()
    socket.emit('join_match', Number(id))
    socket.on('match_updated', (match: any) => {
      setMatch(match)
      // Play sound when lobby becomes full (ready check timer starts)
      const allIds = [...(match.teamAIds ?? []), ...(match.teamBIds ?? [])]
      const isFull = new Set(allIds).size === allIds.length && allIds.length >= 4
      if (isFull && !prevLobbyFullRef.current) {
        playReadyCheck()
      }
      prevLobbyFullRef.current = isFull
    })
    const poll = setInterval(() => fetchMatch(Number(id)), 3000)
    return () => {
      socket.off('match_updated')
      socket.emit('leave_match', Number(id))
      clearInterval(poll)
    }
  }, [id])

  // Block ALL back navigation until player's team has submitted or match is over
  useEffect(() => {
    if (!currentMatch) return

    const mySubmitted = currentMatch.teamAIds?.includes(user?.id ?? -1)
      ? !!currentMatch.resultScreenshotA
      : currentMatch.teamBIds?.includes(user?.id ?? -1)
        ? !!currentMatch.resultScreenshotB
        : true
    const over =
      currentMatch.status === 'completed'      ||
      currentMatch.status === 'cancelled'      ||
      currentMatch.status === 'result_pending' ||
      currentMatch.status === 'ready_check'    ||
      mySubmitted

    // Telegram WebApp back button
    const tg = (window as any).Telegram?.WebApp
    if (tg) {
      if (over) {
        tg.BackButton?.hide()
      } else {
        tg.BackButton?.show()
        const tgHandler = () => { /* intentionally block */ }
        tg.BackButton?.onClick(tgHandler)
        // Don't return cleanup here — handle in else cleanup
      }
    }

    if (over) return

    // Push a fake history entry so browser back button stays on this page
    window.history.pushState(null, '', window.location.href)

    const onPopState = () => {
      // Re-push so the user can't navigate back
      window.history.pushState(null, '', window.location.href)
    }

    window.addEventListener('popstate', onPopState)
    return () => {
      window.removeEventListener('popstate', onPopState)
      tg?.BackButton?.hide()
    }
  }, [currentMatch?.status, currentMatch?.resultScreenshotA, currentMatch?.resultScreenshotB])

  useEffect(() => {
    if (currentMatch?.status !== 'ready_check' || !currentMatch.readyCheckExpires) return
    const expires = new Date(currentMatch.readyCheckExpires).getTime()
    const interval = setInterval(async () => {
      const left = Math.max(0, Math.ceil((expires - Date.now()) / 1000))
      setCountdown(left)
      if (left === 0) {
        clearInterval(interval)
        await api.post(`/matches/${id}/expire`).catch(() => {})
        router.push('/dashboard')
      }
    }, 500)
    return () => clearInterval(interval)
  }, [currentMatch?.status, currentMatch?.readyCheckExpires])

  const ready = async () => {
    await api.post(`/matches/${id}/ready`)
  }

  const leaveQueue = async () => {
    await api.post('/matches/lobby/leave').catch(() => {})
    router.back()
  }

  const veto = async (map: string) => {
    await api.post(`/matches/${id}/veto`, { map })
  }

  useEffect(() => {
    if (currentMatch?.status !== 'in_progress' || !currentMatch.startedAt) return
    const UNLOCK_MS = 5 * 60 * 1000
    const tick = () => {
      const elapsed = Date.now() - new Date(currentMatch.startedAt!).getTime()
      const left = Math.max(0, Math.ceil((UNLOCK_MS - elapsed) / 1000))
      setSubmitUnlockSecondsLeft(left)
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [currentMatch?.status, currentMatch?.startedAt])

  useEffect(() => {
    if (currentMatch?.status !== 'in_progress' || !currentMatch.firstResultAt) return
    const bothSubmitted = !!currentMatch.resultScreenshotA && !!currentMatch.resultScreenshotB
    if (bothSubmitted) return
    const DEADLINE_MS = 10 * 60 * 1000
    const tick = async () => {
      const elapsed = Date.now() - new Date(currentMatch.firstResultAt!).getTime()
      const left = Math.max(0, Math.ceil((DEADLINE_MS - elapsed) / 1000))
      setResultDeadlineLeft(left)
      if (left === 0) {
        await api.post(`/matches/${id}/expire-result`).catch(() => {})
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [currentMatch?.status, currentMatch?.firstResultAt, currentMatch?.resultScreenshotA, currentMatch?.resultScreenshotB])

  const LOBBY_RE = /^https:\/\/link\.standoff2\.com\/.+\/lobby\/join\/.+/i

  const saveLobbyLink = async () => {
    const val = lobbyLinkInput.trim()
    if (!val) return
    if (!LOBBY_RE.test(val)) {
      alert('Вставьте ссылку на лобби Standoff 2\nПример: https://link.standoff2.com/ru/lobby/join/...')
      return
    }
    setLobbyLinkSaving(true)
    try {
      await api.post(`/matches/${id}/lobby-link`, { link: val })
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка')
    } finally {
      setLobbyLinkSaving(false)
    }
  }

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScreenshot(file)
    setScreenshotPreview(URL.createObjectURL(file))
  }

  const submitResult = async () => {
    if (!screenshot || !scoreA || !scoreB) return
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append('screenshot', screenshot)
      const token = localStorage.getItem('condr_faceit_token')
      const uploadRes = await fetch(`/api/matches/${id}/screenshot`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      if (!uploadRes.ok) throw new Error('Ошибка загрузки скрина')
      const { url: screenshotUrl } = await uploadRes.json()
      await api.post(`/matches/${id}/result`, {
        scoreA: Number(scoreA),
        scoreB: Number(scoreB),
        screenshotUrl,
      })
      setSubmitted(true)
      fetchMatch(Number(id))
    } catch (e: any) {
      alert(e?.message || e?.response?.data?.message || 'Ошибка')
    } finally {
      setSubmitting(false)
    }
  }

  if (!currentMatch || !user) return null

  // Map image helper — WebP for fast loading (converted from JPG, ~78% smaller)
  const mapImg = (name: string) => `/maps/${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()}.webp`

  const playerName = (pid: number) => players[pid]?.gameNickname || `Игрок ${pid}`
  const hostId = currentMatch.hostId
  const allSlotIds = [...currentMatch.teamAIds, ...currentMatch.teamBIds]
  const isLobbyFull = new Set(allSlotIds).size === allSlotIds.length
  const totalSlots = allSlotIds.length
  const filledSlots = new Set(allSlotIds).size

  const inA = currentMatch.teamAIds.includes(user.id)
  const inB = currentMatch.teamBIds.includes(user.id)
  const onlyInA = inA && currentMatch.teamAIds.filter(id => id === user.id).length > 0
                    && !currentMatch.teamBIds.filter(id => id === user.id).length
  const onlyInB = inB && !currentMatch.teamAIds.filter(id => id === user.id).length
  const myTeam = onlyInA ? 'A' : onlyInB ? 'B' : inA ? 'A' : inB ? 'B' : null
  const isTeamA = myTeam === 'A'
  const isTeamB = myTeam === 'B'
  const captainA = currentMatch.captainAId
  const captainB = currentMatch.captainBId
  const myCaptainId = isTeamA ? captainA : isTeamB ? captainB : null
  const iAmCaptain = user.id === myCaptainId
  const isMyVetoTurn = currentMatch.vetoTurn === myTeam && iAmCaptain
  const teamASide = currentMatch.teamASide
  const teamBSide = teamASide === 'T' ? 'CT' : teamASide === 'CT' ? 'T' : null
  const mySide = isTeamA ? teamASide : isTeamB ? teamBSide : null

  const alreadySubmitted =
    (isTeamA && !!currentMatch.resultScreenshotA) ||
    (isTeamB && !!currentMatch.resultScreenshotB)

  // Exit rules:
  // - Always allowed when match is over (completed / cancelled)
  // - Allowed when YOUR team's captain has already submitted a screenshot
  //   (you did your part — not your fault the other team is slow)
  const myTeamSubmitted = isTeamA
    ? !!currentMatch.resultScreenshotA
    : isTeamB
      ? !!currentMatch.resultScreenshotB
      : false
  const canExit =
    currentMatch.status === 'completed'     ||
    currentMatch.status === 'cancelled'     ||
    currentMatch.status === 'result_pending'||
    currentMatch.status === 'ready_check'   ||  // searching / waiting — always free to leave
    myTeamSubmitted

  const submitUnlocked = submitUnlockSecondsLeft === 0
  const lobbyLinkReady = !!currentMatch.lobbyLink
  const formatUnlock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    ready_check:    { label: 'Проверка готовности', color: '#E8092E',  bg: 'rgba(232,9,46,0.15)'  },
    map_veto:       { label: 'Вето карт',           color: '#F59E0B',  bg: 'rgba(245,158,11,0.15)' },
    in_progress:    { label: 'Идёт',                color: '#22C55E',  bg: 'rgba(34,197,94,0.15)'  },
    result_pending: { label: 'Ожидает решения',     color: '#60A5FA',  bg: 'rgba(96,165,250,0.15)' },
    completed:      { label: 'Завершён',            color: '#A855F7',  bg: 'rgba(168,85,247,0.15)' },
    cancelled:      { label: 'Отменён',             color: '#4B5563',  bg: 'rgba(75,85,99,0.15)'   },
  }
  const st = statusConfig[currentMatch.status] || { label: currentMatch.status, color: '#9CA3AF', bg: 'rgba(156,163,175,0.15)' }

  const matchMapBg = currentMatch.map ? mapImg(currentMatch.map) : null
  const hasMapBg = !!matchMapBg && ['in_progress','map_veto','completed','result_pending'].includes(currentMatch.status)

  return (
    <div style={{ minHeight: '100vh', background: '#060608', paddingBottom: 32, position: 'relative', overflowX: 'hidden' }}>
      {/* Dynamic map background */}
      <AnimatePresence>
        {hasMapBg && (
          <motion.div
            key={currentMatch.map}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 0,
              backgroundImage: `url(${matchMapBg})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: currentMatch.status === 'completed' ? 'blur(3px) brightness(0.15)' : 'blur(2px) brightness(0.12)',
            }}
          />
        )}
      </AnimatePresence>
      {/* Gradient overlay */}
      {hasMapBg && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 0,
          background: 'linear-gradient(180deg, rgba(6,6,8,0.3) 0%, rgba(6,6,8,0.7) 60%, rgba(6,6,8,0.95) 100%)',
        }} />
      )}

      <div style={{ position: 'relative', zIndex: 1, padding: '0 16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 18, marginBottom: 14 }}>
          {canExit ? (
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={async () => {
                if (currentMatch.status === 'ready_check') await api.post('/matches/lobby/leave').catch(() => {})
                router.replace('/dashboard')
              }}
              style={{
                background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                padding: '7px 12px', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', fontWeight: 700,
              }}
            >← {currentMatch.status === 'ready_check' ? 'Покинуть' : 'Выйти'}</motion.button>
          ) : (
            <div style={{
              background: 'rgba(232,9,46,0.1)', backdropFilter: 'blur(10px)',
              border: '1px solid rgba(232,9,46,0.25)', borderRadius: 10,
              padding: '7px 12px', fontSize: 11, color: '#E8092E', fontWeight: 800,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <motion.div animate={{ opacity: [1,0.4,1] }} transition={{ duration: 1.2, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#E8092E' }} />
              МАТЧ ИДЁТ
            </div>
          )}
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              МАТЧ #{currentMatch.id}
            </div>
          </div>
          <motion.span
            animate={{ boxShadow: [`0 0 0px ${st.color}`, `0 0 10px ${st.color}60`, `0 0 0px ${st.color}`] }}
            transition={{ duration: currentMatch.status === 'in_progress' ? 2 : 999, repeat: Infinity }}
            style={{
              fontSize: 9, fontWeight: 800, padding: '4px 10px', borderRadius: 20,
              background: st.bg, color: st.color, textTransform: 'uppercase', letterSpacing: '0.06em',
              border: `1px solid ${st.color}40`,
            }}
          >{st.label}</motion.span>
        </div>

        {/* ── READY CHECK ── */}
        {currentMatch.status === 'ready_check' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 14 }}>
            {!isLobbyFull ? (
              /* Searching */
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <motion.div
                  animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ fontSize: 56, marginBottom: 16 }}
                >⚡</motion.div>
                <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Поиск матча</div>
                <div style={{ fontSize: 13, color: '#4B5563', marginBottom: 20 }}>{filledSlots} / {totalSlots} игроков</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
                  {allSlotIds.map((slotId, i) => {
                    const filled = allSlotIds.indexOf(slotId) === i
                    return (
                      <motion.div key={i}
                        animate={filled ? { scale: [1, 1.2, 1], boxShadow: ['0 0 6px rgba(232,9,46,0.4)', '0 0 14px rgba(232,9,46,0.7)', '0 0 6px rgba(232,9,46,0.4)'] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                        style={{ width: 14, height: 14, borderRadius: '50%', background: filled ? '#E8092E' : 'rgba(255,255,255,0.08)' }}
                      />
                    )
                  })}
                </div>
                <button onClick={leaveQueue} style={{ background: 'none', border: 'none', color: '#374151', fontSize: 12, cursor: 'pointer' }}>
                  Выйти из очереди
                </button>
              </div>
            ) : (
              /* Ready check */
              <div style={{
                background: 'linear-gradient(135deg, rgba(232,9,46,0.1), rgba(6,6,8,0.95))',
                border: '1px solid rgba(232,9,46,0.35)', borderRadius: 20, padding: '24px 16px',
                textAlign: 'center', position: 'relative', overflow: 'hidden',
              }}>
                <motion.div
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
                  style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, transparent, rgba(232,9,46,0.07), transparent)', pointerEvents: 'none' }}
                />
                {/* Countdown ring */}
                <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 16px' }}>
                  <svg width="100" height="100" style={{ transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(232,9,46,0.15)" strokeWidth="5" />
                    <motion.circle cx="50" cy="50" r="44" fill="none" stroke="#E8092E" strokeWidth="5"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 44}
                      animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - countdown / 30) }}
                      style={{ filter: 'drop-shadow(0 0 6px rgba(232,9,46,0.6))' }}
                    />
                  </svg>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, fontWeight: 900, color: '#E8092E', fontVariantNumeric: 'tabular-nums' }}>
                    {countdown}
                  </div>
                </div>

                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 14 }}>Подтвердите готовность</div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginBottom: 16 }}>
                  {[...new Set(allSlotIds)].map((pid) => {
                    const isReady = currentMatch.readyPlayers.includes(pid)
                    return (
                      <motion.span key={pid}
                        initial={{ scale: 0.9 }}
                        animate={{ scale: 1 }}
                        style={{
                          fontSize: 11, padding: '5px 12px', borderRadius: 20, fontWeight: 700,
                          background: isReady ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.05)',
                          color: isReady ? '#4ADE80' : '#4B5563',
                          border: isReady ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.07)',
                          boxShadow: isReady ? '0 0 10px rgba(34,197,94,0.2)' : 'none',
                        }}
                      >
                        {isReady ? '✓ ' : ''}{playerName(pid)}
                      </motion.span>
                    )
                  })}
                </div>

                {!currentMatch.readyPlayers.includes(user.id) ? (
                  <motion.button whileTap={{ scale: 0.96 }} onClick={ready}
                    style={{
                      width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
                      background: 'linear-gradient(135deg, #E8092E, #9b0a22)',
                      color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer',
                      boxShadow: '0 4px 24px rgba(232,9,46,0.45)',
                    }}
                  >✓ Готов</motion.button>
                ) : (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    style={{ color: '#4ADE80', fontWeight: 900, fontSize: 16, padding: '12px 0' }}
                  >✓ Вы готовы — ждём остальных</motion.div>
                )}
                <button onClick={leaveQueue} style={{ background: 'none', border: 'none', color: '#374151', fontSize: 11, cursor: 'pointer', marginTop: 10 }}>
                  Выйти из очереди
                </button>
              </div>
            )}
          </motion.div>
        )}

        {/* ── MAP VETO ── */}
        {currentMatch.status === 'map_veto' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 14 }}>
            {/* Header */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
                Вето карт · осталось {currentMatch.availableMaps.length}
              </div>
              <div style={{
                padding: '12px 14px', borderRadius: 14,
                background: isMyVetoTurn ? 'rgba(232,9,46,0.1)' : 'rgba(255,255,255,0.04)',
                border: isMyVetoTurn ? '1px solid rgba(232,9,46,0.35)' : '1px solid rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{ fontSize: 11, color: isMyVetoTurn ? '#E8092E' : '#4B5563', fontWeight: 700, marginBottom: 2 }}>
                    {isMyVetoTurn ? '⚔️ ВАШ ХОД — убери карту' : `Ход капитана команды ${currentMatch.vetoTurn}`}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>
                    👑 {playerName(currentMatch.vetoTurn === 'A' ? captainA! : captainB!)}
                    {(currentMatch.vetoTurn === 'A' ? captainA : captainB) === user.id && <span style={{ color: '#E8092E', marginLeft: 4 }}>(вы)</span>}
                  </div>
                </div>
                <div style={{
                  fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em',
                  background: currentMatch.vetoTurn === 'A' ? 'rgba(96,165,250,0.15)' : 'rgba(248,113,113,0.15)',
                  color: currentMatch.vetoTurn === 'A' ? '#60A5FA' : '#F87171',
                  padding: '4px 10px', borderRadius: 20,
                  border: `1px solid ${currentMatch.vetoTurn === 'A' ? 'rgba(96,165,250,0.3)' : 'rgba(248,113,113,0.3)'}`,
                }}>
                  Команда {currentMatch.vetoTurn}
                </div>
              </div>
            </div>

            {/* Map grid with cinematic photos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {currentMatch.availableMaps.map((map, i) => (
                <motion.button
                  key={map}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, type: 'spring', stiffness: 280, damping: 24 }}
                  whileHover={isMyVetoTurn ? { scale: 1.02 } : {}}
                  whileTap={isMyVetoTurn ? { scale: 0.96 } : {}}
                  disabled={!isMyVetoTurn}
                  onClick={() => isMyVetoTurn && veto(map)}
                  style={{
                    position: 'relative', borderRadius: 16, overflow: 'hidden',
                    height: 110, border: 'none', cursor: isMyVetoTurn ? 'pointer' : 'default',
                    boxShadow: isMyVetoTurn ? '0 4px 20px rgba(0,0,0,0.4)' : 'none',
                    outline: isMyVetoTurn ? '1px solid rgba(232,9,46,0.2)' : '1px solid rgba(255,255,255,0.05)',
                  } as any}
                >
                  {/* Map photo */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: `url(${mapImg(map)})`,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                    transition: 'filter 0.3s',
                    filter: isMyVetoTurn ? 'brightness(0.65) saturate(1.1)' : 'brightness(0.25) grayscale(0.5)',
                  }} />
                  {/* Dark gradient */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    background: isMyVetoTurn
                      ? 'linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.6) 100%)'
                      : 'linear-gradient(180deg, transparent 20%, rgba(0,0,0,0.8) 100%)',
                  }} />
                  {/* Active red border glow */}
                  {isMyVetoTurn && (
                    <motion.div
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ position: 'absolute', inset: 0, border: '2px solid rgba(232,9,46,0.35)', borderRadius: 16, pointerEvents: 'none' }}
                    />
                  )}
                  {/* Map name */}
                  <div style={{
                    position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px',
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: isMyVetoTurn ? '#fff' : 'rgba(255,255,255,0.4)', letterSpacing: '0.03em', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
                      {map}
                    </span>
                    {isMyVetoTurn && (
                      <motion.span
                        animate={{ opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        style={{ fontSize: 9, color: '#fff', fontWeight: 900, background: '#E8092E', padding: '3px 8px', borderRadius: 8, boxShadow: '0 2px 8px rgba(232,9,46,0.5)' }}
                      >✕ ВЕТО</motion.span>
                    )}
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── IN PROGRESS ── */}
        {currentMatch.status === 'in_progress' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {/* Map hero — cinematic banner */}
            {currentMatch.map && (
              <motion.div
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                style={{ borderRadius: 20, overflow: 'hidden', height: 140, position: 'relative', marginBottom: -4 }}
              >
                {/* Photo */}
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `url(${mapImg(currentMatch.map)})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  filter: 'brightness(0.6) saturate(1.2)',
                }} />
                {/* Dark vignette */}
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.55) 100%)' }} />
                {/* Shimmer sweep */}
                <motion.div
                  animate={{ x: ['-100%', '250%'] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 8 }}
                  style={{ position: 'absolute', top: 0, bottom: 0, width: '20%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)', pointerEvents: 'none' }}
                />
                {/* Content */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.2em' }}>КАРТА МАТЧА</div>
                  <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', textShadow: '0 2px 20px rgba(0,0,0,0.9)' }}>{currentMatch.map}</div>
                </div>
                {/* Live badge */}
                <div style={{ position: 'absolute', top: 10, right: 12 }}>
                  <motion.div
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.4, repeat: Infinity }}
                    style={{ display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(34,197,94,0.18)', backdropFilter: 'blur(8px)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 20, padding: '4px 10px' }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,1)' }} />
                    <span style={{ fontSize: 9, fontWeight: 900, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Live</span>
                  </motion.div>
                </div>
                {/* Match ID bottom left */}
                <div style={{ position: 'absolute', bottom: 10, left: 12, fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                  #{currentMatch.id}
                </div>
              </motion.div>
            )}

            {/* Host block */}
            <div style={{
              background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.2)',
              borderRadius: 14, padding: '12px 14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>👑</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'rgba(234,179,8,0.7)', fontWeight: 700, marginBottom: 2 }}>
                    ХОСТ ЛОББИ В ИГРЕ
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                    {playerName(hostId)}
                    {hostId === user.id && <span style={{ color: '#E8092E', marginLeft: 6, fontSize: 12 }}>(вы)</span>}
                  </div>
                  {players[hostId]?.gameId && (
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                      ID: <span style={{ color: '#EAB308', fontWeight: 700 }}>{players[hostId].gameId}</span>
                    </div>
                  )}
                </div>
              </div>

              {hostId === user.id ? (
                currentMatch.lobbyLink ? (
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(234,179,8,0.6)', marginBottom: 6 }}>🔗 Ссылка опубликована:</div>
                    <div style={{
                      background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
                      borderRadius: 8, padding: '8px 10px', fontSize: 12,
                      wordBreak: 'break-all', color: '#EAB308', marginBottom: 8,
                    }}>
                      {currentMatch.lobbyLink}
                    </div>
                    <button
                      onClick={() => setLobbyLinkInput(currentMatch.lobbyLink || '')}
                      style={{ background: 'none', border: 'none', color: '#374151', fontSize: 11, cursor: 'pointer', padding: 0 }}
                    >
                      ✏️ Изменить ссылку
                    </button>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                      📋 Вставьте ссылку на лобби:
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        value={lobbyLinkInput}
                        onChange={(e) => setLobbyLinkInput(e.target.value)}
                        placeholder="https://link.standoff2.com/ru/lobby/join/..."
                        style={{
                          flex: 1, background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(234,179,8,0.25)',
                          borderRadius: 8, padding: '8px 10px', color: '#fff', fontSize: 12, outline: 'none',
                        }}
                      />
                      <button
                        onClick={saveLobbyLink}
                        disabled={lobbyLinkSaving || !lobbyLinkInput.trim()}
                        style={{
                          background: '#EAB308', border: 'none', borderRadius: 8,
                          padding: '8px 14px', color: '#000', fontWeight: 800, fontSize: 12,
                          cursor: 'pointer', opacity: lobbyLinkSaving || !lobbyLinkInput.trim() ? 0.5 : 1,
                        }}
                      >
                        {lobbyLinkSaving ? '...' : 'Опубликовать'}
                      </button>
                    </div>
                  </div>
                )
              ) : (
                currentMatch.lobbyLink ? (
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(234,179,8,0.6)', marginBottom: 6 }}>
                      🔗 Ссылка на лобби:
                    </div>
                    <a
                      href={currentMatch.lobbyLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={async () => {
                        try { await api.post(`/matches/${id}/lobby-join`) } catch {}
                      }}
                      style={{
                        display: 'block', background: 'rgba(234,179,8,0.12)',
                        border: '1px solid rgba(234,179,8,0.3)', borderRadius: 8,
                        padding: '10px 12px', color: '#EAB308', fontWeight: 700,
                        fontSize: 13, textAlign: 'center', textDecoration: 'none',
                      }}
                    >
                      🎮 Войти в лобби →
                    </a>
                    {/* Join status + countdown */}
                    {(() => {
                      const allPlayers = [...new Set([...currentMatch.teamAIds, ...currentMatch.teamBIds])]
                      const joined = currentMatch.lobbyJoinedPlayers ?? []
                      const notJoined = allPlayers.filter(pid => !joined.includes(pid))
                      const publishedAt = currentMatch.lobbyLinkPublishedAt
                        ? new Date(currentMatch.lobbyLinkPublishedAt).getTime() : null
                      const WINDOW = 5 * 60 * 1000
                      const timeLeft = publishedAt ? Math.max(0, WINDOW - (Date.now() - publishedAt)) : null
                      const mins = timeLeft !== null ? Math.floor(timeLeft / 60000) : null
                      const secs = timeLeft !== null ? Math.floor((timeLeft % 60000) / 1000) : null

                      return (
                        <div style={{ marginTop: 8 }}>
                          {timeLeft !== null && timeLeft > 0 && (
                            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, textAlign: 'center' }}>
                              ⏱ Время на переход: <b style={{ color: notJoined.length > 0 ? '#F59E0B' : '#22C55E' }}>
                                {mins}:{String(secs).padStart(2, '0')}
                              </b>
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {allPlayers.map(pid => (
                              <span key={pid} style={{
                                fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 700,
                                background: joined.includes(pid) ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.12)',
                                color: joined.includes(pid) ? '#22C55E' : '#F59E0B',
                                border: `1px solid ${joined.includes(pid) ? 'rgba(34,197,94,0.3)' : 'rgba(245,158,11,0.25)'}`,
                              }}>
                                {joined.includes(pid) ? '✓ ' : '⏳ '}{playerName(pid)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: '#374151', textAlign: 'center', paddingTop: 4 }}>
                    ⏳ Хост ещё не опубликовал ссылку...
                  </div>
                )
              )}
            </div>

            {/* My side badge + Discord */}
            {(mySide || currentMatch.voiceInviteT || currentMatch.voiceInviteCT) && (
              <div style={{
                background: mySide === 'T' ? 'rgba(234,179,8,0.07)' : 'rgba(59,130,246,0.07)',
                border: mySide === 'T' ? '1px solid rgba(234,179,8,0.25)' : '1px solid rgba(59,130,246,0.25)',
                borderRadius: 14, padding: '12px 14px',
              }}>
                <div style={{ textAlign: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: mySide === 'T' ? '#EAB308' : '#60A5FA' }}>
                    {mySide === 'T' ? '💣 Ваша команда — Террористы' : '🛡️ Ваша команда — Спецназ'}
                  </span>
                </div>
                {(() => {
                  const side = mySide ?? (isTeamA ? teamASide : isTeamB ? teamBSide : null)
                  const voiceLink = side === 'T'
                    ? currentMatch.voiceInviteT
                    : side === 'CT'
                      ? currentMatch.voiceInviteCT
                      : (currentMatch.voiceInviteT || currentMatch.voiceInviteCT)

                  const hasDiscord = !!(user as any).discordUsername

                  if (!hasDiscord) return (
                    <a
                      href="/profile"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, padding: '10px 14px',
                        color: '#4B5563', fontWeight: 700, fontSize: 12,
                        textDecoration: 'none',
                      }}
                    >
                      🔒 Привяжи Discord в профиле для голосового чата
                    </a>
                  )

                  return voiceLink ? (
                    <a
                      href={voiceLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        background: 'rgba(88,101,242,0.12)',
                        border: '1px solid rgba(88,101,242,0.3)',
                        borderRadius: 10, padding: '10px 14px',
                        color: '#818cf8', fontWeight: 700, fontSize: 13,
                        textDecoration: 'none',
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                      </svg>
                      🎙️ Войти в голосовой чат →
                    </a>
                  ) : (
                    <div style={{ textAlign: 'center', fontSize: 12, color: '#374151' }}>⏳ Голосовой чат создаётся...</div>
                  )
                })()}
              </div>
            )}

            {/* Teams — side by side */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              {[
                { ids: currentMatch.teamAIds, cap: captainA, side: teamASide, isMe: isTeamA, label: 'A', color: '#60A5FA', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
                { ids: currentMatch.teamBIds, cap: captainB, side: teamBSide, isMe: isTeamB, label: 'B', color: '#F87171', bg: 'rgba(232,9,46,0.08)', border: 'rgba(232,9,46,0.2)' },
              ].map((team, ti) => (
                <div key={ti} style={{
                  flex: 1, minWidth: 0,
                  background: team.bg, borderRadius: 14,
                  border: `1px solid ${team.border}`, padding: '10px 12px',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: team.color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                      {team.label}{team.isMe ? ' · ВЫ' : ''}
                    </span>
                    {team.side && (
                      <span style={{
                        fontSize: 9, fontWeight: 900, padding: '1px 5px', borderRadius: 6,
                        background: team.side === 'T' ? 'rgba(234,179,8,0.15)' : 'rgba(59,130,246,0.15)',
                        color: team.side === 'T' ? '#EAB308' : '#60A5FA',
                        border: `1px solid ${team.side === 'T' ? 'rgba(234,179,8,0.3)' : 'rgba(59,130,246,0.3)'}`,
                        whiteSpace: 'nowrap',
                      }}>
                        {team.side === 'T' ? '💣T' : '🛡CT'}
                      </span>
                    )}
                  </div>
                  {/* Players */}
                  {team.ids.map((pid) => (
                    <div key={pid} style={{
                      fontSize: 12, padding: '4px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      color: pid === user.id ? '#fff' : '#6B7280',
                      fontWeight: pid === user.id ? 800 : 500,
                      display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden',
                    }}>
                      {pid === team.cap && <span style={{ fontSize: 9, flexShrink: 0 }}>👑</span>}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {playerName(pid)}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Result submission */}
            {myTeam && (
              <div style={{
                ...cardStyle,
                border: '1px solid rgba(234,179,8,0.18)',
                background: 'rgba(234,179,8,0.04)',
              }}>
                <h3 style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: '#fff' }}>
                  📸 Результат — Команда {myTeam}
                </h3>

                {/* Warning: other captain submitted */}
                {(() => {
                  const otherSubmitted = isTeamA
                    ? (!currentMatch.resultScreenshotA && !!currentMatch.resultScreenshotB)
                    : (!!currentMatch.resultScreenshotA && !currentMatch.resultScreenshotB)
                  if (!otherSubmitted || !iAmCaptain || alreadySubmitted || submitted) return null
                  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
                  return (
                    <div style={{
                      background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)',
                      borderRadius: 10, padding: '10px 12px', marginBottom: 12,
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}>
                      <span style={{ fontSize: 22 }}>⚠️</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#F87171' }}>
                          Капитан другой команды уже загрузил результат!
                        </div>
                        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                          {resultDeadlineLeft !== null && resultDeadlineLeft > 0
                            ? `У вас ${fmt(resultDeadlineLeft)} чтобы загрузить свой скриншот`
                            : 'Время вышло — администратор проверит вручную'}
                        </div>
                      </div>
                      {resultDeadlineLeft !== null && resultDeadlineLeft > 0 && (
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#EF4444', fontVariantNumeric: 'tabular-nums' }}>
                          {fmt(resultDeadlineLeft)}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {submitted || alreadySubmitted ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
                    <p style={{ color: '#4ADE80', fontWeight: 800, fontSize: 14, margin: '0 0 4px' }}>Результат отправлен</p>
                    <p style={{ color: '#4B5563', fontSize: 12, margin: 0 }}>
                      {currentMatch.resultScreenshotA && currentMatch.resultScreenshotB
                        ? 'Оба капитана отправили — ждём проверки'
                        : 'Ожидаем скрин от капитана другой команды'}
                    </p>
                  </div>
                ) : !iAmCaptain ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>👑</div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#9CA3AF', margin: '0 0 4px' }}>Загрузить результат может только капитан</p>
                    <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>
                      Капитан вашей команды: <span style={{ color: '#fff' }}>{myCaptainId ? playerName(myCaptainId) : '—'}</span>
                    </p>
                  </div>
                ) : !lobbyLinkReady ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🔗</div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#9CA3AF', margin: '0 0 4px' }}>Дождитесь ссылки от хоста</p>
                    <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>Хост должен опубликовать ссылку на лобби</p>
                  </div>
                ) : !submitUnlocked ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ fontSize: 36, fontWeight: 900, color: '#E8092E', marginBottom: 6, fontVariantNumeric: 'tabular-nums' }}>
                      {submitUnlockSecondsLeft !== null ? formatUnlock(submitUnlockSecondsLeft) : '5:00'}
                    </div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#9CA3AF', margin: '0 0 4px' }}>Загрузка результата откроется через</p>
                    <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>Минимальное время матча — 5 минут</p>
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, color: '#4B5563', display: 'block', marginBottom: 5, fontWeight: 700 }}>Счёт команды A</label>
                        <input
                          type="number"
                          value={scoreA}
                          onChange={e => setScoreA(e.target.value)}
                          min={0}
                          placeholder="0"
                          style={{
                            width: '100%', borderRadius: 12, padding: '10px 8px',
                            textAlign: 'center', fontSize: 20, fontWeight: 900, outline: 'none',
                            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
                            color: '#fff', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      <div style={{ color: '#374151', fontWeight: 800, fontSize: 18, paddingTop: 20 }}>:</div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: 11, color: '#4B5563', display: 'block', marginBottom: 5, fontWeight: 700 }}>Счёт команды B</label>
                        <input
                          type="number"
                          value={scoreB}
                          onChange={e => setScoreB(e.target.value)}
                          min={0}
                          placeholder="0"
                          style={{
                            width: '100%', borderRadius: 12, padding: '10px 8px',
                            textAlign: 'center', fontSize: 20, fontWeight: 900, outline: 'none',
                            background: 'rgba(232,9,46,0.08)', border: '1px solid rgba(232,9,46,0.25)',
                            color: '#fff', boxSizing: 'border-box',
                          }}
                        />
                      </div>
                    </div>

                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScreenshotChange} />

                    {screenshotPreview ? (
                      <div style={{ position: 'relative', marginBottom: 14 }}>
                        <img src={screenshotPreview} alt="screenshot" style={{ width: '100%', borderRadius: 12, objectFit: 'cover', maxHeight: 180 }} />
                        <button
                          onClick={() => { setScreenshot(null); setScreenshotPreview(null) }}
                          style={{
                            position: 'absolute', top: 8, right: 8, width: 28, height: 28,
                            borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none',
                            color: '#fff', fontSize: 14, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >×</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileRef.current?.click()}
                        style={{
                          width: '100%', padding: '28px 0', borderRadius: 12, marginBottom: 14,
                          border: '2px dashed rgba(255,255,255,0.1)',
                          background: 'rgba(255,255,255,0.02)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          cursor: 'pointer', transition: 'border 0.2s',
                        }}
                      >
                        <span style={{ fontSize: 30 }}>📸</span>
                        <span style={{ fontSize: 13, color: '#4B5563' }}>Нажмите чтобы загрузить скриншот</span>
                        <span style={{ fontSize: 11, color: '#374151' }}>с результатами матча</span>
                      </button>
                    )}

                    <button
                      onClick={submitResult}
                      disabled={!screenshot || !scoreA || !scoreB || submitting}
                      style={{
                        width: '100%', padding: '13px 0', borderRadius: 12, border: 'none',
                        background: !screenshot || !scoreA || !scoreB || submitting
                          ? 'rgba(255,255,255,0.06)'
                          : 'linear-gradient(135deg, rgba(232,9,46,0.9), rgba(180,0,30,0.95))',
                        color: !screenshot || !scoreA || !scoreB || submitting ? '#4B5563' : '#fff',
                        fontWeight: 800, fontSize: 14, cursor: !screenshot || !scoreA || !scoreB || submitting ? 'default' : 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {submitting ? 'Отправка...' : '📤 Отправить результат'}
                    </button>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* ── RESULT PENDING ── */}
        {currentMatch.status === 'result_pending' && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 280, damping: 24 }}>
            {currentMatch.map && (
              <div style={{ borderRadius: 20, overflow: 'hidden', height: 80, position: 'relative', marginBottom: 12 }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${mapImg(currentMatch.map)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.3) blur(1px)' }} />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>{currentMatch.map}</span>
                </div>
              </div>
            )}
            <div style={{
              borderRadius: 20, padding: '24px 16px', textAlign: 'center',
              background: currentMatch.isDisputed ? 'rgba(239,68,68,0.07)' : 'rgba(96,165,250,0.06)',
              border: currentMatch.isDisputed ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(96,165,250,0.2)',
            }}>
              {currentMatch.isDisputed ? (
                <>
                  <motion.div animate={{ rotate: [-5, 5, -5] }} transition={{ duration: 0.5, repeat: 3, delay: 0.3 }}
                    style={{ fontSize: 42, marginBottom: 10 }}>⚠️</motion.div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#EF4444', marginBottom: 6 }}>Спорный результат</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Капитаны указали разные счёта — администратор разберётся</div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                    {[{ label: 'Капитан A', a: currentMatch.scoreAByCapA, b: currentMatch.scoreBByCapA, color: '#60A5FA' },
                      { label: 'Капитан B', a: currentMatch.scoreAByCapB, b: currentMatch.scoreBByCapB, color: '#F87171' }
                    ].map((c, i) => (
                      <div key={i} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 20px' }}>
                        <div style={{ fontSize: 9, color: c.color, fontWeight: 800, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{c.label}</div>
                        <div style={{ fontSize: 22, fontWeight: 900 }}>
                          <span style={{ color: '#60A5FA' }}>{c.a}</span>
                          <span style={{ color: '#374151', margin: '0 6px' }}>:</span>
                          <span style={{ color: '#F87171' }}>{c.b}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                    style={{ fontSize: 44, marginBottom: 14, display: 'inline-block' }}>⏳</motion.div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 6 }}>На проверке</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>Оба капитана сдали результат</div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 16,
                    background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '12px 24px', marginBottom: 12,
                  }}>
                    <span style={{ fontSize: 32, fontWeight: 900, color: '#60A5FA' }}>{currentMatch.scoreA}</span>
                    <span style={{ fontSize: 22, color: '#374151', fontWeight: 900 }}>:</span>
                    <span style={{ fontSize: 32, fontWeight: 900, color: '#F87171' }}>{currentMatch.scoreB}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#374151' }}>Администратор проверяет скриншоты</div>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── COMPLETED ── */}
        {currentMatch.status === 'completed' && (() => {
          const isWin  = currentMatch.winnerTeam === myTeam
          const isDraw = currentMatch.winnerTeam === 'draw'
          const accentColor = isWin ? '#22C55E' : isDraw ? '#A855F7' : '#E8092E'
          const accentGlow  = isWin ? 'rgba(34,197,94,0.4)' : isDraw ? 'rgba(168,85,247,0.4)' : 'rgba(232,9,46,0.4)'

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', minHeight: 320 }}
            >
              {/* Map background */}
              {currentMatch.map && (
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `url(${mapImg(currentMatch.map)})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  filter: 'brightness(0.2) saturate(0.5)',
                }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(ellipse at 50% 0%, ${accentColor}18 0%, transparent 70%)` }} />

              <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '32px 20px 24px' }}>
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                  style={{ fontSize: 64, marginBottom: 12, filter: `drop-shadow(0 0 20px ${accentGlow})` }}
                >
                  {isWin ? '🏆' : isDraw ? '🤝' : '💀'}
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div style={{
                    fontSize: 32, fontWeight: 900, color: accentColor,
                    letterSpacing: '-1px', marginBottom: 8,
                    textShadow: `0 0 30px ${accentGlow}`,
                  }}>
                    {isWin ? 'ПОБЕДА' : isDraw ? 'НИЧЬЯ' : 'ПОРАЖЕНИЕ'}
                  </div>

                  {currentMatch.map && (
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                      {currentMatch.map}
                    </div>
                  )}

                  {/* Score */}
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 16,
                    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(12px)',
                    border: `1px solid ${accentColor}30`,
                    borderRadius: 16, padding: '12px 24px', marginBottom: 20,
                  }}>
                    <span style={{ fontSize: 36, fontWeight: 900, color: '#60A5FA', letterSpacing: '-1px' }}>{currentMatch.scoreA}</span>
                    <span style={{ fontSize: 24, color: '#374151', fontWeight: 900 }}>:</span>
                    <span style={{ fontSize: 36, fontWeight: 900, color: '#F87171', letterSpacing: '-1px' }}>{currentMatch.scoreB}</span>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={() => router.push('/dashboard')}
                    style={{
                      width: '100%', padding: '15px 0', borderRadius: 14, border: 'none',
                      background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}88)`,
                      color: isWin ? '#000' : '#fff', fontWeight: 900, fontSize: 15,
                      cursor: 'pointer', boxShadow: `0 4px 24px ${accentGlow}`,
                    }}
                  >
                    На главную
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          )
        })()}
      </div>
    </div>
  )
}
