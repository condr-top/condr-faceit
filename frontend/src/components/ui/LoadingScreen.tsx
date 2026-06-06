'use client'

import { motion } from 'framer-motion'

export function LoadingScreen() {
  return (
    <div className="min-h-screen bg-dark flex flex-col items-center justify-center">
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          boxShadow: [
            '0 0 10px rgba(232,9,46,0.3)',
            '0 0 40px rgba(232,9,46,0.8)',
            '0 0 10px rgba(232,9,46,0.3)',
          ],
        }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="w-20 h-20 rounded-2xl bg-dark-200 border border-brand-red flex items-center justify-center mb-6"
      >
        <span className="text-4xl font-bold text-brand-red">C</span>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex gap-1"
      >
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, delay: i * 0.2, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-brand-red"
          />
        ))}
      </motion.div>
    </div>
  )
}
