import type { MiddlewareHandler } from 'hono'
import type { IRateLimitStore } from '../interfaces/rate-limit-store.js'
import { getClientIP } from '../utils/request.js'
import type { Logger } from './logger.js'
import { RateLimitError } from '../types/errors.js'

export function createRateLimitMiddleware(rateLimitStore: IRateLimitStore, logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const client = c.get('client')
    if (!client) { await next(); return }

    const clientId = client.id
    const ip = getClientIP(c.req.raw.headers)
    const rateLimit = client.rateLimitPerMinute

    if (rateLimit <= 0) { await next(); return }

    const windowMs = 60_000 // 1 minute

    // Check multiple dimensions
    const keys = [
      `rate:client:${clientId}`,
      `rate:ip:${ip}`,
      `rate:client+ip:${clientId}:${ip}`,
    ]

    let earliestReset = 0
    let minRemaining = rateLimit

    for (const key of keys) {
      const result = await rateLimitStore.hit(key, windowMs, rateLimit)
      if (!result.allowed) {
        logger.warn('Rate limit exceeded', { clientId, key, remaining: result.remaining })
        throw new RateLimitError(
          `Rate limit exceeded. Try again later.`,
          Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
        )
      }
      minRemaining = Math.min(minRemaining, result.remaining)
      if (earliestReset === 0 || result.reset < earliestReset) {
        earliestReset = result.reset
      }
    }

    // Set rate limit headers
    c.res.headers.set('X-RateLimit-Limit', String(rateLimit))
    c.res.headers.set('X-RateLimit-Remaining', String(minRemaining))
    c.res.headers.set('X-RateLimit-Reset', String(Math.ceil(earliestReset / 1000)))

    await next()
  }
}
