const SENSITIVE_KEYS = new Set([
  'authorization',
  'token',
  'key',
  'secret',
  'password',
  'auth',
  'x-client-token',
  'x-api-key',
  'cookie',
  'set-cookie',
])

const REDACTED = '***REDACTED***'

export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = REDACTED
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

export function sanitizeMeta(meta: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = REDACTED
    } else if (typeof value === 'string' && looksLikeToken(value)) {
      sanitized[key] = REDACTED
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeMeta(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

function looksLikeToken(value: string): boolean {
  // Heuristic: long strings of alphanumeric chars that look like API keys/tokens
  if (value.length < 20) return false
  // Skip message content
  if (value.length > 500) return false
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(value)
    || /^[A-Za-z0-9_-]{32,}$/.test(value)
}

export function sanitizeBody(body: unknown, maxContentLength = 200): unknown {
  if (typeof body === 'string') {
    return body.length > maxContentLength ? body.slice(0, maxContentLength) + '...' : body
  }
  if (Array.isArray(body)) {
    return body.map((item) => sanitizeBody(item, maxContentLength))
  }
  if (typeof body === 'object' && body !== null) {
    const sanitized: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(body as Record<string, unknown>)) {
      if (key === 'messages' && Array.isArray(value)) {
        sanitized[key] = `[${value.length} messages]`
      } else if (key === 'content' && typeof value === 'string') {
        sanitized[key] = value.length > maxContentLength ? value.slice(0, maxContentLength) + '...' : value
      } else {
        sanitized[key] = sanitizeBody(value, maxContentLength)
      }
    }
    return sanitized
  }
  return body
}
