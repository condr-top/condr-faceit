'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { REGIONS } from '@/lib/regions'
import { Flag } from '@/components/ui/Flag'
import { Icon, IconName } from '@/components/ui/Icon'

const ACCENT = '#E8092E'

const SERIAL_GUIDE: { os: string; icon: IconName; color: string; steps: string[] }[] = [
  { os: 'Android', icon: 'gamepad', color: '#22C55E', steps: ['Настройки → «О телефоне» / «Об устройстве»', 'Открой «Состояние» или «Сведения об устройстве»', 'Найди строку «Серийный номер»', 'Или набери в звонилке *#06# — там тоже есть серийник/IMEI'] },
  { os: 'iPhone (iOS)', icon: 'phone', color: '#60A5FA', steps: ['Настройки → «Основные»', '«Об этом устройстве»', 'Прокрути до строки «Серийный номер»', 'Долгое нажатие — чтобы скопировать'] },
]

export default function RegisterPage() {
  const router = useRouter()
  const { refreshUser, user } = useAuthStore()
  const [step, setStep] = useState<'code' | 'profile'>(user?.inviteRedeemed ? 'profile' : 'code')

  // step 1
  const [invite, setInvite] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')

  // step 2
  const [form, setForm] = useState({ gameNickname: user?.gameNickname || '', gameId: user?.gameId || '', deviceSerial: '' })
  const [region, setRegion] = useState(user?.region || '')
  const [discord, setDiscord] = useState('')
  const [showGuide, setShowGuide] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState<string | null>(null)

  const handleRedeem = async () => {
    const code = invite.trim().toUpperCase()
    if (code.length !== 5) { setInviteError('Код состоит из 5 символов'); return }
    setInviteLoading(true); setInviteError('')
    try { await api.post('/users/invite/redeem', { code }); await refreshUser(); setStep('profile') }
    catch (e: any) { setInviteError(e?.response?.data?.message || 'Неверный пригласительный код') }
    finally { setInviteLoading(false) }
  }

  const handleSubmit = async () => {
    if (!form.gameNickname.trim() || !form.gameId.trim() || !form.deviceSerial.trim()) { setError('Заполни никнейм, ID и серийный номер'); return }
    if (!region) { setError('Выбери регион'); return }
    setLoading(true); setError('')
    try {
      await api.post('/users/register', { ...form, region })
      if (discord.trim()) { try { await api.post('/users/discord', { discordUsername: discord.trim() }) } catch {} }
      await refreshUser()
      router.replace('/dashboard')
    } catch (e: any) { setError(e?.response?.data?.message || 'Ошибка регистрации'); setLoading(false) }
  }

  const inputStyle = (name: string) => ({
    width: '100%', boxSizing: 'border-box' as const,
    background: focused === name ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.05)',
    border: focused === name ? '1px solid rgba(232,9,46,0.5)' : '1px solid rgba(255,255,255,0.09)',
    borderRadius: 12, padding: '13px 16px', color: '#fff', fontSize: 14, outline: 'none',
    transition: 'border 0.2s, background 0.2s', boxShadow: focused === name ? '0 0 0 2px rgba(232,9,46,0.12)' : 'none',
  })
  const Lbl = ({ children }: { children: React.ReactNode }) => <label style={{ display: 'block', fontSize: 11, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>{children}</label>

  return (
    <div style={{ minHeight: '100vh', background: '#060608', display: 'flex', flexDirection: 'column', justifyContent: step === 'code' ? 'center' : 'flex-start', padding: step === 'code' ? '0 20px' : '34px 20px 60px' }}>
      <div style={{ position: 'fixed', top: '26%', left: '50%', transform: 'translate(-50%, -50%)', width: 420, height: 420, background: 'radial-gradient(ellipse, rgba(232,9,46,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }} style={{ maxWidth: 420, margin: '0 auto', width: '100%', position: 'relative', zIndex: 1 }}>
        {/* header */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, margin: '0 auto 14px', background: 'linear-gradient(135deg, rgba(232,9,46,0.2), rgba(180,0,30,0.25))', border: '1px solid rgba(232,9,46,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(232,9,46,0.2)' }}>
            <span style={{ fontSize: 26, fontWeight: 900, color: ACCENT }}>C</span>
          </div>
          <h1 style={{ fontSize: 23, fontWeight: 900, color: '#fff', margin: '0 0 6px', letterSpacing: '-0.5px' }}>{step === 'code' ? 'Закрытый тест' : 'Регистрация'}</h1>
          <p style={{ color: '#4B5563', fontSize: 13, margin: 0 }}>{step === 'code' ? 'Введи пригласительный код для входа' : 'Заполни профиль, чтобы начать играть'}</p>
        </div>

        {/* step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 22 }}>
          {(['code', 'profile'] as const).map((s, i) => {
            const active = step === s, done = step === 'profile' && s === 'code'
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900, background: active || done ? 'linear-gradient(135deg, #E8092E, #b4001e)' : 'rgba(255,255,255,0.06)', color: active || done ? '#fff' : '#4B5563', border: active || done ? 'none' : '1px solid rgba(255,255,255,0.1)', transition: 'all .25s' }}>{done ? '✓' : i + 1}</div>
                {i === 0 && <div style={{ width: 28, height: 2, borderRadius: 1, background: step === 'profile' ? ACCENT : 'rgba(255,255,255,0.1)' }} />}
              </div>
            )
          })}
        </div>

        <AnimatePresence mode="wait">
          {step === 'code' ? (
            <motion.div key="code" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }}>
              <label style={{ display: 'block', fontSize: 11, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, textAlign: 'center' }}>Пригласительный код</label>
              <input value={invite} onChange={(e) => { setInvite(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)); setInviteError('') }} onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem() }} placeholder="•••••" maxLength={5} autoFocus
                style={{ width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.05)', border: inviteError ? '1px solid rgba(232,9,46,0.6)' : '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '18px 0', marginBottom: 8, color: '#fff', fontSize: 34, fontWeight: 900, textAlign: 'center', letterSpacing: '0.5em', textIndent: '0.5em', fontFamily: 'ui-monospace, monospace', outline: 'none' }} />
              <p style={{ fontSize: 11, color: '#374151', marginTop: 0, marginBottom: 18, textAlign: 'center' }}>Код выдаёт администратор · обновляется раз в минуту</p>
              {inviteError && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'rgba(232,9,46,0.08)', border: '1px solid rgba(232,9,46,0.3)', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#F87171', textAlign: 'center', marginBottom: 16 }}>{inviteError}</motion.div>}
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleRedeem} disabled={inviteLoading || invite.length !== 5}
                style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', cursor: inviteLoading || invite.length !== 5 ? 'default' : 'pointer', background: inviteLoading || invite.length !== 5 ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, rgba(232,9,46,0.95), rgba(180,0,30,1))', color: inviteLoading || invite.length !== 5 ? '#4B5563' : '#fff', fontWeight: 900, fontSize: 15, letterSpacing: '0.02em', boxShadow: inviteLoading || invite.length !== 5 ? 'none' : '0 4px 24px rgba(232,9,46,0.35)' }}>{inviteLoading ? 'Проверяем...' : 'Далее'}</motion.button>
            </motion.div>
          ) : (
            <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ type: 'spring', stiffness: 300, damping: 26 }} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* nickname */}
              <div><Lbl>Игровой никнейм</Lbl><input value={form.gameNickname} onChange={(e) => setForm({ ...form, gameNickname: e.target.value })} placeholder="Твой ник в Standoff 2" style={inputStyle('nick')} onFocus={() => setFocused('nick')} onBlur={() => setFocused(null)} /></div>
              {/* game id */}
              <div><Lbl>Игровой ID</Lbl><input value={form.gameId} onChange={(e) => setForm({ ...form, gameId: e.target.value })} placeholder="ID из профиля Standoff 2" style={inputStyle('gid')} onFocus={() => setFocused('gid')} onBlur={() => setFocused(null)} /></div>

              {/* serial + guide */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
                  <Lbl>Серийный номер устройства</Lbl>
                  <button onClick={() => setShowGuide(v => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: '#60A5FA', fontSize: 11, fontWeight: 700, padding: 0 }}><Icon name="help" size={13} color="#60A5FA" />Как найти?</button>
                </div>
                <input value={form.deviceSerial} onChange={(e) => setForm({ ...form, deviceSerial: e.target.value })} placeholder="Серийник БЕЗ последних 2 символов" style={inputStyle('ser')} onFocus={() => setFocused('ser')} onBlur={() => setFocused(null)} />
                <p style={{ fontSize: 11, color: '#6B7280', marginTop: 6, marginBottom: 0, display: 'flex', alignItems: 'center', gap: 5 }}><Icon name="shield" size={12} color="#6B7280" />Вводи <b style={{ color: '#9CA3AF' }}>без последних 2 символов</b> — для приватности при той же защите от мультиаккаунтов</p>
                <AnimatePresence>
                  {showGuide && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {SERIAL_GUIDE.map(g => (
                          <div key={g.os} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${g.color}26`, borderRadius: 14, padding: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
                              <div style={{ width: 30, height: 30, borderRadius: 9, background: `${g.color}18`, border: `1px solid ${g.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={g.icon} size={16} color={g.color} /></div>
                              <span style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>{g.os}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {g.steps.map((s, i) => (
                                <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                                  <span style={{ flexShrink: 0, width: 18, height: 18, borderRadius: '50%', background: `${g.color}1f`, color: g.color, fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{i + 1}</span>
                                  <span style={{ fontSize: 12.5, color: '#9CA3AF', lineHeight: 1.4 }}>{s}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* region (required) */}
              <div>
                <Lbl>Регион <span style={{ color: ACCENT }}>*</span></Lbl>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, maxHeight: 188, overflowY: 'auto', padding: 2 }}>
                  {REGIONS.map(r => {
                    const sel = region === r.code
                    return (
                      <button key={r.code} onClick={() => setRegion(r.code)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', borderRadius: 12, cursor: 'pointer', textAlign: 'left', background: sel ? 'rgba(232,9,46,0.16)' : 'rgba(255,255,255,0.04)', border: `1px solid ${sel ? ACCENT : 'rgba(255,255,255,0.07)'}`, transition: 'all .15s' }}>
                        <Flag code={r.code} size={18} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: sel ? '#fff' : '#9CA3AF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                        {sel && <Icon name="check" size={13} color={ACCENT} style={{ marginLeft: 'auto' }} />}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* discord (optional) */}
              <div>
                <Lbl>Discord <span style={{ color: '#4B5563', textTransform: 'none', letterSpacing: 0 }}>· необязательно</span></Lbl>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#5865F2', display: 'flex' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.74 19.74 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                  </span>
                  <input value={discord} onChange={(e) => setDiscord(e.target.value.replace(/^@/, ''))} placeholder="username (для голосовых каналов)" style={{ ...inputStyle('dis'), paddingLeft: 42 }} onFocus={() => setFocused('dis')} onBlur={() => setFocused(null)} />
                </div>
                <p style={{ fontSize: 11, color: '#6B7280', marginTop: 6, marginBottom: 0 }}>Нужен для входа в голосовой чат матча. Можно привязать позже в профиле.</p>
              </div>

              {error && <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} style={{ background: 'rgba(232,9,46,0.08)', border: '1px solid rgba(232,9,46,0.3)', borderRadius: 12, padding: '10px 16px', fontSize: 13, color: '#F87171', textAlign: 'center' }}>{error}</motion.div>}

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleSubmit} disabled={loading}
                style={{ width: '100%', padding: '15px 0', borderRadius: 14, border: 'none', cursor: loading ? 'default' : 'pointer', background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, rgba(232,9,46,0.95), rgba(180,0,30,1))', color: loading ? '#4B5563' : '#fff', fontWeight: 900, fontSize: 15, boxShadow: loading ? 'none' : '0 4px 24px rgba(232,9,46,0.35)', letterSpacing: '0.02em', position: 'relative', overflow: 'hidden' }}>
                {!loading && <motion.div animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2 }} style={{ position: 'absolute', top: 0, bottom: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', pointerEvents: 'none' }} />}
                {loading ? 'Регистрация...' : 'Завершить регистрацию'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
