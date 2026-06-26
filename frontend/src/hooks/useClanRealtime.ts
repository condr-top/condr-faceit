import { useEffect, useRef } from 'react'
import { connectSocket } from '@/lib/socket'

/**
 * Подписка на realtime-обновления клана и/или биржи праков.
 * Бэкенд шлёт 'clan_update' в комнату clan:{id} и 'exchange_update' в 'scrim_exchange'.
 * onUpdate дёргается при любом релевантном событии — вызывающий перезагружает данные.
 */
export function useClanRealtime(
  opts: { clanId?: number | null; exchange?: boolean },
  onUpdate: (payload: any) => void,
) {
  const cb = useRef(onUpdate)
  cb.current = onUpdate
  const { clanId, exchange } = opts

  useEffect(() => {
    if (!clanId && !exchange) return
    let socket
    try { socket = connectSocket() } catch { return }

    const onClan = (p: any) => cb.current(p)
    const onExchange = (p: any) => cb.current({ ...p, _exchange: true })

    if (clanId) { socket.emit('join_clan', clanId); socket.on('clan_update', onClan) }
    if (exchange) { socket.emit('join_exchange'); socket.on('exchange_update', onExchange) }

    return () => {
      if (clanId) { socket.emit('leave_clan', clanId); socket.off('clan_update', onClan) }
      if (exchange) { socket.emit('leave_exchange'); socket.off('exchange_update', onExchange) }
    }
  }, [clanId, exchange])
}
