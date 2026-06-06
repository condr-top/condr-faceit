const store = new Map<string, { data: any; ts: number }>()
const TTL = 30_000 // 30 seconds

export function getCached<T>(key: string): T | null {
  const entry = store.get(key)
  if (!entry) return null
  if (Date.now() - entry.ts > TTL) return null
  return entry.data as T
}

export function setCached(key: string, data: any) {
  store.set(key, { data, ts: Date.now() })
}

export function invalidate(key: string) {
  store.delete(key)
}
