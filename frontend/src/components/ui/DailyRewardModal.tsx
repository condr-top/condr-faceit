'use client'

import { motion, AnimatePresence } from 'framer-motion'

interface DailyRewardModalProps {
  reward: { coins: number; xp: number; streak: number }
  onClose: () => void
}

export function DailyRewardModal({ reward, onClose }: DailyRewardModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center px-6"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-dark-200 border border-brand-red rounded-2xl p-6 text-center max-w-sm w-full"
        >
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-5xl mb-4"
          >
            🎁
          </motion.div>

          <h2 className="text-xl font-bold text-white mb-1">Ежедневная награда!</h2>
          <p className="text-light-muted text-sm mb-4">День {reward.streak} подряд</p>

          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-400">+{reward.coins}</div>
              <div className="text-xs text-light-dim">монет</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">+{reward.xp}</div>
              <div className="text-xs text-light-dim">XP</div>
            </div>
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="btn-primary w-full"
          >
            Забрать
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
