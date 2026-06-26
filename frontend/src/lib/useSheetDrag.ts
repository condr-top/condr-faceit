'use client'

import { useDragControls, type PanInfo } from 'framer-motion'

/**
 * Drag-to-dismiss для нижних шитов. Перетаскивание инициируется ТОЛЬКО ручкой
 * (handle) — поэтому скролл контента внутри шита не конфликтует с жестом.
 *
 * Использование:
 *   const sheet = useSheetDrag(onClose)
 *   <motion.div {...sheet.panelProps} initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}>
 *     <div {...sheet.handleProps}><div className="pill" /></div>
 *     ...
 *   </motion.div>
 */
export function useSheetDrag(onClose: () => void) {
  const controls = useDragControls()
  return {
    panelProps: {
      drag: 'y' as const,
      dragControls: controls,
      dragListener: false,
      dragConstraints: { top: 0, bottom: 0 },
      dragElastic: { top: 0, bottom: 0.7 },
      onDragEnd: (_e: unknown, info: PanInfo) => {
        if (info.offset.y > 110 || info.velocity.y > 800) onClose()
      },
    },
    // навесить на обёртку ручки — расширенная зона захвата
    handleProps: {
      onPointerDown: (e: any) => controls.start(e),
      style: {
        touchAction: 'none' as const,
        cursor: 'grab' as const,
        display: 'flex',
        justifyContent: 'center',
        flexShrink: 0,
      },
    },
  }
}
