import { create } from 'zustand'
import { api } from '@/lib/api'

interface Match {
  id: number
  status: string
  teamAIds: number[]
  teamBIds: number[]
  hostId: number
  captainAId: number | null
  captainBId: number | null
  teamASide: string | null
  map: string | null
  availableMaps: string[]
  vetoTurn: string | null
  readyPlayers: number[]
  readyCheckExpires: string | null
  scoreA: number
  scoreB: number
  winnerTeam: string | null
  lobbyLink: string | null
  lobbyJoinedPlayers: number[]
  lobbyLinkPublishedAt: string | null
  voiceInviteT: string | null
  voiceInviteCT: string | null
  startedAt: string | null
  resultScreenshotA: string | null
  resultScreenshotB: string | null
  firstResultAt: string | null
  scoreAByCapA: number | null
  scoreBByCapA: number | null
  scoreAByCapB: number | null
  scoreBByCapB: number | null
  isDisputed: boolean
}

interface MatchState {
  currentMatch: Match | null
  fetchMatch: (id: number) => Promise<void>
  setMatch: (match: Match) => void
  clearMatch: () => void
}

export const useMatchStore = create<MatchState>((set) => ({
  currentMatch: null,

  fetchMatch: async (id) => {
    const res = await api.get(`/matches/${id}`)
    set({ currentMatch: res.data })
  },

  setMatch: (match) => set({ currentMatch: match }),
  clearMatch: () => set({ currentMatch: null }),
}))
