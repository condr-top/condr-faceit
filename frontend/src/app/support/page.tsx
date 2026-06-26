'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'
import { RequireRegistration } from '@/components/providers/RequireRegistration'
import { Icon, IconName } from '@/components/ui/Icon'
import { useSheetDrag } from '@/lib/useSheetDrag'

const ACCENT = '#E8092E'
const BLUE = '#60A5FA'

const FAQ: { q: string; a: string; icon: IconName }[] = [
  { q: 'Как работает система ELO?', a: 'Первые 10 матчей — калибровка: победа +80, поражение −40 ELO. После калибровки стандартная система ±25 с поправкой на разницу ELO команд.', icon: 'barChart' },
  { q: 'Что такое варны и как их снять?', a: '3 предупреждения = бан. Снять варн можно через Магазин → "Снять предупреждение" за монеты.', icon: 'warning' },
  { q: 'Как сменить игровой никнейм?', a: 'Профиль → "Сменить никнейм". Первая смена бесплатна, последующие стоят 500 монет.', icon: 'pencil' },
  { q: 'Что такое кулдаун?', a: 'Если пропустил ready-check или покинул матч, накладывается кулдаун. На время кулдауна поиск матча заблокирован.', icon: 'timer' },
  { q: 'Что делать при споре по результату?', a: 'Капитаны вводят счёт независимо. При расхождении матч переходит в статус "Спор" и рассматривается администрацией по скриншотам.', icon: 'bolt' },
  { q: 'Как пожаловаться на игрока?', a: 'Открой профиль игрока → кнопка "Пожаловаться". Жалобы рассматриваются модерацией в течение 24 часов.', icon: 'warning' },
]

const CATS: { key: string; label: string; icon: IconName; color: string; hint: string }[] = [
  { key: 'payment', label: 'Платежи и монеты', icon: 'coins', color: '#EAB308', hint: 'Покупки, начисления, премиум' },
  { key: 'account', label: 'Аккаунт и никнейм', icon: 'user', color: '#60A5FA', hint: 'Вход, ник, привязки' },
  { key: 'match', label: 'Матчи и рейтинг', icon: 'swords', color: '#E8092E', hint: 'ELO, лобби, результаты' },
  { key: 'report', label: 'Жалоба на игрока', icon: 'warning', color: '#F59E0B', hint: 'Читы, токсичность, абуз' },
  { key: 'bug', label: 'Баг / ошибка', icon: 'flask', color: '#A855F7', hint: 'Что-то работает не так' },
  { key: 'other', label: 'Другое', icon: 'chat', color: '#9CA3AF', hint: 'Любой другой вопрос' },
]
const cat = (k: string) => CATS.find(c => c.key === k) || CATS[5]

interface Ticket { id: number; category: string; categoryLabel: string; subject: string; status: string; createdAt: string; updatedAt: string; closedAt: string | null; lastMessage?: string; lastFromAdmin?: boolean; lastAt?: string; unread?: number }
interface Msg { id: number; text: string; isFromAdmin: boolean; createdAt: string; readByUser: boolean }

const fmt = (s: string) => new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
const fmtDay = (s: string) => { const d = new Date(s), t = new Date(); return d.toDateString() === t.toDateString() ? 'Сегодня' : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) }

export default function SupportPage() {
  return <RequireRegistration><Inner /></RequireRegistration>
}

function Inner() {
  const [tab, setTab] = useState<'faq' | 'tickets'>('tickets')
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [active, setActive] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)

  const loadTickets = useCallback(async () => { try { setTickets((await api.get('/support/tickets')).data) } catch {} }, [])
  useEffect(() => { loadTickets() }, [loadTickets])

  const totalUnread = tickets.reduce((s, t) => s + (t.unread || 0), 0)

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', paddingBottom: 110 }}>
      <div style={{ position: 'relative', zIndex: 1, padding: '0 16px' }}>
        <motion.div initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }} style={{ paddingTop: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, rgba(96,165,250,0.28), rgba(167,139,250,0.18))', border: '1px solid rgba(96,165,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: BLUE }}><Icon name="chat" size={19} /></div>
            <div><h1 style={{ fontSize: 23, fontWeight: 900, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>Поддержка</h1><div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>Обращения по темам · ответ за несколько часов</div></div>
          </div>
        </motion.div>

        <div style={{ display: 'flex', gap: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 14, padding: 4, marginBottom: 18 }}>
          {([['tickets', 'Обращения', totalUnread], ['faq', 'FAQ', 0]] as [any, string, number][]).map(([k, l, b]) => (
            <button key={k} onClick={() => setTab(k)} style={{ flex: 1, position: 'relative', padding: '11px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13.5, fontWeight: 800, color: tab === k ? '#fff' : '#9CA3AF', background: tab === k ? `linear-gradient(135deg, ${ACCENT}, #b4001e)` : 'none', boxShadow: tab === k ? `0 4px 14px ${ACCENT}44` : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, transition: 'color .2s' }}>
              {l}{b > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: tab === k ? 'rgba(0,0,0,0.25)' : ACCENT, color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{b}</span>}
            </button>
          ))}
        </div>

        {tab === 'faq' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQ.map((f, i) => {
              const open = openFaq === i
              return (
                <div key={i} style={{ borderRadius: 14, background: '#0f0f15', border: `1px solid ${open ? BLUE + '44' : 'rgba(255,255,255,0.06)'}`, overflow: 'hidden' }}>
                  <button onClick={() => setOpenFaq(open ? null : i)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: `${BLUE}16`, border: `1px solid ${BLUE}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={f.icon} size={16} color={BLUE} /></div>
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{f.q}</span>
                    <motion.div animate={{ rotate: open ? 90 : 0 }}><Icon name="chevronRight" size={16} color="#6B7280" /></motion.div>
                  </button>
                  <AnimatePresence>{open && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}><div style={{ padding: '0 14px 14px 60px', fontSize: 13, color: '#9CA3AF', lineHeight: 1.55 }}>{f.a}</div></motion.div>}</AnimatePresence>
                </div>
              )
            })}
          </div>
        ) : (
          <>
            <motion.button whileTap={{ scale: 0.98 }} onClick={() => setCreating(true)}
              style={{ width: '100%', marginBottom: 16, padding: '14px 0', borderRadius: 14, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 800, color: '#fff', background: `linear-gradient(135deg, ${ACCENT}, #b4001e)`, boxShadow: `0 8px 24px ${ACCENT}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Icon name="plus" size={17} color="#fff" />Новое обращение
            </motion.button>

            {tickets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: '#6B7280' }}>
                <div style={{ width: 60, height: 60, margin: '0 auto 14px', borderRadius: 18, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="clipboard" size={28} color="#374151" /></div>
                <div style={{ fontSize: 14 }}>У вас пока нет обращений</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {tickets.map((t, i) => {
                  const c = cat(t.category); const closed = t.status === 'closed'
                  return (
                    <motion.button key={t.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }} whileTap={{ scale: 0.99 }} onClick={() => setActive(t.id)}
                      style={{ width: '100%', textAlign: 'left', position: 'relative', overflow: 'hidden', borderRadius: 16, padding: 14, cursor: 'pointer', background: closed ? 'rgba(255,255,255,0.025)' : `linear-gradient(135deg, ${c.color}10, #0f0f15 60%)`, border: `1px solid ${(t.unread ? c.color + '55' : 'rgba(255,255,255,0.06)')}`, opacity: closed ? 0.75 : 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: `${c.color}16`, border: `1px solid ${c.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={20} color={c.color} /></div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</span>
                            {closed ? <span style={{ fontSize: 9.5, fontWeight: 800, color: '#22C55E', background: 'rgba(34,197,94,0.12)', padding: '2px 8px', borderRadius: 20 }}>Закрыт</span> : <span style={{ fontSize: 9.5, fontWeight: 800, color: c.color, background: `${c.color}1a`, padding: '2px 8px', borderRadius: 20 }}>Открыт</span>}
                            {!!t.unread && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: ACCENT, color: '#fff', fontSize: 11, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t.unread}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.lastFromAdmin ? '🛟 ' : ''}{t.lastMessage || t.categoryLabel}</div>
                        </div>
                        <Icon name="chevronRight" size={17} color="#4B5563" />
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <AnimatePresence>
        {creating && <CreateTicketSheet onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); loadTickets(); setActive(id) }} />}
        {active != null && <TicketChat ticketId={active} onClose={() => { setActive(null); loadTickets() }} />}
      </AnimatePresence>
    </div>
  )
}

function CreateTicketSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const sheet = useSheetDrag(onClose)
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const canSave = !!category && text.trim().length >= 5 && !saving
  const submit = async () => {
    if (!canSave) return
    setSaving(true)
    try { const r = await api.post('/support/tickets', { category, subject: subject.trim(), text: text.trim() }); onCreated(r.data.id) }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка'); setSaving(false) }
  }
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 130, background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.div {...sheet.panelProps} initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 300 }} onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 520, background: 'linear-gradient(180deg, #101016, #0a0a0f)', borderRadius: '26px 26px 0 0', border: '1px solid rgba(255,255,255,0.09)', borderBottom: 'none', padding: 20, paddingBottom: 32, maxHeight: '90vh', overflowY: 'auto' }}>
        <div {...sheet.handleProps} style={{ ...sheet.handleProps.style, padding: '4px 0 16px' }}><div style={{ width: 42, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)' }} /></div>
        <div style={{ fontSize: 18, fontWeight: 900, marginBottom: 4 }}>Новое обращение</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 16 }}>Выберите тему — по каждой ведётся отдельный чат</div>

        <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>Тема</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 18 }}>
          {CATS.map(c => {
            const sel = category === c.key
            return (
              <button key={c.key} onClick={() => setCategory(c.key)} style={{ textAlign: 'left', padding: '12px 12px', borderRadius: 14, cursor: 'pointer', background: sel ? `${c.color}1f` : 'rgba(255,255,255,0.03)', border: `1px solid ${sel ? c.color : 'rgba(255,255,255,0.06)'}`, transition: 'all .15s' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><Icon name={c.icon} size={17} color={c.color} /><span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>{c.label}</span></div>
                <div style={{ fontSize: 10.5, color: '#6B7280', lineHeight: 1.3 }}>{c.hint}</div>
              </button>
            )
          })}
        </div>

        <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Тема обращения (необязательно)</div>
        <input value={subject} onChange={e => setSubject(e.target.value.slice(0, 120))} placeholder="Коротко суть проблемы" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, fontSize: 14, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', marginBottom: 14 }} />

        <div style={{ fontSize: 11, fontWeight: 800, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Сообщение</div>
        <textarea value={text} onChange={e => setText(e.target.value.slice(0, 1500))} rows={4} placeholder="Опишите проблему подробно…" style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12, fontSize: 14, color: '#fff', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', outline: 'none', resize: 'none', lineHeight: 1.45, marginBottom: 16 }} />

        <button onClick={submit} disabled={!canSave} style={{ width: '100%', padding: '14px 0', borderRadius: 14, border: 'none', cursor: canSave ? 'pointer' : 'not-allowed', fontSize: 15, fontWeight: 800, color: '#fff', background: canSave ? `linear-gradient(135deg, ${ACCENT}, #b4001e)` : 'rgba(255,255,255,0.06)', boxShadow: canSave ? `0 8px 24px ${ACCENT}44` : 'none', opacity: canSave ? 1 : 0.6 }}>{saving ? 'Отправляем…' : 'Создать обращение'}</button>
      </motion.div>
    </motion.div>
  )
}

function TicketChat({ ticketId, onClose }: { ticketId: number; onClose: () => void }) {
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const poll = useRef<NodeJS.Timeout>()

  const load = useCallback(async () => { try { const r = await api.get(`/support/tickets/${ticketId}`); setTicket(r.data.ticket); setMessages(r.data.messages) } catch {} }, [ticketId])
  useEffect(() => { load(); poll.current = setInterval(load, 4000); return () => clearInterval(poll.current) }, [load])

  const prev = useRef(0)
  useEffect(() => { if (messages.length > prev.current) bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); prev.current = messages.length }, [messages])

  const closed = ticket?.status === 'closed'
  const c = cat(ticket?.category || 'other')
  const send = async () => {
    if (!text.trim() || sending || closed) return
    setSending(true)
    try { await api.post(`/support/tickets/${ticketId}/message`, { text: text.trim() }); setText(''); await load() }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') } finally { setSending(false) }
  }

  const grouped: { date: string; msgs: Msg[] }[] = []
  for (const m of messages) { const l = fmtDay(m.createdAt); const last = grouped[grouped.length - 1]; if (last?.date === l) last.msgs.push(m); else grouped.push({ date: l, msgs: [m] }) }

  return (
    <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 32, stiffness: 320 }}
      style={{ position: 'fixed', inset: 0, zIndex: 135, background: 'linear-gradient(180deg, #0c0c11, #08080b)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '46px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={onClose} style={{ width: 36, height: 36, borderRadius: 11, border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.06)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon name="chevronLeft" size={20} color="#fff" /></button>
        <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: `${c.color}16`, border: `1px solid ${c.color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={c.icon} size={19} color={c.color} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15.5, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ticket?.subject || 'Обращение'}</div>
          <div style={{ fontSize: 11, color: closed ? '#22C55E' : c.color, fontWeight: 700, marginTop: 1 }}>{ticket?.categoryLabel} · {closed ? 'закрыт' : 'открыт'}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 3 }}>
        {grouped.map((g, gi) => (
          <div key={gi}>
            <div style={{ textAlign: 'center', margin: '10px 0', fontSize: 10.5, color: '#4B5563', fontWeight: 700 }}>{g.date}</div>
            {g.msgs.map(m => {
              const admin = m.isFromAdmin
              return (
                <div key={m.id} style={{ display: 'flex', justifyContent: admin ? 'flex-start' : 'flex-end', marginBottom: 8 }}>
                  <div style={{ maxWidth: '82%', padding: '10px 13px', borderRadius: admin ? '4px 14px 14px 14px' : '14px 4px 14px 14px', background: admin ? 'rgba(255,255,255,0.05)' : `linear-gradient(135deg, ${ACCENT}, #b4001e)`, border: admin ? '1px solid rgba(255,255,255,0.07)' : 'none' }}>
                    {admin && <div style={{ fontSize: 10, fontWeight: 800, color: BLUE, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}><Icon name="verified" size={11} />Поддержка</div>}
                    <div style={{ fontSize: 14, color: '#fff', lineHeight: 1.45, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</div>
                    <div style={{ fontSize: 9.5, color: admin ? '#4B5563' : 'rgba(255,255,255,0.6)', textAlign: 'right', marginTop: 4 }}>{fmt(m.createdAt)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {closed ? (
        <div style={{ padding: '16px 16px calc(20px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: 13, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="lock" size={14} color="#6B7280" />Обращение закрыто. Создайте новое, если нужно.
        </div>
      ) : (
        <div style={{ padding: '12px 12px calc(14px + env(safe-area-inset-bottom,0px))', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 10 }}>
          <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} placeholder="Сообщение…" style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 12, padding: '12px 16px', color: '#fff', fontSize: 14, outline: 'none' }} />
          <button onClick={send} disabled={!text.trim() || sending} style={{ width: 48, borderRadius: 12, border: 'none', cursor: text.trim() ? 'pointer' : 'default', background: text.trim() ? `linear-gradient(135deg, ${ACCENT}, #b4001e)` : 'rgba(255,255,255,0.05)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: sending ? 0.6 : 1 }}><Icon name="chevronRight" size={20} color="#fff" /></button>
        </div>
      )}
    </motion.div>
  )
}
