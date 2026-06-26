'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

type Variant = 'dashboard' | 'profile' | 'leaderboard' | 'friends' | 'shop' | 'history' | 'missions' | 'support' | 'match' | 'default'

function getVariant(pathname: string): Variant {
  if (pathname.startsWith('/dashboard'))  return 'dashboard'
  if (pathname.startsWith('/profile'))    return 'profile'
  if (pathname.startsWith('/leaderboard')) return 'leaderboard'
  if (pathname.startsWith('/friends'))    return 'friends'
  if (pathname.startsWith('/shop'))       return 'shop'
  if (pathname.startsWith('/history'))    return 'history'
  if (pathname.startsWith('/missions'))   return 'missions'
  if (pathname.startsWith('/support'))    return 'support'
  if (pathname.startsWith('/match'))      return 'match'
  return 'default'
}

const VARIANTS: Record<Variant, {
  colors: string[]
  glowTop: string
  glowBottom: string
  count: number
  lineColor: string
  speed: number
}> = {
  dashboard: {
    colors: ['#E8092E', '#ff2d55', '#b4001e', '#ff6b81'],
    glowTop: 'rgba(232,9,46,0.13)',
    glowBottom: 'rgba(232,9,46,0.05)',
    lineColor: '232,9,46',
    count: 50, speed: 0.35,
  },
  profile: {
    colors: ['#A855F7', '#8B5CF6', '#6366f1', '#ec4899'],
    glowTop: 'rgba(168,85,247,0.13)',
    glowBottom: 'rgba(99,102,241,0.07)',
    lineColor: '168,85,247',
    count: 45, speed: 0.3,
  },
  leaderboard: {
    colors: ['#F59E0B', '#EAB308', '#FBBF24', '#F97316'],
    glowTop: 'rgba(245,158,11,0.12)',
    glowBottom: 'rgba(234,179,8,0.05)',
    lineColor: '245,158,11',
    count: 40, speed: 0.35,
  },
  friends: {
    colors: ['#22C55E', '#10B981', '#34D399', '#6EE7B7'],
    glowTop: 'rgba(34,197,94,0.10)',
    glowBottom: 'rgba(16,185,129,0.05)',
    lineColor: '34,197,94',
    count: 50, speed: 0.25,
  },
  shop: {
    colors: ['#EAB308', '#F59E0B', '#FBBF24', '#E8092E'],
    glowTop: 'rgba(234,179,8,0.12)',
    glowBottom: 'rgba(232,9,46,0.05)',
    lineColor: '234,179,8',
    count: 60, speed: 0.45,
  },
  history: {
    colors: ['#60A5FA', '#3B82F6', '#22C55E', '#E8092E'],
    glowTop: 'rgba(96,165,250,0.10)',
    glowBottom: 'rgba(59,130,246,0.05)',
    lineColor: '96,165,250',
    count: 35, speed: 0.3,
  },
  missions: {
    colors: ['#22C55E', '#10B981', '#F59E0B', '#E8092E'],
    glowTop: 'rgba(34,197,94,0.10)',
    glowBottom: 'rgba(245,158,11,0.05)',
    lineColor: '34,197,94',
    count: 40, speed: 0.3,
  },
  support: {
    colors: ['#60A5FA', '#818CF8', '#A78BFA', '#C084FC'],
    glowTop: 'rgba(96,165,250,0.09)',
    glowBottom: 'rgba(167,139,250,0.05)',
    lineColor: '96,165,250',
    count: 30, speed: 0.2,
  },
  match: {
    colors: ['#E8092E', '#F97316', '#EAB308', '#ff2d55'],
    glowTop: 'rgba(232,9,46,0.14)',
    glowBottom: 'rgba(249,115,22,0.06)',
    lineColor: '232,9,46',
    count: 50, speed: 0.5,
  },
  default: {
    colors: ['#6366f1', '#A855F7', '#E8092E', '#3B82F6'],
    glowTop: 'rgba(99,102,241,0.10)',
    glowBottom: 'rgba(168,85,247,0.05)',
    lineColor: '99,102,241',
    count: 40, speed: 0.3,
  },
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pathname = usePathname()
  const variant = getVariant(pathname)
  const cfg = VARIANTS[variant]

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)

    const count = cfg.count

    type P = { x: number; y: number; vx: number; vy: number; size: number; alpha: number; color: string }
    const particles: P[] = Array.from({ length: count }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * cfg.speed,
      vy: (Math.random() - 0.5) * cfg.speed,
      size: Math.random() * 1.8 + 0.4,
      alpha: Math.random() * 0.5 + 0.1,
      color: cfg.colors[Math.floor(Math.random() * cfg.colors.length)],
    }))

    let raf = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < particles.length; i++) {
        const pi = particles[i]
        for (let j = i + 1; j < particles.length; j++) {
          const pj = particles[j]
          const dx = pi.x - pj.x, dy = pi.y - pj.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            ctx.beginPath()
            ctx.moveTo(pi.x, pi.y)
            ctx.lineTo(pj.x, pj.y)
            ctx.strokeStyle = `rgba(${cfg.lineColor},${(0.07 * (1 - dist / 120)).toFixed(3)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }
      for (const p of particles) {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0')
        ctx.fill()
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      }
      raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [variant])

  return (
    <>
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: 0.55 }} />
      <div style={{
        position: 'fixed', top: -140, left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 340,
        background: `radial-gradient(ellipse, ${cfg.glowTop} 0%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: -60, right: -60, width: 300, height: 300,
        background: `radial-gradient(ellipse, ${cfg.glowBottom} 0%, transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }} />
    </>
  )
}
