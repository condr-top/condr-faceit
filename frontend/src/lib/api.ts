import axios from 'axios'

// Use relative /api path so Next.js proxy handles it (avoids mixed content https→http)
const BASE_URL = typeof window !== 'undefined' ? '/api' : (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000')

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('condr_faceit_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('condr_faceit_token')
      import('@/store/authStore').then(({ useAuthStore }) => {
        useAuthStore.getState().logout()
      })
    }
    return Promise.reject(err)
  },
)
