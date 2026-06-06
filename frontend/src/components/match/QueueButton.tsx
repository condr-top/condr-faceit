'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueueStore } from '@/store/queueStore'

export function QueueButton() {
  const { inQueue, joinQueue, leaveQueue } = useQueueStore()
  const [loading, setLoading] = useState(false)

  const handleToggle = async () => {
    setLoading(true)
    try {
      if (inQueue) {
        await leaveQueue()
      } else {
        await joinQueue()
      }
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Ошибка')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={handleToggle}
      disabled={loading}
      className={`w-full py-4 rounded-xl font-bold text-lg transition-all duration-300 relative overflow-hidden ${
        inQueue
          ? 'bg-dark-300 border-2 border-brand-red text-brand-red'
          : 'bg-brand-red text-white'
      }`}
    >
      <AnimatePresence mode="wait">
        {inQueue ? (
          <motion.div
            key="in-queue"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center justify-center gap-2"
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="w-3 h-3 rounded-full bg-brand-red"
            />
            Покинуть очередь
          </motion.div>
        ) : (
          <motion.div
            key="join"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            ⚔️ Найти матч 5v5
          </motion.div>
        )}
      </AnimatePresence>

      {inQueue && (
        <motion.div
          className="absolute inset-0 bg-brand-red/5"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}
    </motion.button>
  )
}
