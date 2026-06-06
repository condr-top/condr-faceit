import { create } from 'zustand'
import { api } from '@/lib/api'

interface QueueState {
  inQueue: boolean
  queueSize: number
  joinQueue: () => Promise<void>
  leaveQueue: () => Promise<void>
  fetchStatus: () => Promise<void>
}

export const useQueueStore = create<QueueState>((set) => ({
  inQueue: false,
  queueSize: 0,

  joinQueue: async () => {
    const res = await api.post('/queue/join')
    set({ inQueue: true, queueSize: res.data.queueSize })
  },

  leaveQueue: async () => {
    await api.delete('/queue/leave')
    set({ inQueue: false })
  },

  fetchStatus: async () => {
    const res = await api.get('/queue/status')
    set({ inQueue: res.data.inQueue, queueSize: res.data.queueSize })
  },
}))
