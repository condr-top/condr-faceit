'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'

// ─────────────── Types ───────────────
interface Stats {
  totalUsers: number
  totalMatches: number
  activeMatches: number
  newUsersToday: number
  pendingResults: number
  pendingPurchases: number
  pendingReports: number
  topPlayers: { id: number; gameNickname: string; firstName: string; elo: number; matchesPlayed: number }[]
}

interface AdminUser {
  id: number
  firstName: string
  username: string
  gameNickname: string
  gameId: string
  deviceSerial: string
  elo: number
  coins: number
  matchesPlayed: number
  isBanned: boolean
  isAdmin: boolean
  isModerator: boolean
  banReason?: string
  warns: number
}

interface KdMatch {
  id: number
  map: string
  status: string
  resultScreenshotA?: string
  resultScreenshotB?: string
  players: { userId: number; name: string; gameId: string; team: 'A' | 'B' }[]
  updatedAt: string
}

interface AdminMatch {
  id: number
  status: string
  map: string
  scoreA: number
  scoreB: number
  scoreAByCapA?: number
  scoreBByCapA?: number
  scoreAByCapB?: number
  scoreBByCapB?: number
  isDisputed?: boolean
  teamAIds: number[]
  teamBIds: number[]
  teamANames?: string[]
  teamBNames?: string[]
  resultScreenshotA?: string
  resultScreenshotB?: string
  createdAt: string
}

interface AdminReport {
  id: number
  reporterName: string
  reportedName: string
  reason: string
  description?: string
  status: string
  createdAt: string
}

interface AdminPurchase {
  id: number
  userName: string
  payerName: string
  bank: string
  rubles: number
  coins: number
  status: string
  createdAt: string
}

type TabId = 'stats' | 'users' | 'matches' | 'results' | 'reports' | 'purchases' | 'create' | 'kd' | 'support'

interface SupportChat {
  userId: number
  displayName: string
  avatarUrl: string | null
  lastMessage: string
  lastAt: string
  unread: number
}

interface SupportMsg {
  id: number
  text: string
  isFromAdmin: boolean
  createdAt: string
}

const ADMIN_TABS: { id: TabId; label: string; badge?: (s: Stats | null, sup?: number) => number }[] = [
  { id: 'stats',     label: '📊 Стата' },
  { id: 'users',     label: '👥 Игроки' },
  { id: 'matches',   label: '⚔️ Матчи' },
  { id: 'results',   label: '⏳ Результаты', badge: (s) => s?.pendingResults ?? 0 },
  { id: 'reports',   label: '🚨 Репорты',    badge: (s) => s?.pendingReports ?? 0 },
  { id: 'purchases', label: '💰 Покупки',    badge: (s) => s?.pendingPurchases ?? 0 },
  { id: 'create',    label: '➕ Создать' },
  { id: 'kd',        label: '🎯 K/D' },
  { id: 'support',   label: '💬 Поддержка',  badge: (_s, sup) => sup ?? 0 },
]

const MOD_TABS: { id: TabId; label: string }[] = [
  { id: 'kd', label: '🎯 K/D' },
]

const REASON_LABELS: Record<string, string> = {
  cheat: 'Читерство',
  insult: 'Оскорбления',
  afk: 'АФК / саботаж',
  fake_result: 'Фейковый результат',
  other: 'Другое',
}

const STATUS_COLORS: Record<string, string> = {
  pending:      'rgba(234,179,8,0.2)',
  confirmed:    'rgba(34,197,94,0.2)',
  rejected:     'rgba(239,68,68,0.2)',
  reviewed:     'rgba(34,197,94,0.2)',
  dismissed:    'rgba(107,114,128,0.2)',
  in_progress:  'rgba(59,130,246,0.2)',
  completed:    'rgba(34,197,94,0.2)',
  cancelled:    'rgba(107,114,128,0.2)',
  result_pending: 'rgba(234,179,8,0.2)',
}

const STATUS_TEXT: Record<string, string> = {
  pending:      '#EAB308',
  confirmed:    '#22C55E',
  rejected:     '#EF4444',
  reviewed:     '#22C55E',
  dismissed:    '#6B7280',
  in_progress:  '#3B82F6',
  completed:    '#22C55E',
  cancelled:    '#6B7280',
  result_pending: '#EAB308',
}

// ─────────────── Inline-edit popover ───────────────
function EditPopover({
  label,
  onSave,
  onClose,
}: {
  label: string
  onSave: (val: number) => void
  onClose: () => void
}) {
  const [val, setVal] = useState('')
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'rgba(30,30,40,0.97)', borderRadius: 16, padding: 24, width: 280,
          border: '1px solid rgba(255,255,255,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontWeight: 700, marginBottom: 12 }}>{label}</div>
        <input
          autoFocus
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          style={{
            width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 16, outline: 'none',
          }}
          onKeyDown={(e) => { if (e.key === 'Enter') { onSave(Number(val)); onClose() } }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button
            onClick={() => { onSave(Number(val)); onClose() }}
            style={{ flex: 1, background: '#E8092E', border: 'none', borderRadius: 8, padding: '8px 0', color: '#fff', fontWeight: 700, cursor: 'pointer' }}
          >
            Сохранить
          </button>
          <button
            onClick={onClose}
            style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 8, padding: '8px 0', color: '#999', cursor: 'pointer' }}
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}

// ─────────────── Screenshot viewer ───────────────
function ScreenshotModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <img src={url} alt="screenshot" style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 12 }} />
    </div>
  )
}

// ─────────────── Main Page ───────────────
export default function AdminPage() {
  const { user } = useAuthStore()
  const router = useRouter()

  const isMod = user?.isModerator && !user?.isAdmin
  const TABS = isMod ? MOD_TABS : ADMIN_TABS
  const [tab, setTab] = useState<TabId>(isMod ? 'kd' : 'stats')
  const [stats, setStats] = useState<Stats | null>(null)

  // Users
  const [users, setUsers] = useState<AdminUser[]>([])
  const [userSearch, setUserSearch] = useState('')
  const [userTotal, setUserTotal] = useState(0)
  const [userPage, setUserPage] = useState(1)

  // Matches
  const [matches, setMatches] = useState<AdminMatch[]>([])
  const [matchTotal, setMatchTotal] = useState(0)

  // Pending results
  const [pendingResults, setPendingResults] = useState<AdminMatch[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [screenshot, setScreenshot] = useState<string | null>(null)

  // Reports
  const [reports, setReports] = useState<AdminReport[]>([])
  const [reportFilter, setReportFilter] = useState('')

  // Purchases
  const [purchases, setPurchases] = useState<AdminPurchase[]>([])
  const [purchaseFilter, setPurchaseFilter] = useState('pending')

  // Edit popover
  const [editPopover, setEditPopover] = useState<{ userId: number; type: 'coins' | 'elo'; label: string } | null>(null)

  // Test lobby
  const [testLobby, setTestLobby] = useState<{ matchId: number; players: { id: number; name: string }[]; slots: number; filled: number } | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  // Loading
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const setLoad = (key: string, v: boolean) => setLoading((prev) => ({ ...prev, [key]: v }))

  // KD
  const [kdMatches, setKdMatches] = useState<KdMatch[]>([])
  const [kdTotal, setKdTotal] = useState(0)
  const [activeKdMatch, setActiveKdMatch] = useState<KdMatch | null>(null)
  // kdEntries: { userId -> { kills, deaths, assists } }
  const [kdEntries, setKdEntries] = useState<Record<number, { kills: string; deaths: string; assists: string }>>({})
  const [kdTotalRounds, setKdTotalRounds] = useState('')
  const [kdResetId, setKdResetId] = useState('')

  // ── Support ──
  const [supportChats, setSupportChats] = useState<SupportChat[]>([])
  const [supportUnread, setSupportUnread] = useState(0)
  const [openChatUserId, setOpenChatUserId] = useState<number | null>(null)
  const [chatMessages, setChatMessages] = useState<SupportMsg[]>([])
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // ── Auth guard ──
  useEffect(() => {
    if (user && !user.isAdmin && !user.isModerator) router.replace('/dashboard')
  }, [user])

  // ── Load stats ──
  useEffect(() => {
    if (!user?.isAdmin) return
    api.get('/admin/stats').then((r) => setStats(r.data)).catch(() => {})
  }, [user])

  // ── Load tab data ──
  const loadUsers = useCallback(async (page = 1, search = '') => {
    setLoad('users', true)
    try {
      const r = await api.get('/admin/users', { params: { search: search || undefined, page, limit: 20 } })
      setUsers(r.data.users)
      setUserTotal(r.data.total)
      setUserPage(page)
    } finally { setLoad('users', false) }
  }, [])

  const loadMatches = useCallback(async () => {
    setLoad('matches', true)
    try {
      const r = await api.get('/admin/matches', { params: { limit: 30 } })
      setMatches(r.data.matches)
      setMatchTotal(r.data.total)
    } finally { setLoad('matches', false) }
  }, [])

  const loadPendingResults = useCallback(async () => {
    setLoad('results', true)
    try {
      const r = await api.get('/admin/matches/pending-results')
      setPendingResults(r.data.matches)
      setPendingTotal(r.data.total)
    } finally { setLoad('results', false) }
  }, [])

  const loadReports = useCallback(async (status = '') => {
    setLoad('reports', true)
    try {
      const r = await api.get('/admin/reports', { params: { status: status || undefined, limit: 50 } })
      setReports(r.data.reports)
    } finally { setLoad('reports', false) }
  }, [])

  const loadPurchases = useCallback(async (status = 'pending') => {
    setLoad('purchases', true)
    try {
      const r = await api.get('/admin/purchases', { params: { status: status || undefined, limit: 50 } })
      setPurchases(r.data.purchases)
    } finally { setLoad('purchases', false) }
  }, [])

  const loadKd = useCallback(async () => {
    setLoad('kd', true)
    try {
      const r = await api.get('/admin/kd/pending', { params: { limit: 30 } })
      setKdMatches(r.data.matches)
      setKdTotal(r.data.total)
    } finally { setLoad('kd', false) }
  }, [])

  const submitKd = async (matchId: number) => {
    const entries = Object.entries(kdEntries).map(([uid, v]) => ({
      userId: Number(uid),
      kills: Number(v.kills) || 0,
      deaths: Number(v.deaths) || 0,
      assists: Number(v.assists) || 0,
    }))
    const totalRounds = kdTotalRounds ? Number(kdTotalRounds) : undefined
    setLoad(`kd_${matchId}`, true)
    try {
      await api.post(`/admin/kd/${matchId}`, { entries, totalRounds })
      setActiveKdMatch(null)
      setKdEntries({})
      setKdTotalRounds('')
      loadKd()
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка')
    } finally { setLoad(`kd_${matchId}`, false) }
  }

  const resetKd = async () => {
    const id = Number(kdResetId)
    if (!id) return
    if (!confirm(`Сбросить KD для матча #${id}? Статистика по этому матчу потребует повторного заполнения.`)) return
    try {
      await api.post(`/admin/kd/${id}/reset`)
      setKdResetId('')
      loadKd()
      alert(`✅ KD матча #${id} сброшен, он снова появится в очереди`)
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка')
    }
  }

  const loadSupportChats = async () => {
    try {
      const [chatsRes, unreadRes] = await Promise.all([
        api.get('/support/admin/chats'),
        api.get('/support/admin/unread'),
      ])
      setSupportChats(chatsRes.data)
      setSupportUnread(unreadRes.data)
    } catch {}
  }

  const loadChat = async (userId: number) => {
    try {
      const r = await api.get(`/support/admin/chats/${userId}`)
      setChatMessages(r.data)
      setSupportChats(prev => prev.map(c => c.userId === userId ? { ...c, unread: 0 } : c))
      setSupportUnread(prev => Math.max(0, prev - (supportChats.find(c => c.userId === userId)?.unread ?? 0)))
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    } catch {}
  }

  const sendReply = async () => {
    if (!replyText.trim() || !openChatUserId || replySending) return
    setReplySending(true)
    try {
      await api.post('/support/admin/reply', { userId: openChatUserId, text: replyText.trim() })
      setReplyText('')
      await loadChat(openChatUserId)
    } catch {} finally {
      setReplySending(false)
    }
  }

  useEffect(() => {
    if (!user?.isAdmin && !user?.isModerator) return
    if (tab === 'kd') loadKd()
    if (!user?.isAdmin) return
    if (tab === 'users') loadUsers(1, userSearch)
    if (tab === 'matches') loadMatches()
    if (tab === 'results') loadPendingResults()
    if (tab === 'reports') loadReports(reportFilter)
    if (tab === 'purchases') loadPurchases(purchaseFilter)
    if (tab === 'support') { loadSupportChats(); setOpenChatUserId(null) }
  }, [tab, user])

  // Poll support unread count
  useEffect(() => {
    if (!user?.isAdmin) return
    const t = setInterval(async () => {
      try {
        const r = await api.get('/support/admin/unread')
        setSupportUnread(r.data)
      } catch {}
    }, 8000)
    return () => clearInterval(t)
  }, [user])

  // Poll open chat
  useEffect(() => {
    if (!openChatUserId) return
    const t = setInterval(() => loadChat(openChatUserId), 4000)
    return () => clearInterval(t)
  }, [openChatUserId])

  // Poll active test lobby while on "create" tab
  useEffect(() => {
    if (!user?.isAdmin || tab !== 'create') return
    const fetchLobby = () =>
      api.get('/admin/test-match/active').then((r) => setTestLobby(r.data)).catch(() => {})
    fetchLobby()
    const interval = setInterval(fetchLobby, 3000)
    return () => clearInterval(interval)
  }, [tab, user])

  // ── User actions ──
  const ban = async (id: number) => {
    const reason = prompt('Причина бана:')
    if (!reason) return
    await api.post(`/admin/users/${id}/ban`, { reason })
    loadUsers(userPage, userSearch)
  }
  const unban = async (id: number) => {
    await api.post(`/admin/users/${id}/unban`)
    loadUsers(userPage, userSearch)
  }
  const warn = async (id: number) => {
    const reason = prompt('Причина варна (необязательно):') ?? undefined
    try {
      await api.post(`/admin/users/${id}/warn`, { reason: reason || undefined })
      loadUsers(userPage, userSearch)
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }
  const unwarn = async (id: number) => {
    if (!confirm('Снять 1 предупреждение?')) return
    try {
      await api.post(`/admin/users/${id}/unwarn`)
      loadUsers(userPage, userSearch)
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }
  const resetStats = async (id: number) => {
    try {
      await api.post(`/admin/users/${id}/reset-stats`)
      loadUsers(userPage, userSearch)
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка')
    }
  }

  const applyLeavePenalty = async (id: number, name: string) => {
    if (!confirm(`Штраф за leave/AFK для ${name}?\n-35 ELO + кулдаун (30м / 2ч / 24ч)`)) return
    try {
      await api.post(`/admin/users/${id}/leave-penalty`)
      loadUsers(userPage, userSearch)
    } catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
  }
  const toggleAdmin = async (id: number, current: boolean) => {
    if (!confirm(current ? 'Снять права администратора?' : 'Выдать права администратора?')) return
    await api.patch(`/admin/users/${id}/admin`, { isAdmin: !current })
    loadUsers(userPage, userSearch)
  }
  const toggleModerator = async (id: number, current: boolean) => {
    if (!confirm(current ? 'Снять права модератора?' : 'Выдать права модератора?')) return
    await api.patch(`/admin/users/${id}/moderator`, { isModerator: !current })
    loadUsers(userPage, userSearch)
  }
  const saveCoins = async (userId: number, amount: number) => {
    if (isNaN(amount)) return
    await api.patch(`/admin/users/${userId}/coins`, { amount })
    loadUsers(userPage, userSearch)
  }
  const saveElo = async (userId: number, elo: number) => {
    if (isNaN(elo) || elo < 100) return
    await api.patch(`/admin/users/${userId}/elo`, { elo })
    loadUsers(userPage, userSearch)
  }

  // ── Match actions ──
  const cancelMatch = async (id: number) => {
    if (!confirm('Отменить матч #' + id + '?')) return
    await api.post(`/admin/matches/${id}/cancel`)
    loadMatches()
  }
  const confirmResult = async (id: number, winner: 'A' | 'B' | 'draw') => {
    setLoad(`result_${id}`, true)
    try {
      await api.post(`/admin/matches/${id}/result`, { winner })
      loadPendingResults()
      api.get('/admin/stats').then((r) => setStats(r.data))
    } finally { setLoad(`result_${id}`, false) }
  }

  // ── Report actions ──
  const updateReport = async (id: number, status: string) => {
    await api.patch(`/admin/reports/${id}/status`, { status })
    loadReports(reportFilter)
    api.get('/admin/stats').then((r) => setStats(r.data))
  }

  // ── Purchase actions ──
  const confirmPurchase = async (id: number) => {
    setLoad(`purchase_${id}`, true)
    try {
      await api.post(`/admin/purchases/${id}/confirm`)
      await loadPurchases(purchaseFilter)
      api.get('/admin/stats').then((r) => setStats(r.data))
    } catch (e: any) {
      alert('Ошибка подтверждения: ' + (e?.response?.data?.message || e?.message || 'Неизвестная ошибка'))
    } finally { setLoad(`purchase_${id}`, false) }
  }
  const rejectPurchase = async (id: number) => {
    setLoad(`purchase_${id}`, true)
    try {
      await api.post(`/admin/purchases/${id}/reject`)
      await loadPurchases(purchaseFilter)
      api.get('/admin/stats').then((r) => setStats(r.data))
    } catch (e: any) {
      alert('Ошибка отклонения: ' + (e?.response?.data?.message || e?.message || 'Неизвестная ошибка'))
    } finally { setLoad(`purchase_${id}`, false) }
  }

  // ── Create content ──
  const createMission = async () => {
    const title = prompt('Название задания:')
    if (!title) return
    const goal = parseInt(prompt('Цель:') || '1')
    const rewardCoins = parseInt(prompt('Награда монеты:') || '50')
    const rewardXp = parseInt(prompt('Награда XP:') || '100')
    const missionKey = prompt('Ключ (wins/kills/matches):') || 'matches'
    await api.post('/admin/missions', { title, description: title, type: 'daily', goal, rewardCoins, rewardXp, missionKey })
    alert('Задание создано!')
  }
  const createShopItem = async () => {
    const title = prompt('Название:')
    if (!title) return
    const type = prompt('Тип (premium/xp_boost/avatar_frame):') || 'premium'
    const priceCoins = parseInt(prompt('Цена монеты:') || '500')
    const effectValue = prompt('Значение эффекта:') || '30'
    await api.post('/admin/shop', { title, type, priceCoins, effectValue, isActive: true })
    alert('Товар добавлен!')
  }

  if (!user?.isAdmin) return null

  // ─── Render helpers ───

  const card = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: '12px 14px',
  }

  const pill = (status: string) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 700,
    background: STATUS_COLORS[status] || 'rgba(255,255,255,0.08)',
    color: STATUS_TEXT[status] || '#aaa',
  })

  const btnSm = (color = '#E8092E', bg?: string) => ({
    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
    background: bg || `${color}33`, color,
  })

  return (
    <div style={{ minHeight: '100vh', background: '#060608', paddingBottom: 40, color: '#fff', fontFamily: 'Actay, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '20px 16px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => router.back()}
          style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 14, cursor: 'pointer', padding: 0 }}
        >
          ← Назад
        </motion.button>
        <h1 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Панель администратора</h1>
      </div>

      {/* Tab bar */}
      <div style={{ padding: '14px 16px 0', display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map((t) => {
          const badgeCount = t.badge ? t.badge(stats, supportUnread) : 0
          return (
            <motion.button
              key={t.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => setTab(t.id)}
              style={{
                position: 'relative',
                whiteSpace: 'nowrap', padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', border: 'none', flexShrink: 0,
                background: tab === t.id ? '#E8092E' : 'rgba(255,255,255,0.06)',
                color: tab === t.id ? '#fff' : '#aaa',
                transition: 'background 0.2s',
              }}
            >
              {t.label}
              {badgeCount > 0 && (
                <span style={{
                  position: 'absolute', top: -4, right: -4,
                  background: '#E8092E', color: '#fff', borderRadius: 10,
                  fontSize: 10, fontWeight: 700, padding: '1px 5px',
                  border: '2px solid #0D0D12',
                }}>{badgeCount}</span>
              )}
            </motion.button>
          )
        })}
      </div>

      <div style={{ padding: '14px 16px 0' }}>

        {/* ── STATS TAB ── */}
        {tab === 'stats' && stats && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[
                { label: 'Всего игроков', value: stats.totalUsers, color: '#E8092E' },
                { label: 'Сегодня новых', value: stats.newUsersToday, color: '#22C55E' },
                { label: 'Всего матчей', value: stats.totalMatches, color: '#3B82F6' },
                { label: 'Активных матчей', value: stats.activeMatches, color: '#A855F7' },
                { label: 'Ожид. результатов', value: stats.pendingResults, color: '#EAB308' },
                { label: 'Ожид. покупок', value: stats.pendingPurchases, color: '#F97316' },
                { label: 'Новых репортов', value: stats.pendingReports, color: '#EF4444' },
              ].map((s) => (
                <div key={s.label} style={{ ...card, textAlign: 'center' }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            <div style={{ ...card }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>🏆 Топ 5 игроков</div>
              {stats.topPlayers.map((p, i) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{p.gameNickname || p.firstName}</div>
                    <div style={{ fontSize: 11, color: '#666' }}>{p.matchesPlayed} матчей</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#E8092E' }}>{p.elo}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── USERS TAB ── */}
        {tab === 'users' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') loadUsers(1, userSearch) }}
                placeholder="Поиск (Enter для поиска)..."
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13, outline: 'none',
                }}
              />
              <button
                onClick={() => loadUsers(1, userSearch)}
                style={{ ...btnSm('#fff', 'rgba(255,255,255,0.1)'), padding: '8px 14px', fontSize: 13 }}
              >
                🔍
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>Всего: {userTotal}</div>

            {loading.users ? (
              <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>Загрузка...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {users.map((u) => (
                  <div key={u.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>
                          {u.gameNickname || u.firstName}
                        </span>
                        {u.isAdmin && <span style={{ marginLeft: 6, fontSize: 12 }}>👑</span>}
                        {u.isBanned && <span style={{ marginLeft: 4, fontSize: 12 }}>🚫</span>}
                        {u.username && (
                          <span style={{ marginLeft: 6, fontSize: 11, color: '#555' }}>@{u.username}</span>
                        )}
                      </div>
                      <span style={{ fontSize: 11, color: '#555' }}>#{u.id}</span>
                    </div>

                    <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#888', marginBottom: 8 }}>
                      <span>ELO: <b style={{ color: '#fff' }}>{u.elo}</b></span>
                      <span>💰 <b style={{ color: '#fff' }}>{u.coins}</b></span>
                      <span>Матчей: <b style={{ color: '#fff' }}>{u.matchesPlayed}</b></span>
                      {(u.warns ?? 0) > 0 && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          {[1,2,3].map(n => (
                            <span key={n} style={{
                              display: 'inline-block', width: 8, height: 8,
                              clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                              background: n <= u.warns ? (u.warns >= 3 ? '#EF4444' : '#F59E0B') : 'rgba(255,255,255,0.1)',
                            }} />
                          ))}
                          <b style={{ color: u.warns >= 3 ? '#EF4444' : '#F59E0B' }}>{u.warns}/3</b>
                        </span>
                      )}
                    </div>

                    {(u.gameId || u.deviceSerial) && (
                      <div style={{ display: 'flex', gap: 10, fontSize: 11, color: '#666', marginBottom: 6, flexWrap: 'wrap' }}>
                        {u.gameId && (
                          <span>
                            🎮 Game ID: <b style={{ color: '#aaa', userSelect: 'all' }}>{u.gameId}</b>
                          </span>
                        )}
                        {u.deviceSerial && (
                          <span>
                            📱 Serial: <b style={{ color: '#aaa', userSelect: 'all', fontFamily: 'monospace' }}>{u.deviceSerial}</b>
                          </span>
                        )}
                      </div>
                    )}

                    {u.isBanned && u.banReason && (
                      <div style={{ fontSize: 11, color: '#EF4444', marginBottom: 6 }}>Бан: {u.banReason}</div>
                    )}

                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button
                        onClick={() => setEditPopover({ userId: u.id, type: 'elo', label: `ELO для ${u.gameNickname || u.firstName}` })}
                        style={btnSm('#A855F7')}
                      >
                        ✏️ ELO
                      </button>
                      <button
                        onClick={() => setEditPopover({ userId: u.id, type: 'coins', label: `Монеты (+ или -) для ${u.gameNickname || u.firstName}` })}
                        style={btnSm('#EAB308')}
                      >
                        💰 Монеты
                      </button>
                      <button
                        onClick={() => toggleAdmin(u.id, u.isAdmin)}
                        style={btnSm(u.isAdmin ? '#EAB308' : '#aaa')}
                      >
                        {u.isAdmin ? '👑 Снять' : '👑 Адм'}
                      </button>
                      <button
                        onClick={() => toggleModerator(u.id, u.isModerator)}
                        style={btnSm(u.isModerator ? '#A855F7' : '#aaa')}
                      >
                        {u.isModerator ? '🛡️ Снять' : '🛡️ Мод'}
                      </button>
                      {u.isBanned ? (
                        <button onClick={() => unban(u.id)} style={btnSm('#22C55E')}>✅ Разбан</button>
                      ) : (
                        <button onClick={() => ban(u.id)} style={btnSm('#EF4444')}>🚫 Бан</button>
                      )}
                      <button onClick={() => warn(u.id)} style={btnSm('#F59E0B')}>⚠️ Варн</button>
                      {(u.warns ?? 0) > 0 && (
                        <button onClick={() => unwarn(u.id)} style={btnSm('#6B7280')}>↩ Снять варн</button>
                      )}
                      <button onClick={() => applyLeavePenalty(u.id, u.gameNickname || u.firstName)} style={btnSm('#EF4444', 'rgba(239,68,68,0.12)')}>🚪 Leave</button>
                      <button onClick={() => resetStats(u.id)} style={btnSm('#6366F1', 'rgba(99,102,241,0.12)')}>🔄 Сброс стата</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {userTotal > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 14 }}>
                {userPage > 1 && (
                  <button onClick={() => loadUsers(userPage - 1, userSearch)} style={btnSm('#aaa', 'rgba(255,255,255,0.06)')}>← Пред</button>
                )}
                <span style={{ fontSize: 13, color: '#555', alignSelf: 'center' }}>
                  {userPage} / {Math.ceil(userTotal / 20)}
                </span>
                {userPage < Math.ceil(userTotal / 20) && (
                  <button onClick={() => loadUsers(userPage + 1, userSearch)} style={btnSm('#aaa', 'rgba(255,255,255,0.06)')}>След →</button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── MATCHES TAB ── */}
        {tab === 'matches' && (
          <div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>Всего: {matchTotal}</div>
            {loading.matches ? (
              <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>Загрузка...</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {matches.map((m) => (
                  <div key={m.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontWeight: 700 }}>Матч #{m.id}</span>
                        {m.map && <span style={{ marginLeft: 8, fontSize: 12, color: '#aaa' }}>{m.map}</span>}
                        {(m.scoreA !== null && m.scoreA !== undefined) && (
                          <span style={{ marginLeft: 8, fontSize: 12, color: '#fff' }}>{m.scoreA}:{m.scoreB}</span>
                        )}
                      </div>
                      <span style={pill(m.status)}>{m.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>
                      {new Date(m.createdAt).toLocaleString('ru-RU')}
                    </div>
                    {m.status !== 'completed' && m.status !== 'cancelled' && (
                      <button
                        onClick={() => cancelMatch(m.id)}
                        style={{ ...btnSm('#EF4444'), marginTop: 8 }}
                      >
                        Отменить
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PENDING RESULTS TAB ── */}
        {tab === 'results' && (
          <div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 8 }}>Ожидают подтверждения: {pendingTotal}</div>
            {loading.results ? (
              <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>Загрузка...</div>
            ) : pendingResults.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#444', padding: 40, fontSize: 14 }}>
                ✅ Все результаты подтверждены
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {pendingResults.map((m) => (
                  <div key={m.id} style={{
                    ...card,
                    border: m.isDisputed ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(234,179,8,0.3)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontWeight: 700 }}>Матч #{m.id}</span>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        {m.isDisputed && (
                          <span style={{ fontSize: 11, fontWeight: 800, color: '#EF4444', background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 20 }}>
                            ⚠️ СПОР
                          </span>
                        )}
                        <span style={{ fontSize: 12, color: '#aaa' }}>{m.map}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                      <div>
                        <div style={{ color: '#3B82F6', fontWeight: 700, marginBottom: 4 }}>Команда A</div>
                        {(m.teamANames || []).map((n, i) => (
                          <div key={i} style={{ fontSize: 11, color: '#aaa' }}>{n}</div>
                        ))}
                      </div>
                      <div style={{ alignSelf: 'center', textAlign: 'center' }}>
                        {m.isDisputed ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 11, color: '#555' }}>Кап. A:</div>
                            <div style={{ fontSize: 16, fontWeight: 800 }}>
                              <span style={{ color: '#3B82F6' }}>{m.scoreAByCapA}</span>
                              <span style={{ color: '#555', margin: '0 2px' }}>:</span>
                              <span style={{ color: '#EF4444' }}>{m.scoreBByCapA}</span>
                            </div>
                            <div style={{ fontSize: 11, color: '#555' }}>Кап. B:</div>
                            <div style={{ fontSize: 16, fontWeight: 800 }}>
                              <span style={{ color: '#3B82F6' }}>{m.scoreAByCapB}</span>
                              <span style={{ color: '#555', margin: '0 2px' }}>:</span>
                              <span style={{ color: '#EF4444' }}>{m.scoreBByCapB}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{ fontSize: 22, fontWeight: 800 }}>
                            <span style={{ color: '#3B82F6' }}>{m.scoreA}</span>
                            <span style={{ color: '#555' }}>:</span>
                            <span style={{ color: '#EF4444' }}>{m.scoreB}</span>
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#EF4444', fontWeight: 700, marginBottom: 4 }}>Команда B</div>
                        {(m.teamBNames || []).map((n, i) => (
                          <div key={i} style={{ fontSize: 11, color: '#aaa' }}>{n}</div>
                        ))}
                      </div>
                    </div>

                    {/* Screenshots */}
                    <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      {m.resultScreenshotA && (
                        <button
                          onClick={() => setScreenshot(m.resultScreenshotA!)}
                          style={{ flex: 1, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '6px 0', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}
                        >
                          📸 Скрин кап. A {m.isDisputed ? `(${m.scoreAByCapA}:${m.scoreBByCapA})` : ''}
                        </button>
                      )}
                      {m.resultScreenshotB && (
                        <button
                          onClick={() => setScreenshot(m.resultScreenshotB!)}
                          style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '6px 0', color: '#EF4444', fontSize: 12, cursor: 'pointer' }}
                        >
                          📸 Скрин кап. B {m.isDisputed ? `(${m.scoreAByCapB}:${m.scoreBByCapB})` : ''}
                        </button>
                      )}
                    </div>

                    {/* Winner buttons */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {(['A', 'B', 'draw'] as const).map((w) => (
                        <button
                          key={w}
                          onClick={() => confirmResult(m.id, w)}
                          disabled={loading[`result_${m.id}`]}
                          style={{
                            flex: 1, border: 'none', borderRadius: 8, padding: '8px 0',
                            fontWeight: 700, fontSize: 12, cursor: 'pointer',
                            background: w === 'A' ? '#3B82F6' : w === 'B' ? '#EF4444' : 'rgba(255,255,255,0.1)',
                            color: '#fff',
                            opacity: loading[`result_${m.id}`] ? 0.5 : 1,
                          }}
                        >
                          {w === 'A' ? '🔵 Победа A' : w === 'B' ? '🔴 Победа B' : '🤝 Ничья'}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── REPORTS TAB ── */}
        {tab === 'reports' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {[['', 'Все'], ['pending', '⏳ Новые'], ['reviewed', '✅ Просмотрено'], ['dismissed', '🚫 Отклонено']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setReportFilter(val); loadReports(val) }}
                  style={{
                    padding: '5px 12px', borderRadius: 16, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: reportFilter === val ? '#E8092E' : 'rgba(255,255,255,0.06)',
                    color: reportFilter === val ? '#fff' : '#aaa',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading.reports ? (
              <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>Загрузка...</div>
            ) : reports.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#444', padding: 40 }}>Репортов нет</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reports.map((r) => (
                  <div key={r.id} style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        <span style={{ color: '#aaa' }}>{r.reporterName}</span>
                        <span style={{ color: '#555', margin: '0 6px' }}>→</span>
                        <span style={{ color: '#EF4444' }}>{r.reportedName}</span>
                      </div>
                      <span style={pill(r.status)}>{r.status}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>
                      {REASON_LABELS[r.reason] || r.reason}
                    </div>
                    {r.description && (
                      <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{r.description}</div>
                    )}
                    <div style={{ fontSize: 11, color: '#444', marginBottom: r.status === 'pending' ? 8 : 0 }}>
                      {new Date(r.createdAt).toLocaleString('ru-RU')}
                    </div>
                    {r.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => updateReport(r.id, 'reviewed')} style={btnSm('#22C55E')}>✅ Просмотрено</button>
                        <button onClick={() => updateReport(r.id, 'dismissed')} style={btnSm('#6B7280')}>🚫 Отклонить</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PURCHASES TAB ── */}
        {tab === 'purchases' && (
          <div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {[['pending', '⏳ Ожидают'], ['confirmed', '✅ Подтверждено'], ['rejected', '❌ Отклонено'], ['', 'Все']].map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => { setPurchaseFilter(val); loadPurchases(val) }}
                  style={{
                    padding: '5px 12px', borderRadius: 16, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    background: purchaseFilter === val ? '#E8092E' : 'rgba(255,255,255,0.06)',
                    color: purchaseFilter === val ? '#fff' : '#aaa',
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {loading.purchases ? (
              <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>Загрузка...</div>
            ) : purchases.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#444', padding: 40 }}>Нет заявок</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {purchases.map((p) => (
                  <div key={p.id} style={{ ...card, border: p.status === 'pending' ? '1px solid rgba(234,179,8,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 14 }}>{p.userName}</span>
                        <span style={{ marginLeft: 8, fontSize: 11, color: '#555' }}>#{p.id}</span>
                      </div>
                      <span style={pill(p.status)}>{p.status}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 6 }}>
                      <span>💵 <b style={{ color: '#fff' }}>{p.rubles} ₽</b></span>
                      <span>🪙 <b style={{ color: '#EAB308' }}>+{p.coins}</b></span>
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginBottom: p.status === 'pending' ? 8 : 0 }}>
                      👤 {p.payerName} · 🏦 {p.bank}<br />
                      {new Date(p.createdAt).toLocaleString('ru-RU')}
                    </div>
                    {p.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => confirmPurchase(p.id)}
                          disabled={loading[`purchase_${p.id}`]}
                          style={{ ...btnSm('#22C55E'), opacity: loading[`purchase_${p.id}`] ? 0.5 : 1 }}
                        >
                          ✅ Подтвердить
                        </button>
                        <button
                          onClick={() => rejectPurchase(p.id)}
                          disabled={loading[`purchase_${p.id}`]}
                          style={{ ...btnSm('#EF4444'), opacity: loading[`purchase_${p.id}`] ? 0.5 : 1 }}
                        >
                          ❌ Отклонить
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── CREATE TAB ── */}
        {tab === 'create' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={card}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🎯 Задания</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>Ежедневные и еженедельные задания для игроков</div>
              <button onClick={createMission} style={{ width: '100%', background: '#E8092E22', border: '1px solid #E8092E44', borderRadius: 8, padding: '10px 0', color: '#E8092E', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                ➕ Создать задание
              </button>
            </div>
            <div style={card}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🛒 Магазин</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 10 }}>Добавить товар в магазин (скины, бусты, премиум)</div>
              <button onClick={createShopItem} style={{ width: '100%', background: '#EAB30822', border: '1px solid #EAB30844', borderRadius: 8, padding: '10px 0', color: '#EAB308', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                ➕ Добавить товар
              </button>
            </div>
            <div style={{ ...card, border: testLobby ? '1px solid rgba(168,85,247,0.4)' : '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>🧪 Тестовое лобби 2v2</div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                До 4 админов играют вместе без очереди
              </div>

              {testLobby ? (
                <>
                  {/* Active lobby status */}
                  <div style={{
                    background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.25)',
                    borderRadius: 10, padding: '10px 12px', marginBottom: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12, color: '#A855F7', fontWeight: 700 }}>
                        Лобби #{testLobby.matchId} активно
                      </span>
                      <span style={{ fontSize: 12, color: '#aaa' }}>
                        {testLobby.filled}/{testLobby.slots} игроков
                      </span>
                    </div>
                    {/* Slots visualization */}
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                      {Array.from({ length: testLobby.slots }).map((_, i) => {
                        const player = testLobby.players[i]
                        return (
                          <div key={i} style={{
                            flex: 1, padding: '6px 4px', borderRadius: 6, textAlign: 'center',
                            fontSize: 11, fontWeight: 700,
                            background: player ? 'rgba(168,85,247,0.25)' : 'rgba(255,255,255,0.05)',
                            color: player ? '#C084FC' : '#444',
                            border: player ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(255,255,255,0.06)',
                          }}>
                            {player ? player.name.slice(0, 6) : '—'}
                          </div>
                        )
                      })}
                    </div>
                    {/* Team labels */}
                    <div style={{ display: 'flex', fontSize: 10, color: '#555' }}>
                      <span style={{ flex: 1, textAlign: 'center' }}>🔵 A</span>
                      <span style={{ flex: 1, textAlign: 'center' }}>🔵 A</span>
                      <span style={{ flex: 1, textAlign: 'center' }}>🔴 B</span>
                      <span style={{ flex: 1, textAlign: 'center' }}>🔴 B</span>
                    </div>
                  </div>

                  {/* Join or view button */}
                  {testLobby.players.some((p) => p.id === user?.id) ? (
                    <button
                      onClick={() => router.push(`/match/${testLobby.matchId}`)}
                      style={{ width: '100%', background: '#A855F7', border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
                    >
                      👁 Открыть лобби
                    </button>
                  ) : (
                    <button
                      disabled={testLoading}
                      onClick={async () => {
                        setTestLoading(true)
                        try {
                          const res = await api.post('/admin/test-match/join')
                          router.push(`/match/${res.data.id}`)
                        } catch (e: any) {
                          alert(e?.response?.data?.message || 'Ошибка')
                        } finally {
                          setTestLoading(false)
                        }
                      }}
                      style={{ width: '100%', background: '#A855F7', border: 'none', borderRadius: 8, padding: '10px 0', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: testLoading ? 0.6 : 1 }}
                    >
                      🚀 Войти в лобби
                    </button>
                  )}
                </>
              ) : (
                <button
                  disabled={testLoading}
                  onClick={async () => {
                    setTestLoading(true)
                    try {
                      const res = await api.post('/admin/test-match')
                      router.push(`/match/${res.data.id}`)
                    } catch (e: any) {
                      alert(e?.response?.data?.message || 'Ошибка')
                    } finally {
                      setTestLoading(false)
                    }
                  }}
                  style={{ width: '100%', background: '#A855F722', border: '1px solid #A855F744', borderRadius: 8, padding: '10px 0', color: '#A855F7', fontWeight: 700, cursor: 'pointer', fontSize: 13, opacity: testLoading ? 0.6 : 1 }}
                >
                  🧪 Создать тест-лобби 2v2
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── KD TAB ── */}
        {tab === 'kd' && (
          <div>
            {activeKdMatch ? (
              /* ── KD Entry form for one match ── */
              <div>
                <button
                  onClick={() => { setActiveKdMatch(null); setKdEntries({}) }}
                  style={{ background: 'none', border: 'none', color: '#aaa', fontSize: 13, cursor: 'pointer', marginBottom: 12, padding: 0 }}
                >
                  ← Назад к списку
                </button>

                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Матч #{activeKdMatch.id} — {activeKdMatch.map}</div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 12 }}>Введите K/D/A по скриншоту результата</div>

                {/* Total rounds — top-level field */}
                <div style={{
                  background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: 'rgba(234,179,8,0.8)', fontWeight: 700, marginBottom: 4 }}>
                      🔢 ВСЕГО РАУНДОВ В МАТЧЕ
                    </div>
                    <div style={{ fontSize: 10, color: '#555' }}>Общее количество сыгранных раундов</div>
                  </div>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={kdTotalRounds}
                    onChange={(e) => setKdTotalRounds(e.target.value)}
                    placeholder="—"
                    style={{
                      width: 64, textAlign: 'center', background: 'rgba(0,0,0,0.5)',
                      border: '1px solid rgba(234,179,8,0.4)', borderRadius: 8,
                      padding: '8px 4px', color: '#EAB308', fontSize: 18,
                      fontWeight: 800, outline: 'none',
                    }}
                  />
                </div>

                {/* Screenshots */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                  {activeKdMatch.resultScreenshotA && (
                    <button onClick={() => setScreenshot(activeKdMatch.resultScreenshotA!)}
                      style={{ flex: 1, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 8, padding: '8px 0', color: '#3B82F6', fontSize: 12, cursor: 'pointer' }}>
                      📸 Скрин A
                    </button>
                  )}
                  {activeKdMatch.resultScreenshotB && (
                    <button onClick={() => setScreenshot(activeKdMatch.resultScreenshotB!)}
                      style={{ flex: 1, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 0', color: '#EF4444', fontSize: 12, cursor: 'pointer' }}>
                      📸 Скрин B
                    </button>
                  )}
                </div>

                {/* Players table */}
                {/* Column header */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px',
                  gap: 8, padding: '0 10px', marginBottom: 6,
                }}>
                  <div style={{ fontSize: 10, color: '#444' }}>Игрок</div>
                  <div style={{ fontSize: 10, color: '#22C55E', fontWeight: 800, textAlign: 'center' }}>Убийства</div>
                  <div style={{ fontSize: 10, color: '#A855F7', fontWeight: 800, textAlign: 'center' }}>Ассисты</div>
                  <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 800, textAlign: 'center' }}>Смерти</div>
                </div>

                {(['A', 'B'] as const).map((team) => (
                  <div key={team} style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: team === 'A' ? '#3B82F6' : '#EF4444', marginBottom: 8, letterSpacing: 1 }}>
                      КОМАНДА {team}
                    </div>
                    {activeKdMatch.players.filter(p => p.team === team).map((p) => {
                      const e = kdEntries[p.userId] ?? { kills: '', deaths: '', assists: '' }
                      const setE = (f: 'kills' | 'deaths' | 'assists', v: string) =>
                        setKdEntries(prev => ({ ...prev, [p.userId]: { ...e, [f]: v } }))
                      return (
                        <div key={p.userId} style={{
                          display: 'grid', gridTemplateColumns: '1fr 60px 60px 60px',
                          gap: 8, alignItems: 'center', marginBottom: 8,
                          background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px',
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}</div>
                            {p.gameId && <div style={{ fontSize: 10, color: '#555' }}>{p.gameId}</div>}
                          </div>
                          {(['kills', 'assists', 'deaths'] as const).map((field) => (
                            <div key={field} style={{ textAlign: 'center' }}>
                              <div style={{ fontSize: 9, color: '#555', marginBottom: 2, letterSpacing: 0.5 }}>
                                {field === 'kills' ? 'K' : field === 'deaths' ? 'D' : 'A'}
                              </div>
                              <input
                                type="number"
                                min={0}
                                value={e[field]}
                                onChange={(ev) => setE(field, ev.target.value)}
                                style={{
                                  width: '100%', textAlign: 'center', background: 'rgba(0,0,0,0.4)',
                                  border: `1px solid ${field === 'kills' ? 'rgba(34,197,94,0.5)' : field === 'deaths' ? 'rgba(239,68,68,0.5)' : 'rgba(168,85,247,0.5)'}`,
                                  borderRadius: 6, padding: '5px 2px',
                                  color: field === 'kills' ? '#22C55E' : field === 'deaths' ? '#EF4444' : '#A855F7',
                                  fontSize: 14, fontWeight: 800, outline: 'none',
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}

                <button
                  onClick={() => submitKd(activeKdMatch.id)}
                  disabled={loading[`kd_${activeKdMatch.id}`]}
                  style={{
                    width: '100%', background: '#22C55E', border: 'none', borderRadius: 10,
                    padding: '12px 0', color: '#000', fontWeight: 800, fontSize: 14,
                    cursor: 'pointer', opacity: loading[`kd_${activeKdMatch.id}`] ? 0.5 : 1,
                  }}
                >
                  {loading[`kd_${activeKdMatch.id}`] ? 'Сохранение...' : '✅ Сохранить K/D'}
                </button>
              </div>
            ) : (
              /* ── Match list ── */
              <div>
                <div style={{ fontSize: 12, color: '#555', marginBottom: 12 }}>
                  Матчей без K/D: {kdTotal}
                </div>
                {loading.kd ? (
                  <div style={{ textAlign: 'center', color: '#555', padding: 40 }}>Загрузка...</div>
                ) : kdMatches.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#444', padding: 40, fontSize: 14 }}>
                    ✅ Все K/D заполнены
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {kdMatches.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setActiveKdMatch(m)
                          setKdTotalRounds('')
                          const init: Record<number, { kills: string; deaths: string; assists: string }> = {}
                          m.players.forEach(p => { init[p.userId] = { kills: '', deaths: '', assists: '' } })
                          setKdEntries(init)
                        }}
                        style={{
                          ...card, cursor: 'pointer', textAlign: 'left',
                          border: '1px solid rgba(34,197,94,0.2)',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>Матч #{m.id}</div>
                          <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                            {m.players.map(p => p.name).join(' · ')}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 12, color: '#aaa' }}>{m.map}</div>
                          <div style={{ fontSize: 11, color: '#22C55E', marginTop: 2 }}>Заполнить K/D →</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Admin-only: reset KD for a specific match */}
                {user?.isAdmin && (
                  <div style={{
                    marginTop: 24, padding: '12px 14px',
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: 10,
                  }}>
                    <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, marginBottom: 8 }}>
                      🔄 Сброс KD (для исправления ошибок)
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        type="number"
                        value={kdResetId}
                        onChange={(e) => setKdResetId(e.target.value)}
                        placeholder="ID матча"
                        style={{
                          flex: 1, background: 'rgba(0,0,0,0.4)',
                          border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                          padding: '6px 10px', color: '#fff', fontSize: 13, outline: 'none',
                        }}
                      />
                      <button
                        onClick={resetKd}
                        disabled={!kdResetId}
                        style={{
                          background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
                          borderRadius: 8, padding: '6px 14px', color: '#EF4444',
                          fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: kdResetId ? 1 : 0.4,
                        }}
                      >
                        Сбросить
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Support tab */}
        {tab === 'support' && (
          <div>
            {!openChatUserId ? (
              /* Chats list */
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
                  Обращения {supportUnread > 0 && <span style={{ color: '#E8092E' }}>· {supportUnread} новых</span>}
                </div>
                {supportChats.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#4B5563', fontSize: 13, padding: '40px 0' }}>
                    Нет обращений
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {supportChats.map(chat => (
                      <motion.div
                        key={chat.userId}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setOpenChatUserId(chat.userId); loadChat(chat.userId) }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                          background: chat.unread > 0 ? 'rgba(232,9,46,0.06)' : 'rgba(255,255,255,0.03)',
                          border: chat.unread > 0 ? '1px solid rgba(232,9,46,0.2)' : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div style={{
                          width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 16, overflow: 'hidden',
                        }}>
                          {chat.avatarUrl
                            ? <img src={chat.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : chat.displayName[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#F3F4F6' }}>{chat.displayName}</div>
                          <div style={{ fontSize: 12, color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {chat.lastMessage}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          {chat.lastAt && (
                            <div style={{ fontSize: 10, color: '#4B5563' }}>
                              {new Date(chat.lastAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                          {chat.unread > 0 && (
                            <div style={{
                              background: '#E8092E', color: '#fff', borderRadius: 20,
                              width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 11, fontWeight: 800,
                            }}>
                              {chat.unread}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Open chat */
              <div style={{ display: 'flex', flexDirection: 'column', height: '65vh' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <button
                    onClick={() => { setOpenChatUserId(null); loadSupportChats() }}
                    style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: 13, cursor: 'pointer', padding: 0 }}
                  >
                    ← Назад
                  </button>
                  <span style={{ fontWeight: 700, fontSize: 14, flex: 1 }}>
                    {supportChats.find(c => c.userId === openChatUserId)?.displayName}
                  </span>
                  <button
                    onClick={async () => {
                      await api.delete(`/support/admin/chats/${openChatUserId}`)
                      setChatMessages([])
                      setOpenChatUserId(null)
                      loadSupportChats()
                    }}
                    style={{
                      background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                      borderRadius: 8, padding: '5px 10px', color: '#EF4444',
                      fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    ✕ Закрыть
                  </button>
                </div>

                {/* Messages */}
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {chatMessages.map(msg => (
                    <div key={msg.id} style={{ display: 'flex', justifyContent: msg.isFromAdmin ? 'flex-end' : 'flex-start' }}>
                      <div style={{
                        maxWidth: '80%', padding: '9px 13px',
                        borderRadius: msg.isFromAdmin ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: msg.isFromAdmin ? 'rgba(232,9,46,0.2)' : 'rgba(255,255,255,0.07)',
                        border: msg.isFromAdmin ? '1px solid rgba(232,9,46,0.3)' : '1px solid rgba(255,255,255,0.08)',
                      }}>
                        {!msg.isFromAdmin && (
                          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', marginBottom: 3 }}>
                            Пользователь
                          </div>
                        )}
                        <div style={{ fontSize: 13, color: '#F3F4F6', lineHeight: 1.5, wordBreak: 'break-word' }}>{msg.text}</div>
                        <div style={{ fontSize: 10, color: '#6B7280', marginTop: 3, textAlign: 'right' }}>
                          {new Date(msg.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={chatBottomRef} />
                </div>

                {/* Reply input */}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') sendReply() }}
                    placeholder="Написать ответ..."
                    style={{
                      flex: 1, background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10, padding: '10px 14px',
                      color: '#F3F4F6', fontSize: 13, outline: 'none',
                    }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={!replyText.trim() || replySending}
                    style={{
                      background: replyText.trim() ? '#E8092E' : 'rgba(255,255,255,0.06)',
                      border: 'none', borderRadius: 10, padding: '10px 16px',
                      color: '#fff', fontSize: 13, fontWeight: 700,
                      cursor: replyText.trim() ? 'pointer' : 'default',
                      transition: 'background 0.2s',
                    }}
                  >
                    {replySending ? '...' : '➤'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Edit popover */}
      {editPopover && (
        <EditPopover
          label={editPopover.label}
          onSave={(val) => {
            if (editPopover.type === 'coins') saveCoins(editPopover.userId, val)
            else saveElo(editPopover.userId, val)
          }}
          onClose={() => setEditPopover(null)}
        />
      )}

      {/* Screenshot viewer */}
      {screenshot && <ScreenshotModal url={screenshot} onClose={() => setScreenshot(null)} />}
    </div>
  )
}
