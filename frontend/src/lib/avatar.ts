// Разрешение URL аватара для использования в CSS background / <img src>.
// /uploads/... — локальный файл бэкенда, проксируется через Next (/api/uploads/...).
// http(s)://... — внешняя ссылка (Telegram-фото) — используем как есть.
export function resolveAvatar(url?: string | null): string | null {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('/api')) return url
  return `/api${url}`
}

// Готовое значение для CSS `background` (url(...) center/cover) либо null.
export function avatarBg(url?: string | null): string | null {
  const r = resolveAvatar(url)
  return r ? `url(${r}) center/cover` : null
}
