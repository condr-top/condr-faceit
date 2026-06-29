'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { api } from '@/lib/api'
import { connectSocket } from '@/lib/socket'
import { Icon } from '@/components/ui/Icon'

interface Msg {
  id: number
  userId: number
  nickname: string
  avatarUrl?: string | null
  team: string
  text: string
  createdAt: string
}

const TEAM_C: Record<string, string> = { A: '#3B82F6', B: '#E8092E' }
const fmtTime = (s: string) => {
  try { return new Date(s).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

/** Чат матча: общий для обеих команд. Realtime через сокет + история по REST. */
export function MatchChat({ matchId, userId }: { matchId: number; userId: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    api.get(`/matches/${matchId}/messages`).then((r) => { if (alive) setMsgs(r.data) }).catch(() => {})
    const socket = connectSocket()
    socket.emit('join_match', matchId)
    const onMsg = (m: Msg) => setMsgs((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]))
    socket.on('match_message', onMsg)
    return () => { alive = false; socket.off('match_message', onMsg) }
  }, [matchId])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs.length])

  const send = async () => {
    const t = text.trim()
    if (!t || sending) return
    setSending(true)
    try { await api.post(`/matches/${matchId}/messages`, { text: t }); setText('') }
    catch (e: any) { alert(e?.response?.data?.message || 'Ошибка') }
    finally { setSending(false) }
  }

  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Icon name="chat" size={16} color="#E8092E" />
        <span style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Чат матча</span>
        <span style={{ fontSize: 10.5, color: '#4B5563', marginLeft: 'auto' }}>обе команды</span>
      </div>

      <div ref={scrollRef} style={{ maxHeight: 280, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: 'center', color: '#4B5563', fontSize: 12, padding: '18px 0' }}>Сообщений пока нет. Напишите первым 👋</div>
        )}
        {msgs.map((m) => {
          const mine = m.userId === userId
          const tc = TEAM_C[m.team] || '#9CA3AF'
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexDirection: mine ? 'row-reverse' : 'row' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: tc, boxShadow: `0 0 5px ${tc}` }} />
                <span style={{ fontSize: 11, fontWeight: 800, color: tc }}>{m.nickname}</span>
                <span style={{ fontSize: 9.5, color: '#4B5563' }}>{fmtTime(m.createdAt)}</span>
              </div>
              <div style={{
                maxWidth: '82%', padding: '8px 11px', borderRadius: 12, fontSize: 13, lineHeight: 1.4, wordBreak: 'break-word',
                color: '#E5E7EB',
                background: mine ? 'rgba(232,9,46,0.16)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${mine ? 'rgba(232,9,46,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderTopRightRadius: mine ? 3 : 12, borderTopLeftRadius: mine ? 12 : 3,
              }}>{m.text}</div>
            </div>
          )
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
          maxLength={500}
          placeholder="Сообщение…"
          style={{ flex: 1, minWidth: 0, padding: '10px 13px', borderRadius: 11, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 13, outline: 'none' }}
        />
        <motion.button whileTap={{ scale: 0.93 }} onClick={send} disabled={sending || !text.trim()}
          style={{ flexShrink: 0, width: 44, borderRadius: 11, border: 'none', cursor: text.trim() ? 'pointer' : 'default', background: text.trim() ? 'linear-gradient(135deg, #E8092E, #b3001f)' : 'rgba(255,255,255,0.07)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="chevronRight" size={18} color="#fff" />
        </motion.button>
      </div>
    </div>
  )
}
