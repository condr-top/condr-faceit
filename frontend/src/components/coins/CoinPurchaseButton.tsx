'use client'

import { useState } from 'react'
import { CoinPurchaseModal } from './CoinPurchaseModal'

interface Props {
  size?: 'sm' | 'md'
}

export function CoinPurchaseButton({ size = 'sm' }: Props) {
  const [open, setOpen] = useState(false)

  const dim = size === 'sm' ? 20 : 24
  const font = size === 'sm' ? 11 : 13

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Пополнить баланс"
        style={{
          width: dim, height: dim,
          background: '#EAB308',
          border: 'none',
          borderRadius: '50%',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#000',
          fontWeight: 900,
          fontSize: font,
          cursor: 'pointer',
          flexShrink: 0,
          boxShadow: '0 0 8px rgba(234,179,8,0.4)',
          lineHeight: 1,
        }}
      >
        +
      </button>
      {open && <CoinPurchaseModal onClose={() => setOpen(false)} />}
    </>
  )
}
