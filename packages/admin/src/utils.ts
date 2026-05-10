export function generateToken(length = 32): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join('')
}

export function maskToken(token: string, showLast = 4): string {
  if (!token) return ''
  if (token.length <= showLast) return '****'
  return '****' + token.slice(-showLast)
}
