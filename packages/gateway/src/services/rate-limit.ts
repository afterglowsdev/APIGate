/**
 * Rate limiting middleware / 限流中间件
 *
 * Rate limit keys / 限流 Key:
 *   app:{appId}                            — global app rate limit / 应用全局限流
 *   app:{appId}:device:{deviceId}          — per-device rate limit / 设备限流
 *   app:{appId}:ip:{ipHash}               — per-IP rate limit / IP 限流
 *   app:{appId}:device:{deviceId}:profile:{profile} — per-device+profile / 设备+档位限流
 */

import type { MiddlewareHandler } from 'hono'
import type { IRateLimitStore } from '../interfaces/rate-limit-store.js'
import { getClientIP } from '../utils/request.js'
import { hashIp } from '../utils/crypto.js'
import type { Logger } from './logger.js'
import { RateLimitError } from '../types/errors.js'

export function createRateLimitMiddleware(rateLimitStore: IRateLimitStore, logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const app = c.get('app')
    if (!app) { await next(); return }

    const deviceId = c.get('deviceId')
    const ip = getClientIP(c.req.raw.headers)
    const ipHashed = hashIp(ip)
    const profileName = c.get('selectedProfileName') as string | undefined

    const windowMs = 60_000 // 1 minute window / 1 分钟窗口
    let earliestReset = 0
    let minRemaining = Infinity

    // Build rate limit checks dynamically based on app config
    const checks: { key: string; limit: number }[] = []

    // Global app rate limit / 应用全局限流
    if (app.globalRateLimitPerMinute > 0) {
      checks.push({ key: `app:${app.appId}`, limit: app.globalRateLimitPerMinute })
    }

    // Per-device rate limit / 设备限流
    if (app.perDeviceRateLimitPerMinute > 0 && deviceId) {
      checks.push({ key: `app:${app.appId}:device:${deviceId}`, limit: app.perDeviceRateLimitPerMinute })
    }

    // Per-IP rate limit / IP 限流
    if (app.perIpRateLimitPerMinute > 0) {
      checks.push({ key: `app:${app.appId}:ip:${ipHashed}`, limit: app.perIpRateLimitPerMinute })
    }

    // Per-device+profile rate limit / 设备+档位限流
    if (app.perDeviceRateLimitPerMinute > 0 && deviceId && profileName) {
      const profileLimit = Math.max(1, Math.floor(app.perDeviceRateLimitPerMinute / 2))
      checks.push({ key: `app:${app.appId}:device:${deviceId}:profile:${profileName}`, limit: profileLimit })
    }

    // Execute all checks / 执行所有限流检查
    for (const { key, limit } of checks) {
      const result = await rateLimitStore.hit(key, windowMs, limit)
      if (!result.allowed) {
        logger.warn('Rate limit exceeded', { appId: app.appId, deviceId, key, limit })
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

    if (checks.length > 0) {
      c.res.headers.set('X-RateLimit-Limit', String(Math.max(...checks.map(c => c.limit))))
      c.res.headers.set('X-RateLimit-Remaining', String(minRemaining === Infinity ? 0 : minRemaining))
      c.res.headers.set('X-RateLimit-Reset', String(Math.ceil(earliestReset / 1000)))
    }

    await next()
  }
}
