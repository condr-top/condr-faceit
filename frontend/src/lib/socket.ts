import { io, Socket } from 'socket.io-client'

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const token = localStorage.getItem('condr_faceit_token')
    // Подключаемся к тому же origin, с которого открыта страница (same-origin).
    // socket.io по умолчанию использует путь /socket.io, который nginx/туннель
    // проксирует на backend. Это работает на любом адресе (временный URL и домен)
    // без пересборки фронтенда. Фоллбэк на NEXT_PUBLIC_WS_URL/localhost для SSR/дев.
    const wsUrl =
      typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000'
    socket = io(wsUrl, {
      auth: { token },
      autoConnect: false,
    })
  }
  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
}
