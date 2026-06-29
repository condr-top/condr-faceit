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
import { Icon } from '@/components/ui/Icon'
import { Avatar } from '@/components/ui/Avatar'
import { getEloRank } from '@/lib/eloRank'
import { EloRing } from '@/components/ui/EloRing'
import { ReportModal } from '@/components/reports/ReportModal'
import { MatchChat } from '@/components/match/MatchChat'

// Module-scope map image helper (для компонентов вне основного)
const mapImgUrl = (name: string) => `/maps/${name.charAt(0).toUpperCase()}${name.slice(1).toLowerCase()}.webp`

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
  const [players, setPlayers] = useState<Record<number, { gameNickname: string; gameId: string; avatarUrl?: string; elo?: number; isVerified?: boolean }>>({})
  const [reportTarget, setReportTarget] = useState<{ id: number; name: string } | null>(null)
  const [lobbyLinkInput, setLobbyLinkInput] = useState('')
  const [lobbyLinkSaving, setLobbyLinkSaving] = useState(false)
  const [lobbyEditing, setLobbyEditing] = useState(false)
  const [submitUnlockSecondsLeft, setSubmitUnlockSecondsLeft] = useState<number | null>(null)
  const [resultDeadlineLeft, setResultDeadlineLeft] = useState<number | null>(null)
  const [vetoSecondsLeft, setVetoSecondsLeft] = useState<number | null>(null)
  const [revealMap, setRevealMap] = useState<string | null>(null)
  const [lobbyLinkSecondsLeft, setLobbyLinkSecondsLeft] = useState<number | null>(null)

  useEffect(() => {
    const teamAIds = currentMatch?.teamAIds ?? []
    const teamBIds = currentMatch?.teamBIds ?? []
    const ids = [...new Set([...teamAIds, ...teamBIds])].filter(Boolean)
    if (!ids.length) return
    api.get('/users/batch', { params: { ids: ids.join(',') } })
      .then((r) => {
        if (!Array.isArray(r.data) || !r.data.length) return
        const map: Record<number, { gameNickname: string; gameId: string; avatarUrl?: string; elo?: number; isVerified?: boolean }> = {}
        r.data.forEach((p: any) => { map[p.id] = { gameNickname: p.gameNickname, gameId: p.gameId, avatarUrl: p.avatarUrl, elo: p.elo, isVerified: p.isVerified } })
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
    // Когда хотя бы один капитан загрузил результат — выйти могут все,
    // КРОМЕ капитана команды, которая ещё не загрузила (он обязан ответить).
    const aSub = !!currentMatch.resultScreenshotA
    const bSub = !!currentMatch.resultScreenshotB
    const anySub = aSub || bSub
    const blockedCaptain = aSub && !bSub ? currentMatch.captainBId
      : bSub && !aSub ? currentMatch.captainAId : null
    const iAmBlockedCaptain = blockedCaptain != null && user?.id === blockedCaptain
    const over =
      currentMatch.status === 'completed'      ||
      currentMatch.status === 'cancelled'      ||
      currentMatch.status === 'result_pending' ||
      currentMatch.status === 'ready_check'    ||
      mySubmitted ||
      (anySub && !iAmBlockedCaptain)

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

  // ── Таймер хода вето (15 сек). По истечении активный клиент инициирует авто-бан. ──
  useEffect(() => {
    if (currentMatch?.status !== 'map_veto' || !currentMatch.vetoTurnExpires) { setVetoSecondsLeft(null); return }
    const expires = new Date(currentMatch.vetoTurnExpires).getTime()
    let fired = false
    const tick = async () => {
      const left = Math.max(0, Math.ceil((expires - Date.now()) / 1000))
      setVetoSecondsLeft(left)
      if (left === 0 && !fired) {
        fired = true
        // приоритет авто-бана — активному капитану; остальные клиенты как фоллбэк с задержкой
        const cap = currentMatch.vetoTurn === 'A' ? currentMatch.captainAId : currentMatch.captainBId
        const mineTurn = user?.id === cap
        const delay = mineTurn ? 0 : 900
        setTimeout(() => { api.post(`/matches/${id}/expire-veto`).catch(() => {}) }, delay)
      }
    }
    tick()
    const interval = setInterval(tick, 250)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatch?.status, currentMatch?.vetoTurnExpires, currentMatch?.vetoTurn])

  // ── Детект завершения вето → cinematic-реверс «Матч пройдёт на карте…» ──
  const prevStatusRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    const prev = prevStatusRef.current
    if (prev === 'map_veto' && currentMatch?.status === 'in_progress' && currentMatch.map) {
      setRevealMap(currentMatch.map)
      const t = setTimeout(() => setRevealMap(null), 3600)
      return () => clearTimeout(t)
    }
    prevStatusRef.current = currentMatch?.status
  }, [currentMatch?.status, currentMatch?.map])

  // ── Таймер 5 мин на публикацию ссылки хостом. Нет ссылки → штраф хосту + отмена. ──
  useEffect(() => {
    if (currentMatch?.status !== 'in_progress' || currentMatch.lobbyLink || !currentMatch.startedAt) {
      setLobbyLinkSecondsLeft(null); return
    }
    const started = new Date(currentMatch.startedAt).getTime()
    const LIMIT_MS = 5 * 60 * 1000
    let fired = false
    const tick = () => {
      const left = Math.max(0, Math.ceil((started + LIMIT_MS - Date.now()) / 1000))
      setLobbyLinkSecondsLeft(left)
      if (left === 0 && !fired) {
        fired = true
        const delay = currentMatch.hostId === user?.id ? 0 : 900
        setTimeout(() => { api.post(`/matches/${id}/expire-lobby-link`).catch(() => {}) }, delay)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMatch?.status, currentMatch?.lobbyLink, currentMatch?.startedAt])

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
      setLobbyEditing(false)
      setLobbyLinkInput('')
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
  // Когда хотя бы один капитан загрузил результат — выйти могут все,
  // кроме капитана команды, которая ещё не загрузила.
  const anyResultSubmitted = !!currentMatch.resultScreenshotA || !!currentMatch.resultScreenshotB
  const pendingCaptainId = (!!currentMatch.resultScreenshotA && !currentMatch.resultScreenshotB) ? currentMatch.captainBId
    : (!!currentMatch.resultScreenshotB && !currentMatch.resultScreenshotA) ? currentMatch.captainAId : null
  const iAmPendingCaptain = pendingCaptainId != null && user.id === pendingCaptainId
  const canExit =
    currentMatch.status === 'completed'     ||
    currentMatch.status === 'cancelled'     ||
    currentMatch.status === 'result_pending'||
    currentMatch.status === 'ready_check'   ||  // searching / waiting — always free to leave
    myTeamSubmitted ||
    (anyResultSubmitted && !iAmPendingCaptain)

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
      {/* Cinematic-реверс финальной карты */}
      <AnimatePresence>
        {revealMap && <MapReveal map={revealMap} />}
      </AnimatePresence>
      {/* Репорт на игрока — не выходя со страницы матча */}
      <AnimatePresence>
        {reportTarget && (
          <ReportModal reportedId={reportTarget.id} reportedName={reportTarget.name} onClose={() => setReportTarget(null)} />
        )}
      </AnimatePresence>
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
        {/* Header — лаконичный: выход слева, единый статус-чип в центре */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 18, marginBottom: 16 }}>
          <div style={{ width: 72, display: 'flex', justifyContent: 'flex-start', flexShrink: 0 }}>
            {/* На экране поиска (ready_check) кнопка не нужна — внизу есть «Выйти из очереди» */}
            {currentMatch.status === 'ready_check' ? null : canExit ? (
              <motion.button whileTap={{ scale: 0.9 }}
                onClick={() => router.replace('/dashboard')}
                style={{
                  background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10,
                  padding: '7px 10px', color: '#9CA3AF', fontSize: 12, cursor: 'pointer', fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 3, whiteSpace: 'nowrap',
                }}
              ><Icon name="chevronLeft" size={13} color="#9CA3AF" />Выйти</motion.button>
            ) : (
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="lock" size={15} color="#4B5563" />
              </div>
            )}
          </div>

          {/* Единый статус-чип: номер матча + текущая фаза */}
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}>
            <motion.div
              animate={currentMatch.status === 'in_progress'
                ? { boxShadow: [`0 0 0 ${st.color}00`, `0 0 16px ${st.color}55`, `0 0 0 ${st.color}00`] } : {}}
              transition={{ duration: 2.2, repeat: Infinity }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 16px', borderRadius: 22,
                background: `linear-gradient(135deg, ${st.color}22, rgba(15,15,21,0.7))`,
                border: `1px solid ${st.color}44`, backdropFilter: 'blur(10px)',
              }}
            >
              <motion.div animate={{ opacity: [1, 0.35, 1], scale: [1, 0.85, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
                style={{ width: 7, height: 7, borderRadius: '50%', background: st.color, boxShadow: `0 0 8px ${st.color}` }} />
              <span style={{ fontSize: 13, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>Матч #{currentMatch.id}</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: st.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{st.label}</span>
            </motion.div>
          </div>

          <div style={{ width: 84 }} />
        </div>

        {/* ── READY CHECK ── */}
        {currentMatch.status === 'ready_check' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginBottom: 14 }}>
            {!isLobbyFull ? (
              /* Searching */
              (() => {
                const allFilled = [...new Set(allSlotIds)].filter(Boolean)
                const pct = totalSlots ? (filledSlots / totalSlots) * 100 : 0
                const renderOrb = (pid: number | undefined, i: number) => (
                  <div key={i} style={{ width: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    {pid ? (
                      <motion.div
                        initial={{ scale: 0, y: 12, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 20 }}
                      >
                        <motion.div
                          animate={{ y: [0, -3, 0] }}
                          transition={{ duration: 2.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
                          style={{
                            width: 46, height: 46, borderRadius: '50%', padding: 2,
                            background: 'linear-gradient(135deg, #E8092E, #ff5a72)',
                            boxShadow: '0 0 16px rgba(232,9,46,0.5)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: 1.5, background: '#060608' }}>
                            <Avatar
                              avatarUrl={players[pid]?.avatarUrl}
                              name={players[pid]?.gameNickname || '?'}
                              size={39}
                              style={{ borderRadius: '50%' }}
                            />
                          </div>
                        </motion.div>
                      </motion.div>
                    ) : (
                      <motion.div
                        animate={{ opacity: [0.25, 0.55, 0.25], scale: [1, 1.05, 1] }}
                        transition={{ duration: 1.9, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
                        style={{
                          width: 46, height: 46, borderRadius: '50%',
                          border: '1.5px dashed rgba(255,255,255,0.18)', background: 'rgba(255,255,255,0.03)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Icon name="user" size={18} color="rgba(255,255,255,0.2)" />
                      </motion.div>
                    )}
                    <span style={{
                      fontSize: 9, fontWeight: 600, maxWidth: 52, width: '100%', textAlign: 'center',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      color: pid ? '#9CA3AF' : '#374151',
                    }}>{pid ? (players[pid]?.gameNickname || '...') : 'поиск'}</span>
                  </div>
                )

                return (
                  <div style={{
                    minHeight: '64vh', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    padding: '8px 8px 24px', position: 'relative', overflow: 'hidden',
                  }}>
                    {/* Ambient glow */}
                    <div style={{
                      position: 'absolute', top: '12%', left: '50%', transform: 'translateX(-50%)',
                      width: 440, height: 440, pointerEvents: 'none', filter: 'blur(10px)',
                      background: 'radial-gradient(circle, rgba(232,9,46,0.12), transparent 62%)',
                    }} />

                    {/* ── RADAR ── */}
                    <div style={{ position: 'relative', width: 230, height: 230, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 28 }}>
                      {/* Sonar pulses — fade in from 0 and out to 0, so the loop restart is invisible (no flicker) */}
                      {[0, 1, 2].map(i => (
                        <motion.div key={`p${i}`}
                          initial={{ scale: 0.25, opacity: 0 }}
                          animate={{ scale: [0.25, 0.6, 1], opacity: [0, 0.45, 0] }}
                          transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: 'easeOut', times: [0, 0.5, 1] }}
                          style={{ position: 'absolute', width: 230, height: 230, borderRadius: '50%', border: '1.5px solid rgba(232,9,46,0.4)' }}
                        />
                      ))}
                      {/* Concentric rings */}
                      {[230, 170, 112].map((d, i) => (
                        <div key={`r${i}`} style={{ position: 'absolute', width: d, height: d, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.05)' }} />
                      ))}
                      {/* Cross grid */}
                      <div style={{ position: 'absolute', width: 230, height: 1, background: 'rgba(255,255,255,0.04)' }} />
                      <div style={{ position: 'absolute', width: 1, height: 230, background: 'rgba(255,255,255,0.04)' }} />
                      {/* Rotating sweep */}
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
                        style={{
                          position: 'absolute', width: 230, height: 230, borderRadius: '50%',
                          background: 'conic-gradient(from 0deg, transparent 0deg, rgba(232,9,46,0.22) 55deg, rgba(232,9,46,0.03) 75deg, transparent 82deg)',
                        }}
                      />
                      {/* Center dial */}
                      <div style={{
                        position: 'relative', zIndex: 1, width: 112, height: 112, borderRadius: '50%',
                        background: 'radial-gradient(circle at 50% 32%, rgba(232,9,46,0.2), rgba(6,6,8,0.92))',
                        border: '1px solid rgba(232,9,46,0.35)',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        boxShadow: 'inset 0 0 26px rgba(232,9,46,0.2)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                          <motion.span key={filledSlots}
                            initial={{ scale: 1.6, color: '#fff' }}
                            animate={{ scale: 1, color: '#E8092E' }}
                            transition={{ type: 'spring', stiffness: 300, damping: 16 }}
                            style={{ fontSize: 42, fontWeight: 900, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                          >{filledSlots}</motion.span>
                          <span style={{ fontSize: 18, fontWeight: 800, color: '#4B5563' }}>/{totalSlots}</span>
                        </div>
                        <div style={{ fontSize: 8, fontWeight: 800, color: '#6B7280', letterSpacing: '0.14em', marginTop: 3, textTransform: 'uppercase' }}>в лобби</div>
                      </div>
                    </div>

                    {/* Title */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.4px' }}>Поиск игроков</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {[0, 1, 2].map(i => (
                          <motion.span key={`d${i}`}
                            animate={{ y: [0, -5, 0], opacity: [0.35, 1, 0.35] }}
                            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                            style={{ width: 5, height: 5, borderRadius: '50%', background: '#E8092E', display: 'inline-block' }}
                          />
                        ))}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: '#4B5563', marginBottom: 26 }}>Подбираем соперников вашего уровня</div>

                    {/* Player slots */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, maxWidth: 320, marginBottom: 26 }}>
                      {Array.from({ length: totalSlots }).map((_, i) => renderOrb(allFilled[i], i))}
                    </div>

                    {/* Progress bar */}
                    <div style={{ width: 'min(280px, 82%)', height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginBottom: 22, position: 'relative' }}>
                      <motion.div
                        animate={{ width: `${pct}%` }}
                        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                        style={{ height: '100%', borderRadius: 3, background: 'linear-gradient(90deg, #E8092E, #ff5a72)', boxShadow: '0 0 10px rgba(232,9,46,0.6)' }}
                      />
                    </div>

                    {/* Leave */}
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={leaveQueue}
                      style={{
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 12, padding: '9px 22px', color: '#6B7280',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <Icon name="x" size={13} />Выйти из очереди
                    </motion.button>
                  </div>
                )
              })()
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
                          display: 'inline-flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        {isReady && <Icon name="check" size={11} />}{playerName(pid)}
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
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  ><Icon name="check" size={18} />Готов</motion.button>
                ) : (
                  <motion.div initial={{ scale: 0.8 }} animate={{ scale: 1 }}
                    style={{ color: '#4ADE80', fontWeight: 900, fontSize: 16, padding: '12px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}
                  ><Icon name="check" size={17} />Вы готовы — ждём остальных</motion.div>
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
                  <div style={{ fontSize: 11, color: isMyVetoTurn ? '#E8092E' : '#4B5563', fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {isMyVetoTurn ? <><Icon name="swords" size={12} />ВАШ ХОД — убери карту</> : `Ход капитана команды ${currentMatch.vetoTurn}`}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Icon name="crown" size={13} color="#EAB308" /> {playerName(currentMatch.vetoTurn === 'A' ? captainA! : captainB!)}
                    {(currentMatch.vetoTurn === 'A' ? captainA : captainB) === user.id && <span style={{ color: '#E8092E', marginLeft: 4 }}>(вы)</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* 15-секундный таймер хода */}
                  {vetoSecondsLeft != null && (
                    <VetoTimer seconds={vetoSecondsLeft} active={isMyVetoTurn} />
                  )}
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
            </div>

            {/* Map grid with cinematic photos */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <AnimatePresence mode="popLayout">
              {currentMatch.availableMaps.map((map, i) => (
                <motion.button
                  key={map}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0, scale: 0.8, rotate: -3,
                    transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] },
                  }}
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
                  {/* Красная вспышка «бана» при исчезновении */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    exit={{ opacity: [0, 0.55, 0], transition: { duration: 0.5 } }}
                    style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle, rgba(232,9,46,0.7), transparent 70%)', zIndex: 5, pointerEvents: 'none' }}
                  />
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
                  {/* VETO badge — фиксированный угол, одинаковый на всех картах */}
                  {isMyVetoTurn && (
                    <motion.span
                      animate={{ opacity: [0.7, 1, 0.7] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      style={{
                        position: 'absolute', top: 8, right: 8,
                        fontSize: 9, lineHeight: 1, color: '#fff', fontWeight: 900,
                        background: '#E8092E', padding: '5px 9px', borderRadius: 8,
                        whiteSpace: 'nowrap', letterSpacing: '0.04em',
                        boxShadow: '0 2px 8px rgba(232,9,46,0.5)',
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                      }}
                    ><Icon name="x" size={9} />ВЕТО</motion.span>
                  )}
                  {/* Map name — снизу, обрезается многоточием если длинное */}
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '10px 12px' }}>
                    <span style={{
                      display: 'block', fontSize: 14, fontWeight: 900,
                      color: isMyVetoTurn ? '#fff' : 'rgba(255,255,255,0.4)',
                      letterSpacing: '0.03em', textShadow: '0 1px 6px rgba(0,0,0,0.8)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {map}
                    </span>
                  </div>
                </motion.button>
              ))}
              </AnimatePresence>
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
                <Icon name="crown" size={20} color="#EAB308" />
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
                (currentMatch.lobbyLink && !lobbyEditing) ? (
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(234,179,8,0.6)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="link" size={12} />Ссылка опубликована:</div>
                    <div style={{
                      background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
                      borderRadius: 8, padding: '8px 10px', fontSize: 12,
                      wordBreak: 'break-all', color: '#EAB308', marginBottom: 8,
                    }}>
                      {currentMatch.lobbyLink}
                    </div>
                    {!(currentMatch as any).lobbyLinkChanged ? (
                      <button
                        onClick={() => { setLobbyLinkInput(currentMatch.lobbyLink || ''); setLobbyEditing(true) }}
                        style={{ background: 'none', border: 'none', color: '#9CA3AF', fontSize: 11, cursor: 'pointer', padding: 0, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      >
                        <Icon name="pencil" size={11} />Изменить ссылку (можно один раз)
                      </button>
                    ) : (
                      <span style={{ color: '#374151', fontSize: 11 }}>Ссылку уже меняли (изменение доступно один раз)</span>
                    )}
                  </div>
                ) : (
                  <div>
                    {/* Таймер 5 минут на публикацию ссылки */}
                    {!lobbyEditing && lobbyLinkSecondsLeft != null && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10, padding: '9px 12px', borderRadius: 11,
                        background: lobbyLinkSecondsLeft <= 60 ? 'rgba(232,9,46,0.12)' : 'rgba(234,179,8,0.08)',
                        border: `1px solid ${lobbyLinkSecondsLeft <= 60 ? 'rgba(232,9,46,0.4)' : 'rgba(234,179,8,0.3)'}`,
                      }}>
                        <Icon name="hourglass" size={14} color={lobbyLinkSecondsLeft <= 60 ? '#E8092E' : '#EAB308'} />
                        <span style={{ flex: 1, fontSize: 12, color: '#D1D5DB', fontWeight: 600 }}>
                          {lobbyLinkSecondsLeft <= 60 ? 'Опубликуйте ссылку, иначе бан и отмена матча' : 'Время на публикацию ссылки'}
                        </span>
                        <span style={{ fontSize: 15, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: lobbyLinkSecondsLeft <= 60 ? '#E8092E' : '#EAB308' }}>
                          {Math.floor(lobbyLinkSecondsLeft / 60)}:{String(lobbyLinkSecondsLeft % 60).padStart(2, '0')}
                        </span>
                      </div>
                    )}
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      {lobbyEditing ? <><Icon name="pencil" size={11} />Новая ссылка на лобби (таймер и список зашедших сбросятся):</> : <><Icon name="clipboard" size={11} />Вставьте ссылку на лобби:</>}
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
                        {lobbyLinkSaving ? '...' : (lobbyEditing ? 'Сохранить' : 'Опубликовать')}
                      </button>
                    </div>
                    {lobbyEditing && (
                      <button
                        onClick={() => { setLobbyEditing(false); setLobbyLinkInput('') }}
                        style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 11, cursor: 'pointer', padding: '8px 0 0' }}
                      >
                        Отмена
                      </button>
                    )}
                  </div>
                )
              ) : (
                currentMatch.lobbyLink ? (
                  <div>
                    <div style={{ fontSize: 11, color: 'rgba(234,179,8,0.6)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Icon name="link" size={12} />Ссылка на лобби:
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
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                      }}
                    >
                      <Icon name="gamepad" size={15} />Войти в лобби <Icon name="chevronRight" size={14} />
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
                            <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                              <Icon name="timer" size={12} />Время на переход: <b style={{ color: notJoined.length > 0 ? '#F59E0B' : '#22C55E' }}>
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
                                display: 'inline-flex', alignItems: 'center', gap: 3,
                              }}>
                                {joined.includes(pid) ? <Icon name="check" size={10} /> : <Icon name="hourglass" size={10} />}{playerName(pid)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                ) : (
                  <div style={{ paddingTop: 4, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <Icon name="hourglass" size={13} />Хост публикует ссылку на лобби…
                    </div>
                    {lobbyLinkSecondsLeft != null && (
                      <div style={{ marginTop: 6, fontSize: 13, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: lobbyLinkSecondsLeft <= 60 ? '#E8092E' : '#9CA3AF' }}>
                        {Math.floor(lobbyLinkSecondsLeft / 60)}:{String(lobbyLinkSecondsLeft % 60).padStart(2, '0')}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>

            {/* My side badge + Discord (голосовой чат скрыт в клановых матчах) */}
            {!(currentMatch as any).isClanMatch && (mySide || currentMatch.voiceInviteT || currentMatch.voiceInviteCT) && (
              <div style={{
                background: mySide === 'T' ? 'rgba(234,179,8,0.07)' : 'rgba(59,130,246,0.07)',
                border: mySide === 'T' ? '1px solid rgba(234,179,8,0.25)' : '1px solid rgba(59,130,246,0.25)',
                borderRadius: 14, padding: '12px 14px',
              }}>
                <div style={{ textAlign: 'center', marginBottom: 10 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: mySide === 'T' ? '#EAB308' : '#60A5FA', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                    {mySide === 'T' ? <><Icon name="terrorist" size={15} />Ваша команда — Террористы</> : <><Icon name="shield" size={15} />Ваша команда — Спецназ</>}
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
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 10, padding: '10px 14px',
                        color: '#4B5563', fontWeight: 700, fontSize: 12,
                        cursor: 'default', userSelect: 'none', opacity: 0.7,
                      }}
                    >
                      <Icon name="lock" size={13} />Discord не привязан — голосовой чат недоступен
                    </div>
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
                      <Icon name="mic" size={15} />Войти в голосовой чат <Icon name="chevronRight" size={14} />
                    </a>
                  ) : (
                    <div style={{ fontSize: 12, color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}><Icon name="hourglass" size={13} />Голосовой чат создаётся...</div>
                  )
                })()}
              </div>
            )}

            {/* Teams — составы с аватарами, рангами и ELO */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { ids: currentMatch.teamAIds, cap: captainA, side: teamASide, isMe: isTeamA, label: 'Команда A', accent: '#60A5FA', elo: currentMatch.teamAElo },
                { ids: currentMatch.teamBIds, cap: captainB, side: teamBSide, isMe: isTeamB, label: 'Команда B', accent: '#F87171', elo: currentMatch.teamBElo },
              ].map((team, ti) => (
                <div key={ti} style={{
                  background: `linear-gradient(180deg, ${team.accent}14, rgba(15,15,21,0.6))`,
                  borderRadius: 18, border: `1px solid ${team.accent}33`, overflow: 'hidden',
                }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: `1px solid ${team.accent}1f` }}>
                    <span style={{ fontSize: 13, fontWeight: 900, color: team.accent, letterSpacing: '-0.01em' }}>{team.label}</span>
                    {team.isMe && <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', background: team.accent, padding: '2px 7px', borderRadius: 6, letterSpacing: '0.04em' }}>ВЫ</span>}
                    {team.side && (
                      <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '3px 9px', borderRadius: 7,
                        background: team.side === 'T' ? 'rgba(234,179,8,0.15)' : 'rgba(59,130,246,0.15)',
                        color: team.side === 'T' ? '#EAB308' : '#60A5FA',
                        border: `1px solid ${team.side === 'T' ? 'rgba(234,179,8,0.3)' : 'rgba(59,130,246,0.3)'}`,
                        display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {team.side === 'T' ? <><Icon name="terrorist" size={11} />Террористы</> : <><Icon name="shield" size={11} />Спецназ</>}
                      </span>
                    )}
                    <span style={{ marginLeft: team.side ? 0 : 'auto', fontSize: 10, color: '#6B7280', fontWeight: 700, whiteSpace: 'nowrap' }}>ср. {team.elo}</span>
                  </div>
                  {/* Players */}
                  <div style={{ padding: '6px 8px' }}>
                    {team.ids.map((pid) => {
                      const p = players[pid]
                      const elo = p?.elo ?? 1000
                      const rank = getEloRank(elo)
                      const isMe = pid === user.id
                      const isCap = pid === team.cap
                      return (
                        <div key={pid} style={{
                          display: 'flex', alignItems: 'center', gap: 11, padding: '8px 8px', borderRadius: 12,
                          background: isMe ? 'rgba(255,255,255,0.04)' : 'transparent',
                        }}>
                          {/* Avatar в ранг-цветном кольце */}
                          <div style={{ width: 44, height: 44, borderRadius: '50%', padding: 2, flexShrink: 0, background: `linear-gradient(135deg, ${rank.color}, ${rank.color}66)`, boxShadow: `0 0 10px ${rank.color}55` }}>
                            <div style={{ width: '100%', height: '100%', borderRadius: '50%', padding: 1.5, background: '#0a0a0f' }}>
                              <Avatar avatarUrl={p?.avatarUrl} name={p?.gameNickname || '?'} size={37} style={{ borderRadius: '50%' }} />
                            </div>
                          </div>
                          {/* Nick + rank */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              {isCap && <Icon name="crown" size={13} color="#EAB308" />}
                              <span style={{ fontSize: 14, fontWeight: isMe ? 800 : 700, color: isMe ? '#fff' : '#D1D5DB', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                                {p?.gameNickname || `Игрок ${pid}`}
                              </span>
                              {p?.isVerified && <Icon name="verified" size={13} color="#60A5FA" />}
                            </div>
                            <div style={{ fontSize: 11, color: rank.color, fontWeight: 700, marginTop: 1 }}>
                              {rank.label} · {elo} ELO
                            </div>
                          </div>
                          {/* Ранг-эмблема (наша jpg-иконка) */}
                          <div style={{ flexShrink: 0 }}>
                            <EloRing elo={elo} size={38} showLabel={false} />
                          </div>
                          {/* Report (не себя) */}
                          {!isMe && (
                            <button onClick={() => setReportTarget({ id: pid, name: p?.gameNickname || `Игрок ${pid}` })}
                              style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              title="Пожаловаться">
                              <Icon name="warning" size={15} color="#EF4444" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Прак: вместо загрузки результата — кнопка выхода (разблок через 5 мин) */}
            {myTeam && (currentMatch as any).clanMode === 'prac' && (
              <PracExit match={currentMatch} />
            )}

            {/* Result submission */}
            {myTeam && (currentMatch as any).clanMode !== 'prac' && (
              <div style={{
                ...cardStyle,
                border: '1px solid rgba(234,179,8,0.18)',
                background: 'rgba(234,179,8,0.04)',
              }}>
                <h3 style={{ fontWeight: 800, fontSize: 14, marginBottom: 12, color: '#fff', display: 'flex', alignItems: 'center', gap: 7 }}>
                  <Icon name="camera" size={15} />Результат — Команда {myTeam}
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
                      <Icon name="warning" size={22} color="#F87171" />
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
                    <div style={{ marginBottom: 8, color: '#4ADE80', display: 'flex', justifyContent: 'center' }}><Icon name="check-circle" size={32} /></div>
                    <p style={{ color: '#4ADE80', fontWeight: 800, fontSize: 14, margin: '0 0 4px' }}>Результат отправлен</p>
                    <p style={{ color: '#4B5563', fontSize: 12, margin: 0 }}>
                      {currentMatch.resultScreenshotA && currentMatch.resultScreenshotB
                        ? 'Оба капитана отправили — ждём проверки'
                        : 'Ожидаем скрин от капитана другой команды'}
                    </p>
                  </div>
                ) : !iAmCaptain ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ marginBottom: 8, color: '#EAB308', display: 'flex', justifyContent: 'center' }}><Icon name="crown" size={28} /></div>
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#9CA3AF', margin: '0 0 4px' }}>Загрузить результат может только капитан</p>
                    <p style={{ fontSize: 11, color: '#374151', margin: 0 }}>
                      Капитан вашей команды: <span style={{ color: '#fff' }}>{myCaptainId ? playerName(myCaptainId) : '—'}</span>
                    </p>
                  </div>
                ) : !lobbyLinkReady ? (
                  <div style={{ textAlign: 'center', padding: '16px 0' }}>
                    <div style={{ marginBottom: 8, color: '#EAB308', display: 'flex', justifyContent: 'center' }}><Icon name="link" size={28} /></div>
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
                            color: '#fff', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        ><Icon name="x" size={13} /></button>
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
                        <Icon name="camera" size={30} color="#4B5563" />
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
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>{submitting ? 'Отправка...' : <><Icon name="upload" size={15} />Отправить результат</>}</span>
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
                    style={{ marginBottom: 10, color: '#EF4444', display: 'flex', justifyContent: 'center' }}><Icon name="warning" size={42} /></motion.div>
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
                    style={{ marginBottom: 14, display: 'inline-flex', color: '#60A5FA' }}><Icon name="hourglass" size={42} /></motion.div>
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
                  style={{ marginBottom: 12, filter: `drop-shadow(0 0 20px ${accentGlow})`, color: accentColor, display: 'flex', justifyContent: 'center' }}
                >
                  <Icon name={isWin ? 'trophy' : isDraw ? 'handshake' : 'skull'} size={60} strokeWidth={1.6} />
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

        {/* Чат матча — общий для обеих команд (кроме экрана поиска) */}
        {currentMatch.status !== 'ready_check' &&
          (currentMatch.teamAIds?.includes(user.id) || currentMatch.teamBIds?.includes(user.id)) && (
          <div style={{ marginTop: 16 }}>
            <MatchChat matchId={Number(id)} userId={user.id} />
          </div>
        )}
      </div>
    </div>
  )
}

// Прак: кнопка выхода, разблокируется через 5 минут после старта. Результат не сохраняется.
function PracExit({ match }: { match: any }) {
  const router = useRouter()
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [])
  const startedAt = match.startedAt ? new Date(match.startedAt).getTime() : Date.now()
  const left = Math.max(0, 5 * 60 * 1000 - (now - startedAt))
  const unlocked = left <= 0
  const mm = Math.floor(left / 60000), ss = Math.floor((left % 60000) / 1000)

  const exit = async () => {
    setBusy(true)
    try { await api.post(`/matches/${match.id}/leave-prac`) } catch {}
    router.push('/dashboard')
  }
  return (
    <div style={{ ...cardStyle, border: '1px solid rgba(168,85,247,0.2)', background: 'rgba(168,85,247,0.05)', textAlign: 'center' }}>
      <h3 style={{ fontWeight: 800, fontSize: 14, marginBottom: 6, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
        <Icon name="swords" size={15} color="#A855F7" />Тренировочный матч (прак)
      </h3>
      <p style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 12px' }}>Результаты прака не сохраняются и не влияют на рейтинг.</p>
      <button onClick={exit} disabled={!unlocked || busy}
        style={{ width: '100%', padding: '13px 0', borderRadius: 12, border: 'none', cursor: unlocked ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 800, color: '#fff', background: unlocked ? 'linear-gradient(135deg, #A855F7, #E8092E)' : 'rgba(255,255,255,0.06)', opacity: unlocked ? 1 : 0.6 }}>
        {busy ? '…' : unlocked ? 'Выйти из прака' : `Выход через ${mm}:${String(ss).padStart(2, '0')}`}
      </button>
    </div>
  )
}

// 15-секундный круговой таймер хода вето
function VetoTimer({ seconds, active }: { seconds: number; active: boolean }) {
  const pct = Math.max(0, Math.min(1, seconds / 15))
  const SIZE = 38, R = 15, C = 2 * Math.PI * R
  const urgent = seconds <= 5
  const color = urgent ? '#E8092E' : active ? '#22C55E' : '#EAB308'
  const c2 = urgent ? '#ff5a72' : active ? '#4ADE80' : '#FACC15'
  const gid = `vt-${active ? 'a' : 'i'}-${urgent ? 'u' : 'n'}`
  return (
    <div style={{ position: 'relative', width: SIZE, height: SIZE, flexShrink: 0 }}>
      {/* мягкое свечение позади (пульсирует мягко) */}
      <motion.div
        animate={{ opacity: urgent ? [0.45, 0.85, 0.45] : [0.25, 0.45, 0.25], scale: urgent ? [1, 1.12, 1] : 1 }}
        transition={{ duration: urgent ? 0.9 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
        style={{ position: 'absolute', inset: -5, borderRadius: '50%', background: `radial-gradient(circle, ${color}80, transparent 68%)`, filter: 'blur(3px)', pointerEvents: 'none' }}
      />
      {/* стеклянная подложка */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(8,8,12,0.65)', border: `1px solid ${color}40`, boxShadow: `inset 0 0 8px ${color}30` }} />
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: 'rotate(-90deg)', position: 'relative' }}>
        <defs>
          <linearGradient id={gid} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={c2} />
            <stop offset="100%" stopColor={color} />
          </linearGradient>
        </defs>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3.5" />
        <motion.circle
          cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke={`url(#${gid})`} strokeWidth="3.5" strokeLinecap="round"
          strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - pct) }} transition={{ duration: 0.3, ease: 'linear' }}
        />
      </svg>
      <motion.div
        animate={urgent ? { scale: [1, 1.16, 1] } : { scale: 1 }}
        transition={urgent ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' } : {}}
        style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 900, color: '#fff', textShadow: `0 0 6px ${color}, 0 1px 2px rgba(0,0,0,0.6)`, fontVariantNumeric: 'tabular-nums' }}
      >
        {seconds}
      </motion.div>
    </div>
  )
}

// Кинематографичный реверс выбранной карты «Матч пройдёт на карте…»
function MapReveal({ map }: { map: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.5 } }}
      style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', background: '#060608' }}
    >
      {/* Фото карты с зумом */}
      <motion.div
        initial={{ scale: 1.35, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ position: 'absolute', inset: 0, backgroundImage: `url(${mapImgUrl(map)})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'brightness(0.45) saturate(1.25)' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, rgba(6,6,8,0.25) 0%, rgba(6,6,8,0.85) 75%)' }} />
      {/* Световой свип */}
      <motion.div
        initial={{ x: '-120%' }} animate={{ x: '220%' }} transition={{ duration: 1.4, ease: 'easeInOut', delay: 0.4 }}
        style={{ position: 'absolute', top: 0, bottom: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', pointerEvents: 'none' }}
      />
      <div style={{ position: 'relative', textAlign: 'center', padding: 24 }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
          style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9CA3AF', marginBottom: 14 }}
        >
          Матч пройдёт на карте
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.78 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.55, type: 'spring', stiffness: 200, damping: 18 }}
          style={{ fontSize: 52, fontWeight: 900, letterSpacing: '-0.02em', color: '#fff', textShadow: '0 4px 30px rgba(232,9,46,0.6)', lineHeight: 1 }}
        >
          {map}
        </motion.div>
        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 1.0, duration: 0.7, ease: 'easeOut' }}
          style={{ height: 3, width: 160, margin: '18px auto 0', borderRadius: 2, background: 'linear-gradient(90deg, transparent, #E8092E, transparent)', transformOrigin: 'center' }}
        />
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3, duration: 0.5 }}
          style={{ marginTop: 20, fontSize: 12, color: '#6B7280', fontWeight: 600 }}
        >
          Переход на матч…
        </motion.div>
      </div>
    </motion.div>
  )
}
