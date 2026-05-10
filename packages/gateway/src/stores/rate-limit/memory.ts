import type { IRateLimitStore, RateLimitResult } from '../../interfaces/rate-limit-store.js'

interface RateLimitEntry {
  count: number
  windowStart: number
}

export class MemoryRateLimitStore implements IRateLimitStore {
  private store = new Map<string, RateLimitEntry>()

  async hit(key: string, windowMs: number, limit: number): Promise<RateLimitResult> {
    const now = Date.now()
    const windowKey = `${key}:${Math.floor(now / windowMs)}`
    const entry = this.store.get(windowKey)

    const windowStart = Math.floor(now / windowMs) * windowMs
    const reset = windowStart + windowMs

    if (!entry || now - entry.windowStart >= windowMs) {
      this.store.set(windowKey, { count: 1, windowStart })
      return { allowed: true, remaining: limit - 1, reset }
    }

    entry.count++
    const remaining = Math.max(0, limit - entry.count)
    return {
      allowed: entry.count <= limit,
      remaining,
      reset,
    }
  }
}
