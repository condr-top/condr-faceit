'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '@/lib/api'

const REASONS = [
  { key: 'cheat', label: '🎮 Читерство' },
  { key: 'insult', label: '🤬 Оскорбления' },
  { key: 'afk', label: '💤 АФК / саботаж' },
  { key: 'fake_result', label: '📸 Фейковый результат' },
  { key: 'other', label: '❓ Другое' },
]

interface ReportModalProps {
  reportedId: number
  reportedName: string
  onClose: () => void
}

export function ReportModal({ reportedId, reportedName, onClose }: ReportModalProps) {
  const [reason, setReason] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    if (!reason) return
    setLoading(true)
    try {
      await api.post('/reports', { reportedId, reason, description: description.trim() || undefined })
      setDone(true)
    } catch (e: any) {
      alert(e?.response?.data?.message || 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center"
        style={{ background: 'rgba(0,0,0,0.8)' }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="w-full max-w-md rounded-t-3xl p-6 pb-10"
          style={{
            background: 'rgba(17,17,17,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderBottom: 'none',
          }}
        >
          <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'rgba(255,255,255,0.2)' }} />

          {done ? (
            <div className="text-center py-4">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-white mb-2">Репорт отправлен</h2>
              <p className="text-sm mb-6" style={{ color: '#9CA3AF' }}>
                Администратор рассмотрит жалобу в ближайшее время
              </p>
              <button onClick={onClose} className="w-full py-3.5 rounded-xl text-white font-bold" style={{ background: '#E8092E' }}>
                Закрыть
              </button>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white mb-1">Пожаловаться</h2>
              <p className="text-sm mb-5" style={{ color: '#9CA3AF' }}>На игрока <span className="text-white font-bold">{reportedName}</span></p>

              <div className="space-y-2 mb-4">
                {REASONS.map(r => (
                  <button
                    key={r.key}
                    onClick={() => setReason(r.key)}
                    className="w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all"
                    style={{
                      background: reason === r.key ? 'rgba(232,9,46,0.15)' : 'rgba(255,255,255,0.05)',
                      border: `1px solid ${reason === r.key ? '#E8092E' : 'rgba(255,255,255,0.08)'}`,
                      color: reason === r.key ? '#fff' : '#9CA3AF',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Дополнительное описание (необязательно)"
                rows={3}
                className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none mb-5"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                }}
              />

              <button
                onClick={submit}
                disabled={!reason || loading}
                className="w-full py-3.5 rounded-xl text-white font-bold disabled:opacity-40"
                style={{ background: '#E8092E' }}
              >
                {loading ? 'Отправка...' : 'Отправить репорт'}
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
