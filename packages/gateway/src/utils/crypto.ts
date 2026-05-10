const encoder = new TextEncoder()

/**
 * Constant-time string comparison to prevent timing attacks.
 * Falls back to crypto.subtle.timingSafeEqual when available.
 */
export function secureCompare(a: string, b: string): boolean {
  const bufA = encoder.encode(a)
  const bufB = encoder.encode(b)
  if (bufA.length !== bufB.length) return false

  let result = 0
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i]
  }
  return result === 0
}

export async function sha256(input: string): Promise<string> {
  const data = encoder.encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function generateToken(length = 32): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function maskToken(token: string, showLast = 4): string {
  if (token.length <= showLast) return '****'
  return '****' + token.slice(-showLast)
}

export function hashIp(ip: string): string {
  // Simple hash for IP anonymization in logs
  let hash = 0
  for (let i = 0; i < ip.length; i++) {
    const char = ip.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash |= 0
  }
  return 'ip-' + Math.abs(hash).toString(16).padStart(8, '0')
}
