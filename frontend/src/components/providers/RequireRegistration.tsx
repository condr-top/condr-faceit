'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { api } from '@/lib/api'

function BannedScreen({ reason }: { reason: string | null }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0a',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
      <h1 style={{
        fontSize: 24, fontWeight: 900, color: '#EF4444',
        marginBottom: 8, letterSpacing: '-0.5px',
      }}>
        Аккаунт заблокирован
      </h1>
      <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 20, maxWidth: 280 }}>
        Ваш аккаунт был заблокирован администратором.
      </p>
      {reason && (
        <div style={{
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.25)',
          borderRadius: 12,
          padding: '14px 20px',
          maxWidth: 300,
          width: '100%',
        }}>
          <div style={{ fontSize: 11, color: '#EF4444', fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Причина
          </div>
          <div style={{ fontSize: 14, color: '#fff', fontWeight: 500 }}>
            {reason}
          </div>
        </div>
      )}
      <p style={{ fontSize: 12, color: '#374151', marginTop: 24 }}>
        Если вы считаете это ошибкой — свяжитесь с администратором
      </p>
    </div>
  )
}

export function RequireRegistration({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, isLoading } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (isLoading) return
    if (!isAuthenticated) {
      router.replace('/auth')
      return
    }
    if (user && !user.isRegistered) {
      router.replace('/register')
      return
    }
    // If already on a match page — don't redirect
    if (pathname.startsWith('/match/')) return

    // On app open: redirect back to active match if player is in one
    if (user?.isRegistered) {
      api.get('/matches/my-active').then((r) => {
        if (r.data?.matchId) {
          router.replace(`/match/${r.data.matchId}`)
        }
      }).catch(() => {})
    }
  }, [isLoading, isAuthenticated, user])

  if (isLoading) return <LoadingScreen />
  if (!isAuthenticated) return <LoadingScreen />
  if (user && !user.isRegistered) return <LoadingScreen />

  // Show ban screen instead of page content
  if (user?.isBanned) return <BannedScreen reason={user.banReason} />

  return <>{children}</>
}
