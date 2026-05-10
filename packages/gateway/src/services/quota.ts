import type { MiddlewareHandler } from 'hono'
import type { IConfigStore } from '../interfaces/config-store.js'
import type { IUsageStore } from '../interfaces/usage-store.js'
import type { Logger } from './logger.js'
import { QuotaExceededError } from '../types/errors.js'

export function createQuotaMiddleware(
  usageStore: IUsageStore,
  _configStore: IConfigStore,
  logger: Logger,
): MiddlewareHandler {
  return async (c, next) => {
    const client = c.get('client')
    if (!client) { await next(); return }

    const clientKey = `client:${client.id}`

    // Pre-check daily quota
    if (client.dailyQuota > 0) {
      const dayUsage = await usageStore.getUsage(clientKey, 'day')
      if (dayUsage.requests >= client.dailyQuota) {
        logger.warn('Daily quota exceeded', { clientId: client.id, dailyQuota: client.dailyQuota })
        throw new QuotaExceededError(`Daily quota of ${client.dailyQuota} requests exceeded`)
      }
    }

    // Pre-check monthly quota
    if (client.monthlyQuota > 0) {
      const monthUsage = await usageStore.getUsage(clientKey, 'month')
      if (monthUsage.requests >= client.monthlyQuota) {
        logger.warn('Monthly quota exceeded', { clientId: client.id, monthlyQuota: client.monthlyQuota })
        throw new QuotaExceededError(`Monthly quota of ${client.monthlyQuota} requests exceeded`)
      }
    }

    await next()

    // Post-increment on success
    if (c.res && c.res.ok) {
      await usageStore.incrementUsage(clientKey, { requests: 1 })
    }
  }
}
