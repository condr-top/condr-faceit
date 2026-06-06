'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useSpring } from 'framer-motion'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { RequireRegistration } from '@/components/providers/RequireRegistration'

const FAQ = [
  { q: 'Как работает система ELO?', a: 'Первые 10 матчей — калибровка: победа +80, поражение −40 ELO. После калибровки стандартная система ±25 с поправкой на разницу ELO команд.', icon: '📊' },
  { q: 'Что такое варны и как их снять?', a: '3 предупреждения = бан. Снять варн можно через Магазин → "Снять предупреждение" за монеты.', icon: '⚠️' },
  { q: 'Как сменить игровой никнейм?', a: 'Профиль → "Сменить никнейм". Первая смена бесплатна, последующие стоят 500 монет.', icon: '✏️' },
  { q: 'Что такое кулдаун?', a: 'Если пропустил ready-check или покинул матч, накладывается кулдаун. На время кулдауна поиск матча заблокирован.', icon: '⏱️' },
  { q: 'Что делать при споре по результату?', a: 'Капитаны вводят счёт независимо. При расхождении матч переходит в статус "Спор" и рассматривается администрацией по скриншотам.', icon: '⚡' },
  { q: 'Как пожаловаться на игрока?', a: 'Открой профиль игрока → кнопка "Пожаловаться". Жалобы рассматриваются модерацией в течение 24 часов.', icon: '🚨' },
]

interface Msg {
  id: number; text: string
  isFromAdmin: boolean; createdAt: string; readByUser: boolean
}

const fmt = (iso: string) => new Date(iso).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })
const fmtDate = (iso: string) => {
  const d = new Date(iso), t = new Date()
  if (d.toDateString() === t.toDateString()) return 'Сегодня'
  const y = new Date(t); y.setDate(t.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Вчера'
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long' })
}

// ── FAQ item ──────────────────────────────────────────────────────────────────
function FaqItem({ item, idx, open, onToggle }: {
  item: typeof FAQ[0]; idx: number; open: boolean; onToggle: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.05, type: 'spring', stiffness: 300, damping: 24 }}
      style={{
        borderRadius: 16, overflow: 'hidden',
        border: `1px solid ${open ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.06)'}`,
        background: open ? 'rgba(96,165,250,0.05)' : 'rgba(255,255,255,0.03)',
        transition: 'border 0.25s, background 0.25s',
        boxShadow: open ? '0 4px 20px rgba(96,165,250,0.08)' : 'none',
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: '100%', padding: '13px 14px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: open ? 'rgba(96,165,250,0.15)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${open ? 'rgba(96,165,250,0.3)' : 'rgba(255,255,255,0.07)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
          transition: 'background 0.25s',
        }}>{item.icon}</span>

        <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: open ? '#fff' : '#D1D5DB', lineHeight: 1.35 }}>
          {item.q}
        </span>

        <motion.div
          animate={{ rotate: open ? 135 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{ fontSize: 18, color: open ? '#60A5FA' : '#374151', flexShrink: 0, lineHeight: 1 }}
        >+</motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 14px 14px 54px',
              fontSize: 13, color: '#9CA3AF', lineHeight: 1.65,
              borderTop: '1px solid rgba(255,255,255,0.05)',
              paddingTop: 10,
            }}>
              {item.a}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Message bubble ────────────────────────────────────────────────────────────
function Bubble({ msg }: { msg: Msg }) {
  const isAdmin = msg.isFromAdmin
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 340, damping: 26 }}
      style={{
        display: 'flex',
        justifyContent: isAdmin ? 'flex-start' : 'flex-end',
        marginBottom: 6,
        alignItems: 'flex-end', gap: 6,
      }}
    >
      {/* Admin avatar */}
      {isAdmin && (
        <div style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: 'linear-gradient(135deg, #7c3aed, #A855F7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, boxShadow: '0 0 8px rgba(168,85,247,0.4)',
        }}>🛡</div>
      )}

      <div style={{
        maxWidth: '75%', position: 'relative',
        padding: '10px 13px',
        borderRadius: isAdmin ? '4px 18px 18px 18px' : '18px 4px 18px 18px',
        background: isAdmin
          ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.12))'
          : 'linear-gradient(135deg, rgba(232,9,46,0.18), rgba(180,0,30,0.12))',
        border: isAdmin
          ? '1px solid rgba(168,85,247,0.25)'
          : '1px solid rgba(232,9,46,0.28)',
        boxShadow: isAdmin
          ? '0 2px 12px rgba(168,85,247,0.1)'
          : '0 2px 12px rgba(232,9,46,0.1)',
      }}>
        {isAdmin && (
          <div style={{
            fontSize: 9, fontWeight: 800, color: '#A855F7',
            marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em',
          }}>
            Поддержка ✓
          </div>
        )}
        <div style={{ fontSize: 14, color: '#F3F4F6', lineHeight: 1.55, wordBreak: 'break-word' }}>
          {msg.text}
        </div>
        <div style={{
          fontSize: 10, color: '#4B5563', marginTop: 5,
          textAlign: isAdmin ? 'left' : 'right',
          display: 'flex', alignItems: 'center', justifyContent: isAdmin ? 'flex-start' : 'flex-end', gap: 4,
        }}>
          {fmt(msg.createdAt)}
          {!isAdmin && (
            <span style={{ color: msg.readByUser ? '#34D399' : '#374151', fontSize: 11, fontWeight: 700 }}>
              {msg.readByUser ? '✓✓' : '✓'}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SupportPage() {
  const { user } = useAuthStore()
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<'faq' | 'chat'>('faq')
  const bottomRef = useRef<HTMLDivElement>(null)
  const pollRef   = useRef<NodeJS.Timeout>()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const fetchMessages = async () => {
    try { const r = await api.get('/support/messages'); setMessages(r.data) } catch {}
  }

  useEffect(() => {
    fetchMessages()
    pollRef.current = setInterval(fetchMessages, 4000)
    return () => clearInterval(pollRef.current)
  }, [])

  const prevCount = useRef(0)
  useEffect(() => {
    const n = messages.length, hasNew = n > prevCount.current
    prevCount.current = n
    if (!hasNew) return
    const el = bottomRef.current?.parentElement
    if (!el || el.scrollHeight - el.scrollTop - el.clientHeight < 150)
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const send = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    try {
      await api.post('/support/message', { text: text.trim() })
      setText('')
      await fetchMessages()
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    } catch {} finally { setSending(false) }
  }

  const grouped: { date: string; msgs: Msg[] }[] = []
  for (const msg of messages) {
    const label = fmtDate(msg.createdAt)
    const last = grouped[grouped.length - 1]
    if (last?.date === label) last.msgs.push(msg)
    else grouped.push({ date: label, msgs: [msg] })
  }

  const unreadCount = messages.filter(m => m.isFromAdmin && !m.readByUser).length

  return (
    <RequireRegistration>
      <div style={{ minHeight: '100vh', background: 'transparent', display: 'flex', flexDirection: 'column', paddingBottom: tab === 'chat' ? 140 : 96 }}>
        <div style={{ position: 'relative', zIndex: 1, padding: '0 16px' }}>

          {/* ── HEADER ── */}
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{ paddingTop: 24, marginBottom: 18 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(96,165,250,0.25), rgba(167,139,250,0.15))',
                  border: '1px solid rgba(96,165,250,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                }}>💬</div>
                <div>
                  <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.5px', lineHeight: 1 }}>
                    Поддержка
                  </h1>
                  <div style={{ fontSize: 10, color: '#4B5563', marginTop: 2 }}>Обычно отвечаем за несколько часов</div>
                </div>
              </div>
              {unreadCount > 0 && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    background: '#E8092E', borderRadius: 20, padding: '4px 10px',
                    fontSize: 12, fontWeight: 900, color: '#fff',
                    boxShadow: '0 0 10px rgba(232,9,46,0.4)',
                  }}
                >
                  {unreadCount} new
                </motion.div>
              )}
            </div>

            {/* Tabs */}
            <div style={{
              display: 'flex', gap: 6,
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 14, padding: 4,
            }}>
              {[
                { key: 'faq',  label: '❓ FAQ',        badge: null },
                { key: 'chat', label: '💬 Чат',        badge: unreadCount > 0 ? unreadCount : null },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key as any)}
                  style={{
                    flex: 1, padding: '9px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 700, position: 'relative',
                    background: tab === t.key
                      ? 'linear-gradient(135deg, rgba(96,165,250,0.8), rgba(124,58,237,0.85))'
                      : 'transparent',
                    color: tab === t.key ? '#fff' : '#4B5563',
                    boxShadow: tab === t.key ? '0 2px 10px rgba(96,165,250,0.3)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {t.label}
                  {t.badge && (
                    <span style={{
                      position: 'absolute', top: 2, right: 6,
                      width: 16, height: 16, background: '#E8092E',
                      borderRadius: '50%', fontSize: 8, color: '#fff',
                      fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>{t.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* ── FAQ TAB ── */}
          <AnimatePresence mode="wait">
            {tab === 'faq' && (
              <motion.div
                key="faq"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18 }}
              >
                <div style={{ fontSize: 10, color: '#374151', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>
                  Частые вопросы
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {FAQ.map((item, i) => (
                    <FaqItem
                      key={i} item={item} idx={i}
                      open={openFaq === i}
                      onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                    />
                  ))}
                </div>

                {/* CTA to chat */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  style={{ marginTop: 20 }}
                >
                  <div style={{
                    borderRadius: 18, padding: '18px 16px',
                    background: 'linear-gradient(135deg, rgba(96,165,250,0.08), rgba(124,58,237,0.06))',
                    border: '1px solid rgba(96,165,250,0.18)',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>🤔</div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                      Не нашёл ответ?
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 14 }}>
                      Напиши нам напрямую — поможем разобраться
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setTab('chat')}
                      style={{
                        padding: '11px 28px', borderRadius: 12, border: 'none',
                        background: 'linear-gradient(135deg, rgba(96,165,250,0.85), rgba(124,58,237,0.9))',
                        color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer',
                        boxShadow: '0 3px 14px rgba(96,165,250,0.3)',
                      }}
                    >
                      💬 Написать в поддержку
                    </motion.button>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {/* ── CHAT TAB ── */}
            {tab === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
              >
                {messages.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{ textAlign: 'center', padding: '48px 20px' }}
                  >
                    <motion.div
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                      style={{ fontSize: 48, marginBottom: 12 }}
                    >👋</motion.div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 6 }}>
                      Привет, {user?.gameNickname || user?.firstName}!
                    </div>
                    <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>
                      Опиши свою проблему — мы ответим<br />в течение нескольких часов
                    </div>
                  </motion.div>
                ) : (
                  <div>
                    {grouped.map(group => (
                      <div key={group.date}>
                        <div style={{
                          textAlign: 'center', margin: '14px 0 10px',
                          display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                          <span style={{ fontSize: 10, color: '#374151', fontWeight: 700,
                            background: 'rgba(255,255,255,0.04)', padding: '3px 10px', borderRadius: 20,
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>{group.date}</span>
                          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
                        </div>
                        {group.msgs.map(msg => <Bubble key={msg.id} msg={msg} />)}
                      </div>
                    ))}
                    <div ref={bottomRef} style={{ height: 8 }} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── INPUT (chat only) ── */}
        {tab === 'chat' && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            style={{
              position: 'fixed', bottom: 80, left: 0, right: 0,
              padding: '10px 14px 10px',
              background: 'rgba(6,6,8,0.92)',
              backdropFilter: 'blur(24px)',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', gap: 10, alignItems: 'flex-end',
              zIndex: 20,
            }}
          >
            {/* User avatar mini */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(232,9,46,0.3), rgba(180,0,30,0.2))',
              border: '1px solid rgba(232,9,46,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, overflow: 'hidden',
            }}>
              {user?.avatarUrl
                ? <img src={user.avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user?.gameNickname || user?.firstName || '?')[0].toUpperCase()
              }
            </div>

            <textarea
              ref={textareaRef}
              value={text}
              onChange={e => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px' }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Напишите сообщение..."
              rows={1}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 14, padding: '10px 14px',
                color: '#F3F4F6', fontSize: 14, resize: 'none',
                outline: 'none', fontFamily: 'inherit',
                maxHeight: 100, overflowY: 'auto',
                transition: 'border 0.2s',
              }}
              onFocus={e => { e.currentTarget.style.border = '1px solid rgba(96,165,250,0.35)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(96,165,250,0.08)' }}
              onBlur={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none' }}
            />

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={send}
              disabled={!text.trim() || sending}
              style={{
                width: 42, height: 42, borderRadius: 13, flexShrink: 0, border: 'none',
                background: text.trim()
                  ? 'linear-gradient(135deg, rgba(96,165,250,0.9), rgba(124,58,237,0.95))'
                  : 'rgba(255,255,255,0.05)',
                cursor: text.trim() ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, transition: 'background 0.2s',
                boxShadow: text.trim() ? '0 2px 14px rgba(96,165,250,0.4)' : 'none',
                color: '#fff',
              }}
            >
              {sending ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }}
                />
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </motion.button>
          </motion.div>
        )}
      </div>
    </RequireRegistration>
  )
}
