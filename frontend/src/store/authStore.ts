import { create } from 'zustand'
import { api } from '@/lib/api'

interface UserProfile {
  id: number
  telegramId: number
  username: string | null
  firstName: string
  lastName: string | null
  avatarUrl: string | null
  displayName: string
  elo: number
  coins: number
  matchesPlayed: number
  matchesWon: number
  matchesLost: number
  kdr: number
  winRate: number
  killsTotal: number
  deathsTotal: number
  assistsTotal: number
  ratingSum: number
  avgKills: number
  ratingOverall: number
  isPremium: boolean
  isAdmin: boolean
  isModerator: boolean
  isVerified: boolean
  isDmHost?: boolean
  cplAccess?: boolean
  cplqAccess?: boolean
  cplqDanger?: boolean
  warns: number
  cooldownUntil: string | null
  isBanned: boolean
  banReason: string | null
  hideUsername: boolean
  discordUsername: string | null
  region: string | null
  regionUpdatedAt: string | null
  miniGamePlaysToday: number
  isRegistered: boolean
  inviteRedeemed: boolean
  gameNickname: string | null
  gameId: string | null
  nicknameChangesUsed: number
  freeNicknameChangeAvailable: boolean
}

interface AuthState {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (initData: string | null, devTelegramId?: number) => Promise<void>
  webLogin: (accessToken: string) => Promise<any>
  hydrateFromToken: () => Promise<boolean>
  logout: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (initData, devTelegramId) => {
    set({ isLoading: true })
    try {
      let res
      if (devTelegramId) {
        res = await api.post('/auth/dev', { telegramId: devTelegramId })
      } else {
        res = await api.post('/auth/telegram', { initData })
      }

      const { access_token } = res.data
      localStorage.setItem('condr_faceit_token', access_token)

      const profileRes = await api.get('/users/me', {
        headers: { Authorization: `Bearer ${access_token}` },
      })

      set({ user: profileRes.data, isAuthenticated: true, isLoading: false })
      return profileRes.data
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  // Веб-вход: получили JWT (через код привязки или Telegram-виджет) → грузим профиль.
  webLogin: async (accessToken: string) => {
    set({ isLoading: true })
    try {
      localStorage.setItem('condr_faceit_token', accessToken)
      const profileRes = await api.get('/users/me', { headers: { Authorization: `Bearer ${accessToken}` } })
      set({ user: profileRes.data, isAuthenticated: true, isLoading: false })
      return profileRes.data
    } catch (err) {
      set({ isLoading: false })
      throw err
    }
  },

  // Сайт: восстановить сессию из сохранённого токена (без Telegram).
  hydrateFromToken: async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('condr_faceit_token') : null
    if (!token) { set({ isLoading: false }); return false }
    try {
      const res = await api.get('/users/me')
      set({ user: res.data, isAuthenticated: true, isLoading: false })
      return true
    } catch {
      localStorage.removeItem('condr_faceit_token')
      set({ user: null, isAuthenticated: false, isLoading: false })
      return false
    }
  },

  logout: () => {
    localStorage.removeItem('condr_faceit_token')
    set({ user: null, isAuthenticated: false, isLoading: false })
  },

  refreshUser: async () => {
    try {
      const res = await api.get('/users/me')
      set({ user: res.data })
    } catch {}
  },
}))

// No auto-init from localStorage — always re-auth via Telegram initData on open
if (typeof window !== 'undefined') {
  useAuthStore.setState({ isLoading: false })
}
