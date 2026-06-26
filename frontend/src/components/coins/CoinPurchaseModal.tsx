'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useSpring, useMotionValue } from 'framer-motion'
import { useSheetDrag } from '@/lib/useSheetDrag'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { useUiStore } from '@/store/uiStore'
import { Icon } from '@/components/ui/Icon'

type Step = 'amount' | 'payment' | 'pending' | 'confirmed' | 'rejected'

interface Props { onClose: () => void }

const CARD_NUMBER = '2200 7012 3291 6152'
const RATE = 10
const BANKS = ['Сбербанк', 'Тинькофф', 'ВТБ', 'Альфа-Банк', 'Газпромбанк', 'Открытие', 'Другой']

const PACKAGES = [
  { rubles: 50,   label: '500',    tag: null,       color: '#60A5FA', bg: 'rgba(96,165,250,0.07)'  },
  { rubles: 100,  label: '1 000',  tag: 'СТАРТ',    color: '#22C55E', bg: 'rgba(34,197,94,0.07)'   },
  { rubles: 300,  label: '3 000',  tag: 'ВЫГОДНО',  color: '#F59E0B', bg: 'rgba(245,158,11,0.07)'  },
  { rubles: 500,  label: '5 000',  tag: 'ХИТ',     color: '#E8092E', bg: 'rgba(232,9,46,0.09)'    },
  { rubles: 1000, label: '10 000', tag: 'МАКС',     color: '#A855F7', bg: 'rgba(168,85,247,0.07)'  },
  { rubles: 2000, label: '20 000', tag: 'VIP',      color: '#EAB308', bg: 'rgba(234,179,8,0.07)'   },
]

function AnimNum({ value, delay = 0 }: { value: number; delay?: number }) {
  const mv = useMotionValue(0)
  const sp = useSpring(mv, { duration: 900, bounce: 0 })
  const [d, setD] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => mv.set(value), delay * 1000)
    return () => clearTimeout(t)
  }, [value])
  useEffect(() => sp.on('change', v => setD(Math.round(v))), [sp])
  return <>{d.toLocaleString()}</>
}

function ChipSVG() {
  return (
    <svg width="38" height="30" viewBox="0 0 38 30" fill="none">
      <rect x="1" y="1" width="36" height="28" rx="5" fill="rgba(234,179,8,0.12)" stroke="rgba(234,179,8,0.45)" strokeWidth="1.2"/>
      <rect x="13" y="1" width="12" height="28" fill="none" stroke="rgba(234,179,8,0.25)" strokeWidth="1"/>
      <rect x="1" y="10" width="36" height="10" fill="none" stroke="rgba(234,179,8,0.25)" strokeWidth="1"/>
      <circle cx="19" cy="15" r="4.5" fill="rgba(234,179,8,0.18)" stroke="rgba(234,179,8,0.55)" strokeWidth="1.2"/>
    </svg>
  )
}

function CoinBurst() {
  const count = 12
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2
        const dist = 62 + (i % 3) * 22
        return (
          <div key={i} style={{ position: 'absolute', left: '50%', top: '50%', marginLeft: -12, marginTop: -12 }}>
            <motion.div
              initial={{ opacity: 1, scale: 0, x: 0, y: 0 }}
              animate={{
                opacity: [1, 1, 0],
                scale: [0, 1.3, 0.9],
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
              }}
              transition={{ duration: 0.85, delay: i * 0.045, ease: [0.2, 0.8, 0.4, 1] }}
              style={{ lineHeight: 1, color: '#EAB308' }}
            ><Icon name="coins" size={20} /></motion.div>
          </div>
        )
      })}
    </div>
  )
}

export function CoinPurchaseModal({ onClose }: Props) {
  const sheet = useSheetDrag(onClose)
  const { refreshUser } = useAuthStore()
  const { setHideNav } = useUiStore()
  const [step, setStep] = useState<Step>('amount')
  const [selectedPkg, setSelectedPkg] = useState<number | null>(null)
  const [customRubles, setCustomRubles] = useState('')
  const [payerName, setPayerName] = useState('')
  const [bank, setBank] = useState('')
  const [customBank, setCustomBank] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [purchaseId, setPurchaseId] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [showBurst, setShowBurst] = useState(false)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const rubles = selectedPkg !== null ? PACKAGES[selectedPkg].rubles : (Number(customRubles) || 0)
  const coins = rubles * RATE
  const effectiveBank = bank === 'Другой' ? customBank : bank
  const stepNum = step === 'amount' ? 0 : step === 'payment' ? 1 : 2
  const isAmountReady = rubles >= 10 && rubles <= 10000

  useEffect(() => { setHideNav(true); return () => setHideNav(false) }, [])
  useEffect(() => { return () => { if (pollRef.current) clearInterval(pollRef.current) } }, [])

  const startPolling = (id: number) => {
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/coins/purchase/${id}/status`)
        if (res.data.status === 'confirmed') {
          clearInterval(pollRef.current!)
          await refreshUser()
          setShowBurst(true)
          setStep('confirmed')
        } else if (res.data.status === 'rejected') {
          clearInterval(pollRef.current!)
          setStep('rejected')
        }
      } catch {}
    }, 5000)
  }

  const handleAmountNext = () => {
    if (!rubles || rubles < 10) { setError('Минимальная сумма — 10 ₽'); return }
    if (rubles > 10000) { setError('Максимальная сумма — 10 000 ₽'); return }
    setError(''); setStep('payment')
  }

  const handlePaid = async () => {
    if (!payerName.trim()) { setError('Введите имя плательщика'); return }
    if (!effectiveBank.trim()) { setError('Выберите или введите банк'); return }
    setError(''); setLoading(true)
    try {
      const res = await api.post('/coins/purchase', { rubles, payerName: payerName.trim(), bank: effectiveBank.trim() })
      setPurchaseId(res.data.purchaseId)
      setStep('pending')
      startPolling(res.data.purchaseId)
    } catch (e: any) {
      setError(e.response?.data?.message || 'Ошибка при создании заявки')
    } finally {
      setLoading(false)
    }
  }

  const copyCard = () => {
    navigator.clipboard.writeText(CARD_NUMBER.replace(/\s/g, '')).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          {...sheet.panelProps}
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 32, stiffness: 360 }}
          style={{
            width: '100%', maxWidth: 480,
            maxHeight: '92vh', overflowY: 'auto',
            borderRadius: '28px 28px 0 0',
            background: 'rgba(9,9,13,0.99)',
            backdropFilter: 'blur(48px) saturate(200%)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderBottom: 'none',
            boxShadow: '0 -4px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)',
            position: 'relative',
          }}
        >
          {/* Top specular light */}
          <div style={{
            position: 'absolute', top: 0, left: '15%', right: '15%', height: 1, zIndex: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)',
            borderRadius: 1, pointerEvents: 'none',
          }} />

          <div style={{ padding: '16px 20px 44px' }}>
            {/* Handle */}
            <div {...sheet.handleProps} style={{ ...sheet.handleProps.style, padding: '2px 0 20px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }} />
            </div>

            {/* Step progress (only on amount + payment) */}
            {(step === 'amount' || step === 'payment') && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 26 }}>
                {['Сумма', 'Оплата', 'Готово'].map((label, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <motion.div
                        animate={{
                          background: i < stepNum ? '#22C55E' : i === stepNum ? '#E8092E' : 'rgba(255,255,255,0.08)',
                          boxShadow: i === stepNum ? '0 0 14px rgba(232,9,46,0.55)' : 'none',
                        }}
                        transition={{ duration: 0.3 }}
                        style={{ width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        {i < stepNum ? (
                          <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                            <path d="M2.5 6.5L5.5 9.5L10.5 3.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        ) : (
                          <span style={{ fontSize: 11, fontWeight: 900, color: i === stepNum ? '#fff' : 'rgba(255,255,255,0.25)' }}>{i + 1}</span>
                        )}
                      </motion.div>
                      <span style={{ fontSize: 8, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: i === stepNum ? '#E8092E' : i < stepNum ? '#22C55E' : 'rgba(255,255,255,0.18)' }}>
                        {label}
                      </span>
                    </div>
                    {i < 2 && (
                      <motion.div
                        animate={{ background: i < stepNum ? '#22C55E' : 'rgba(255,255,255,0.07)' }}
                        transition={{ duration: 0.4 }}
                        style={{ width: 44, height: 1.5, borderRadius: 1, marginBottom: 14, marginLeft: 4, marginRight: 4 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            <AnimatePresence mode="wait">

              {/* ─────────────── AMOUNT ─────────────── */}
              {step === 'amount' && (
                <motion.div key="amount" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>

                  {/* Hero */}
                  <div style={{ textAlign: 'center', marginBottom: 22 }}>
                    <motion.div
                      animate={{
                        filter: ['drop-shadow(0 0 10px rgba(234,179,8,0.35))', 'drop-shadow(0 0 24px rgba(234,179,8,0.75))', 'drop-shadow(0 0 10px rgba(234,179,8,0.35))'],
                        scale: [1, 1.06, 1],
                      }}
                      transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ display: 'inline-flex', marginBottom: 10, color: '#EAB308' }}
                    ><Icon name="coins" size={52} strokeWidth={1.6} /></motion.div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginBottom: 6 }}>CONDR Coins</div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.22)', borderRadius: 20, padding: '5px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#EAB308', letterSpacing: '0.03em' }}>1 ₽ = 10 монет</span>
                    </div>
                  </div>

                  {/* Package grid 3×2 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 18 }}>
                    {PACKAGES.map((pkg, i) => {
                      const sel = selectedPkg === i
                      return (
                        <motion.button
                          key={i}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => { setSelectedPkg(i); setCustomRubles(''); setError('') }}
                          style={{
                            position: 'relative', borderRadius: 16, padding: '13px 8px 11px',
                            background: sel ? pkg.bg.replace('0.07', '0.16').replace('0.09', '0.18') : pkg.bg,
                            border: `1px solid ${sel ? pkg.color + '55' : pkg.color + '18'}`,
                            cursor: 'pointer', textAlign: 'center', overflow: 'hidden',
                            boxShadow: sel ? `0 0 18px ${pkg.color}28` : 'none',
                            transition: 'all 0.18s',
                          }}
                        >
                          {/* Top glow strip */}
                          <motion.div
                            animate={{ opacity: sel ? 1 : 0 }}
                            style={{ position: 'absolute', top: 0, left: '8%', right: '8%', height: 1, background: `linear-gradient(90deg, transparent, ${pkg.color}, transparent)` }}
                          />
                          {/* Tag */}
                          {pkg.tag && (
                            <div style={{
                              position: 'absolute', top: 5, right: 5,
                              fontSize: 6.5, fontWeight: 900, padding: '1.5px 5px', borderRadius: 5,
                              background: sel ? pkg.color : `${pkg.color}20`,
                              color: sel ? '#000' : pkg.color, letterSpacing: '0.04em',
                              whiteSpace: 'nowrap',
                            }}>{pkg.tag}</div>
                          )}
                          <div style={{ marginBottom: 4, color: '#EAB308', display: 'flex', justifyContent: 'center' }}><Icon name="coins" size={22} /></div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: sel ? pkg.color : '#fff', letterSpacing: '-0.3px', lineHeight: 1 }}>{pkg.label}</div>
                          <div style={{ fontSize: 10, color: sel ? `${pkg.color}99` : 'rgba(255,255,255,0.28)', fontWeight: 600, marginTop: 3 }}>{pkg.rubles} ₽</div>
                        </motion.button>
                      )
                    })}
                  </div>

                  {/* Divider */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                    <span style={{ fontSize: 9, color: '#2D2D36', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em' }}>или своя сумма</span>
                    <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)' }} />
                  </div>

                  {/* Custom input */}
                  <div style={{ position: 'relative', marginBottom: 14 }}>
                    <input
                      type="number"
                      value={customRubles}
                      onChange={(e) => { setCustomRubles(e.target.value); setSelectedPkg(null); setError('') }}
                      placeholder="Введите сумму в ₽"
                      min={10} max={10000}
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: customRubles ? '1px solid rgba(234,179,8,0.38)' : '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 14, padding: '13px 50px 13px 16px',
                        color: '#fff', fontSize: 16, fontWeight: 700, outline: 'none', boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                      }}
                    />
                    <span style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', fontSize: 15, color: '#4B5563', fontWeight: 700 }}>₽</span>
                  </div>

                  {/* Live preview */}
                  <AnimatePresence>
                    {(selectedPkg !== null || (customRubles && Number(customRubles) >= 10)) && (
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4 }}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, padding: '11px 16px', background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.18)', borderRadius: 12 }}
                      >
                        <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Получите</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 20, fontWeight: 900, color: '#EAB308', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Icon name="coins" size={19} /> <AnimNum value={coins} />
                          </span>
                          <span style={{ fontSize: 10, color: 'rgba(234,179,8,0.5)', fontWeight: 700 }}>монет</span>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 12, color: '#F87171', marginBottom: 12, textAlign: 'center', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.18)', borderRadius: 10, padding: '8px 12px' }}>
                      {error}
                    </motion.div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAmountNext}
                    style={{
                      width: '100%', padding: '17px 0', borderRadius: 16, border: 'none',
                      background: isAmountReady ? 'linear-gradient(135deg, #E8092E 0%, #b00720 100%)' : 'rgba(255,255,255,0.05)',
                      color: isAmountReady ? '#fff' : '#2D2D36',
                      fontWeight: 900, fontSize: 16, cursor: isAmountReady ? 'pointer' : 'default',
                      boxShadow: isAmountReady ? '0 4px 28px rgba(232,9,46,0.38)' : 'none',
                      transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {isAmountReady && (
                      <motion.div
                        animate={{ x: ['-100%', '220%'] }}
                        transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 3.5 }}
                        style={{ position: 'absolute', top: 0, bottom: 0, width: '35%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.13), transparent)', pointerEvents: 'none' }}
                      />
                    )}
                    <span style={{ position: 'relative' }}>
                      {isAmountReady ? `Купить ${coins.toLocaleString()} монет →` : 'Выберите сумму'}
                    </span>
                  </motion.button>
                </motion.div>
              )}

              {/* ─────────────── PAYMENT ─────────────── */}
              {step === 'payment' && (
                <motion.div key="payment" initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.22 }}>

                  <button
                    onClick={() => { setStep('amount'); setError('') }}
                    style={{ background: 'none', border: 'none', color: '#374151', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 18, fontWeight: 700 }}
                  >← Назад</button>

                  <div style={{ fontSize: 21, fontWeight: 900, color: '#fff', letterSpacing: '-0.3px', marginBottom: 3 }}>Оплата</div>
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 20 }}>Переведите точную сумму на карту ниже</div>

                  {/* ── Bank card ── */}
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 320, damping: 26, delay: 0.05 }}
                    style={{
                      position: 'relative', borderRadius: 22, padding: '22px 22px 20px',
                      background: 'linear-gradient(135deg, rgba(28,28,38,0.98) 0%, rgba(14,14,20,0.99) 55%, rgba(22,8,14,0.99) 100%)',
                      border: '1px solid rgba(255,255,255,0.09)',
                      boxShadow: '0 12px 50px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.07)',
                      marginBottom: 16, overflow: 'hidden', minHeight: 168,
                    }}
                  >
                    {/* Holographic sweep */}
                    <motion.div
                      animate={{ x: ['-140%', '240%'] }}
                      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 6 }}
                      style={{ position: 'absolute', inset: 0, background: 'linear-gradient(108deg, transparent 30%, rgba(234,179,8,0.055) 48%, rgba(255,255,255,0.04) 52%, transparent 68%)', pointerEvents: 'none' }}
                    />
                    {/* Subtle colour blobs */}
                    <div style={{ position: 'absolute', inset: 0, opacity: 0.045, backgroundImage: 'radial-gradient(circle at 78% 18%, #E8092E 0%, transparent 55%), radial-gradient(circle at 18% 82%, #EAB308 0%, transparent 55%)', pointerEvents: 'none' }} />

                    {/* Row 1: chip + brand */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                      <ChipSVG />
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 13, fontWeight: 900, color: '#EAB308', letterSpacing: '0.14em' }}>CONDR</div>
                        <div style={{ fontSize: 9, color: 'rgba(234,179,8,0.45)', fontWeight: 700, letterSpacing: '0.08em' }}>COINS</div>
                      </div>
                    </div>

                    {/* Card number */}
                    <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: 21, fontWeight: 700, color: '#fff', letterSpacing: '0.2em', marginBottom: 20, textShadow: '0 1px 12px rgba(0,0,0,0.6)' }}>
                      {CARD_NUMBER}
                    </div>

                    {/* Row 3: amount + copy */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 3 }}>Сумма перевода</div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: '#EAB308', letterSpacing: '-0.5px' }}>{rubles.toLocaleString()} ₽</div>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={copyCard}
                        style={{
                          background: copied ? 'rgba(34,197,94,0.18)' : 'rgba(234,179,8,0.13)',
                          border: `1px solid ${copied ? 'rgba(34,197,94,0.5)' : 'rgba(234,179,8,0.38)'}`,
                          borderRadius: 12, padding: '9px 15px',
                          color: copied ? '#4ADE80' : '#EAB308',
                          fontSize: 12, fontWeight: 800, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 5,
                          transition: 'all 0.2s',
                        }}
                      >
                        <AnimatePresence mode="wait">
                          {copied ? (
                            <motion.span key="ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="check" size={13} />Скопировано</motion.span>
                          ) : (
                            <motion.span key="cp" initial={{ scale: 0.8 }} animate={{ scale: 1 }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="clipboard" size={13} />Копировать</motion.span>
                          )}
                        </AnimatePresence>
                      </motion.button>
                    </div>
                  </motion.div>

                  {/* Coins preview row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', background: 'rgba(234,179,8,0.05)', border: '1px solid rgba(234,179,8,0.14)', borderRadius: 14, marginBottom: 18 }}>
                    <Icon name="coins" size={22} color="#EAB308" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: '#4B5563', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 1 }}>Зачислим после проверки</div>
                      <div style={{ fontSize: 19, fontWeight: 900, color: '#EAB308', letterSpacing: '-0.3px' }}>{coins.toLocaleString()} монет</div>
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 800, color: '#22C55E', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 8, padding: '4px 9px', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 3 }}>
                      ПОСЛЕ <Icon name="check" size={10} />
                    </div>
                  </div>

                  {/* Payer name */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: 10, color: '#374151', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Ваше имя (как в банке)</div>
                    <input
                      type="text"
                      value={payerName}
                      onChange={(e) => { setPayerName(e.target.value); setError('') }}
                      placeholder="Иван Иванов"
                      autoComplete="off"
                      style={{
                        width: '100%', background: 'rgba(255,255,255,0.04)',
                        border: payerName ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 13, padding: '13px 15px',
                        color: '#fff', fontSize: 15, fontWeight: 600, outline: 'none', boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                      }}
                    />
                  </div>

                  {/* Bank selector */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 10, color: '#374151', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 7 }}>Ваш банк</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: bank === 'Другой' ? 8 : 0 }}>
                      {BANKS.map((b) => (
                        <motion.button
                          key={b}
                          whileTap={{ scale: 0.92 }}
                          onClick={() => { setBank(b); setError('') }}
                          style={{
                            padding: '7px 15px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                            background: bank === b ? '#E8092E' : 'rgba(255,255,255,0.04)',
                            color: bank === b ? '#fff' : '#4B5563',
                            border: `1px solid ${bank === b ? '#E8092E' : 'rgba(255,255,255,0.07)'}`,
                            cursor: 'pointer', transition: 'all 0.15s',
                            boxShadow: bank === b ? '0 2px 14px rgba(232,9,46,0.3)' : 'none',
                          }}
                        >{b}</motion.button>
                      ))}
                    </div>
                    {bank === 'Другой' && (
                      <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}>
                        <input
                          type="text"
                          value={customBank}
                          onChange={(e) => { setCustomBank(e.target.value); setError('') }}
                          placeholder="Название банка"
                          style={{
                            width: '100%', background: 'rgba(255,255,255,0.04)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 12, padding: '12px 14px',
                            color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                      </motion.div>
                    )}
                  </div>

                  {error && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ fontSize: 12, color: '#F87171', marginBottom: 12, textAlign: 'center', background: 'rgba(248,113,113,0.07)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 10, padding: '9px 14px' }}>
                      {error}
                    </motion.div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handlePaid}
                    disabled={loading}
                    style={{
                      width: '100%', padding: '17px 0', borderRadius: 16, border: 'none',
                      background: loading ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #E8092E, #b00720)',
                      color: loading ? '#2D2D36' : '#fff',
                      fontWeight: 900, fontSize: 16, cursor: loading ? 'default' : 'pointer',
                      boxShadow: loading ? 'none' : '0 4px 28px rgba(232,9,46,0.35)',
                      transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                    }}
                  >
                    {!loading && (
                      <motion.div
                        animate={{ x: ['-100%', '220%'] }}
                        transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 4 }}
                        style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)', pointerEvents: 'none' }}
                      />
                    )}
                    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7 }}>{loading ? 'Создаём заявку...' : <><Icon name="check" size={16} />Я перевёл деньги</>}</span>
                  </motion.button>
                  <div style={{ fontSize: 11, color: '#2D2D36', textAlign: 'center', marginTop: 10 }}>
                    Администратор проверит перевод в течение 3 минут
                  </div>
                </motion.div>
              )}

              {/* ─────────────── PENDING ─────────────── */}
              {step === 'pending' && (
                <motion.div key="pending" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }} style={{ textAlign: 'center', paddingTop: 8 }}>

                  {/* Radar rings */}
                  <div style={{ position: 'relative', width: 108, height: 108, margin: '0 auto 22px' }}>
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{ scale: [1, 2.4], opacity: [0.55, 0] }}
                        transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
                        style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1.5px solid rgba(232,9,46,0.45)' }}
                      />
                    ))}
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(232,9,46,0.08)', border: '1px solid rgba(232,9,46,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }} style={{ color: '#EAB308', display: 'flex' }}>
                        <Icon name="coins" size={40} strokeWidth={1.6} />
                      </motion.div>
                    </div>
                  </div>

                  <div style={{ fontSize: 21, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Проверяем платёж</div>
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 22, lineHeight: 1.6 }}>
                    Администратор проверяет ваш перевод.<br />Обычно это занимает до 3 минут.
                  </div>

                  {/* Order summary card */}
                  <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 18, padding: '16px 18px', marginBottom: 22, textAlign: 'left' }}>
                    <div style={{ fontSize: 9, color: '#2D2D36', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Детали заявки</div>
                    {[
                      { label: 'Заявка', value: `#${purchaseId}`, mono: true, color: '#6B7280' },
                      { label: 'Сумма', value: `${rubles.toLocaleString()} ₽`, color: '#fff' },
                      { label: 'Монеты', value: `${coins.toLocaleString()}`, color: '#EAB308' },
                      { label: 'Банк', value: effectiveBank, color: '#6B7280' },
                    ].map(({ label, value, mono, color }, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: idx < 3 ? 9 : 0, fontSize: 13 }}>
                        <span style={{ color: '#374151', fontWeight: 600 }}>{label}</span>
                        <span style={{ color, fontWeight: 700, fontFamily: mono ? 'monospace' : undefined }}>{value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Animated dots */}
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 20 }}>
                    {[0, 1, 2, 3, 4].map(i => (
                      <motion.div key={i}
                        animate={{ opacity: [0.18, 1, 0.18], scale: [0.7, 1.25, 0.7] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.22 }}
                        style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8092E' }}
                      />
                    ))}
                  </div>

                  <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#2D2D36', fontSize: 12, cursor: 'pointer', fontWeight: 600 }}>
                    Закрыть — проверю позже
                  </button>
                </motion.div>
              )}

              {/* ─────────────── CONFIRMED ─────────────── */}
              {step === 'confirmed' && (
                <motion.div key="confirmed" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', paddingTop: 8 }}>

                  {/* Burst zone */}
                  <div style={{ position: 'relative', height: 148, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                    {showBurst && <CoinBurst />}
                    <motion.div
                      initial={{ scale: 0, rotate: -25 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 17, delay: 0.08 }}
                      style={{ filter: 'drop-shadow(0 0 36px rgba(234,179,8,0.75))', zIndex: 1, position: 'relative', color: '#EAB308', display: 'flex' }}
                    ><Icon name="coins" size={72} strokeWidth={1.6} /></motion.div>
                  </div>

                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#22C55E', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                      <Icon name="check" size={11} />ОПЛАТА ПОДТВЕРЖДЕНА
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', marginBottom: 22 }}>
                      Монеты зачислены!
                    </div>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.75 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.38, type: 'spring', stiffness: 280, damping: 20 }}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                      background: 'rgba(234,179,8,0.09)', border: '1px solid rgba(234,179,8,0.32)',
                      borderRadius: 22, padding: '14px 30px', marginBottom: 28,
                      boxShadow: '0 0 40px rgba(234,179,8,0.13)',
                    }}
                  >
                    <span style={{ fontSize: 30, fontWeight: 900, color: '#EAB308' }}>+</span>
                    <span style={{ fontSize: 38, fontWeight: 900, color: '#EAB308', letterSpacing: '-1px' }}>
                      <AnimNum value={coins} delay={0.4} />
                    </span>
                    <Icon name="coins" size={24} color="#EAB308" />
                  </motion.div>

                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={onClose}
                    style={{
                      width: '100%', padding: '17px 0', borderRadius: 16, border: 'none',
                      background: 'linear-gradient(135deg, #22C55E, #16a34a)',
                      color: '#000', fontWeight: 900, fontSize: 16, cursor: 'pointer',
                      boxShadow: '0 4px 28px rgba(34,197,94,0.32)',
                      position: 'relative', overflow: 'hidden',
                    }}
                  >
                    <motion.div
                      animate={{ x: ['-100%', '220%'] }}
                      transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 2.5 }}
                      style={{ position: 'absolute', top: 0, bottom: 0, width: '30%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)', pointerEvents: 'none' }}
                    />
                    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 7 }}>Отлично!<Icon name="sparkles" size={16} /></span>
                  </motion.button>
                </motion.div>
              )}

              {/* ─────────────── REJECTED ─────────────── */}
              {step === 'rejected' && (
                <motion.div key="rejected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', paddingTop: 8 }}>
                  <motion.div
                    initial={{ scale: 0.5 }}
                    animate={{ scale: 1, rotate: [-10, 10, -8, 8, 0] }}
                    transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.1 }}
                    style={{ marginBottom: 18, display: 'inline-flex', color: '#F87171' }}
                  ><Icon name="x" size={64} strokeWidth={2.2} /></motion.div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: '#F87171', marginBottom: 8, letterSpacing: '-0.3px' }}>Платёж отклонён</div>
                  <div style={{ fontSize: 13, color: '#374151', marginBottom: 28, lineHeight: 1.65 }}>
                    Администратор не смог подтвердить перевод.<br />Проверьте правильность суммы и попробуйте снова.
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => { setStep('amount'); setError('') }}
                    style={{
                      width: '100%', padding: '17px 0', borderRadius: 16, border: 'none',
                      background: 'linear-gradient(135deg, #E8092E, #b00720)',
                      color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer',
                      boxShadow: '0 4px 28px rgba(232,9,46,0.35)', marginBottom: 10,
                    }}
                  >Попробовать снова</motion.button>
                  <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#374151', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Закрыть</button>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
