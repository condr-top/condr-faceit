'use client'

import { motion } from 'framer-motion'

interface StatCardProps {
  label: string
  value: string
  color?: 'red' | 'gold' | 'blue' | 'default'
}

const colorMap = {
  red: 'text-brand-red',
  gold: 'text-yellow-400',
  blue: 'text-blue-400',
  default: 'text-white',
}

export function StatCard({ label, value, color = 'default' }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-dark-200 rounded-lg border border-dark-400 p-3 text-center"
    >
      <div className={`text-xl font-bold ${colorMap[color]}`}>{value}</div>
      <div className="text-light-dim text-xs mt-0.5">{label}</div>
    </motion.div>
  )
}
