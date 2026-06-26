'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Logo } from '@/components/ui/Logo'
import { Icon } from '@/components/ui/Icon'

const ACCENT = '#E8092E'
const BOT_USERNAME = process.env.NEXT_PUBLIC_BOT_USERNAME

export default function WebLoginPage() {
  const router = useRouter()
  const { webLogin, hydrateFromToken } = useAuthStore()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => { setIsMobile(window.matchMedia('(max-width: 820px)').matches) }, [])
  useEffect(() => { hydrateFromToken().then((ok) => { if (ok) router.replace('/web') }) }, [])

  useEffect(() => {
    if (!BOT_USERNAME || isMobile === null) return
    ;(window as any).onTelegramAuth = async (tgUser: any) => {
      setBusy(true); setError('')
      try { const r = await api.post('/auth/telegram-widget', tgUser); await webLogin(r.data.access_token); router.push('/web') }
      catch (e: any) { setError(e?.response?.data?.message || 'Не удалось войти через Telegram'); setBusy(false) }
    }
    const holder = document.getElementById('tg-widget')
    if (!holder) return
    holder.innerHTML = ''
    const s = document.createElement('script')
    s.src = 'https://telegram.org/js/telegram-widget.js?22'
    s.async = true
    s.setAttribute('data-telegram-login', BOT_USERNAME)
    s.setAttribute('data-size', 'large')
    s.setAttribute('data-radius', '12')
    s.setAttribute('data-onauth', 'onTelegramAuth(user)')
    s.setAttribute('data-request-access', 'write')
    holder.appendChild(s)
  }, [isMobile])

  const redeem = async () => {
    const c = code.trim().toUpperCase()
    if (c.length < 4) { setError('Введите код из приложения'); return }
    setBusy(true); setError('')
    try { const r = await api.post('/auth/web/redeem', { code: c }); await webLogin(r.data.access_token); router.push('/web') }
    catch (e: any) { setError(e?.response?.data?.message || 'Неверный или истёкший код'); setBusy(false) }
  }

  // ── общая форма (код + кнопка + подсказка + виджет) ──
  const Form = (
    <>
      <div style={{ fontSize: 11, fontWeight: 800, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 9 }}>Код привязки</div>
      <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)); setError('') }}
        onKeyDown={(e) => { if (e.key === 'Enter') redeem() }} placeholder="ABC123" inputMode="text" autoCapitalize="characters"
        style={{ width: '100%', boxSizing: 'border-box', padding: '15px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.05)', border: `1px solid ${error ? '#EF4444' : 'rgba(255,255,255,0.1)'}`, color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: '0.34em', textAlign: 'center', outline: 'none', fontFamily: 'monospace' }} />
      {error && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 8, fontWeight: 600 }}>{error}</div>}
      <button onClick={redeem} disabled={busy}
        style={{ width: '100%', marginTop: 12, padding: '15px 0', borderRadius: 14, border: 'none', cursor: busy ? 'default' : 'pointer', fontSize: 15, fontWeight: 900, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #b8001e)`, boxShadow: `0 8px 26px ${ACCENT}44`, opacity: busy ? 0.6 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {busy ? 'Входим…' : <>Войти <Icon name="chevronRight" size={16} color="#fff" /></>}
      </button>
      <div style={{ marginTop: 14, padding: '11px 13px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#9CA3AF', lineHeight: 1.5, display: 'flex', gap: 9 }}>
        <Icon name="help" size={15} color="#6B7280" style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Открой приложение CONDR в Telegram → <b style={{ color: '#D1D5DB' }}>Профиль → Вход на сайт</b>, и введи код здесь.</span>
      </div>
      {BOT_USERNAME && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 14px' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} /><span style={{ fontSize: 11, color: '#4B5563', fontWeight: 700 }}>или</span><div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.08)' }} />
          </div>
          <div id="tg-widget" style={{ display: 'flex', justifyContent: 'center' }} />
        </>
      )}
    </>
  )

  // пока определяем ширину — короткий брендовый лоадер (без рывка вёрстки)
  if (isMobile === null) {
    return <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: ACCENT }} />
    </div>
  }

  // ── МОБИЛЬНАЯ ВЕРСИЯ ──
  if (isMobile) {
    return (
      <div style={{ minHeight: '100vh', background: '#060608', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 22px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'fixed', top: '8%', left: '50%', transform: 'translateX(-50%)', width: 460, height: 360, background: `radial-gradient(ellipse, ${ACCENT}14 0%, transparent 65%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 520, height: 280, background: 'radial-gradient(ellipse, rgba(168,85,247,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 240, damping: 22 }} style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <motion.div animate={{ filter: ['drop-shadow(0 0 14px rgba(232,9,46,0.4))', 'drop-shadow(0 0 40px rgba(232,9,46,0.85))', 'drop-shadow(0 0 14px rgba(232,9,46,0.4))'] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} style={{ width: 'fit-content', margin: '0 auto 16px' }}>
              <Logo size={88} color="#fff" />
            </motion.div>
            <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: '-1px', margin: 0 }}>CONDR</h1>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '6px 0 0', fontWeight: 600 }}>Faceit for Standoff 2</p>
          </div>

          <div style={{ background: 'linear-gradient(180deg, #101016, #0a0a0f)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 22, padding: 20, boxShadow: '0 16px 50px rgba(0,0,0,0.5)' }}>
            <div style={{ fontSize: 19, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 3 }}>Вход на сайт</div>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 18 }}>Тот же аккаунт, что и в приложении</div>
            {Form}
          </div>
        </motion.div>
      </div>
    )
  }

  // ── ДЕСКТОП ВЕРСИЯ (как было) ──
  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#070709', color: '#fff' }}>
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 56,
        background: `radial-gradient(120% 100% at 0% 0%, ${ACCENT}22, transparent 55%), radial-gradient(100% 100% at 100% 100%, rgba(168,85,247,0.14), transparent 55%), linear-gradient(160deg, #0c0c11, #08080b)` }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5, backgroundImage: 'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)', backgroundSize: '22px 22px', WebkitMaskImage: 'radial-gradient(120% 120% at 30% 30%, #000 20%, transparent 70%)', maskImage: 'radial-gradient(120% 120% at 30% 30%, #000 20%, transparent 70%)' }} />
        <motion.div initial={{ opacity: 0, scale: 0.9, rotate: -8 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          style={{ position: 'absolute', right: -60, top: '50%', transform: 'translateY(-50%)', opacity: 0.08, filter: `drop-shadow(0 0 40px ${ACCENT})` }}>
          <Logo size={460} color={ACCENT} />
        </motion.div>
        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
            <div style={{ filter: `drop-shadow(0 0 16px ${ACCENT}88)` }}><Logo size={52} color={ACCENT} /></div>
            <div>
              <div style={{ fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em' }}>CONDR Faceit</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.16em' }}>Standoff 2 · Matchmaking</div>
            </div>
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.05, maxWidth: 520, margin: 0 }}>
            Соревновательный матчмейкинг <span style={{ color: ACCENT }}>нового уровня</span>
          </h1>
          <p style={{ fontSize: 16, color: '#9CA3AF', maxWidth: 480, marginTop: 18, lineHeight: 1.6 }}>
            Один аккаунт — две платформы. Заходи с сайта и из приложения: лобби, матчи, рейтинг, кланы и отряды синхронизированы.
          </p>
        </div>
      </div>
      <div style={{ width: 460, maxWidth: '100%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, borderLeft: '1px solid rgba(255,255,255,0.06)' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} style={{ width: '100%', maxWidth: 360 }}>
          <div style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.02em' }}>Вход</div>
          <div style={{ fontSize: 13.5, color: '#6B7280', marginTop: 6, marginBottom: 24 }}>Войди тем же аккаунтом, что и в приложении</div>
          {Form}
        </motion.div>
      </div>
    </div>
  )
}
