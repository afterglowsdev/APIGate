const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-connection',
  'transfer-encoding',
  'te',
  'trailer',
  'upgrade',
  'host',
  'content-length',
])

const STRIP_REQUEST_HEADERS = new Set([
  'authorization',
  'cookie',
  'host',
  'connection',
  'content-length',
  'x-client-token',
  'x-forwarded-for',
  'x-real-ip',
  'cf-connecting-ip',
])

const STRIP_RESPONSE_HEADERS = new Set([
  'content-length',
  'content-encoding',
  'transfer-encoding',
  'connection',
])

export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null
  const match = authHeader.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

export function extractClientToken(headers: Headers): string | null {
  const auth = headers.get('Authorization')
  const bearerToken = extractBearerToken(auth)
  if (bearerToken) return bearerToken
  return headers.get('X-Client-Token')
}

export function cleanRequestHeaders(headers: Headers, extraHeaders: Record<string, string> = {}): Headers {
  const cleaned = new Headers()
  headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (STRIP_REQUEST_HEADERS.has(lower)) return
    if (HOP_BY_HOP_HEADERS.has(lower)) return
    cleaned.set(key, value)
  })
  for (const [key, value] of Object.entries(extraHeaders)) {
    cleaned.set(key, value)
  }
  return cleaned
}

export function cleanResponseHeaders(headers: Headers): Headers {
  const cleaned = new Headers()
  headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (STRIP_RESPONSE_HEADERS.has(lower)) return
    if (HOP_BY_HOP_HEADERS.has(lower)) return
    cleaned.set(key, value)
  })
  return cleaned
}
