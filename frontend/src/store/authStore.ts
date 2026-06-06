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
  xp: number
  level: number
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
  warns: number
  cooldownUntil: string | null
  isBanned: boolean
  banReason: string | null
  hideUsername: boolean
  discordUsername: string | null
  region: string | null
  regionUpdatedAt: string | null
  miniGamePlaysToday: number
  loginStreak: number
  isRegistered: boolean
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
