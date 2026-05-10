/**
 * Quota middleware — per-device daily/monthly limits / 设备额度中间件
 *
 * Quota is tracked per (app, device), not per manually-configured client token.
 * 额度按 (app, device) 维度统计，而非手动配置的 client token。
 */

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
    const app = c.get('app')
    const deviceId = c.get('deviceId')
    if (!app) { await next(); return }

    const deviceKey = deviceId ? `d:${app.appId}:${deviceId}` : `a:${app.appId}`

    // Pre-check daily quota / 每日额度预检查
    if (app.perDeviceDailyQuota > 0) {
      const dayUsage = await usageStore.getUsage(deviceKey, 'day')
      if (dayUsage.requests >= app.perDeviceDailyQuota) {
        logger.warn('Daily quota exceeded', { appId: app.appId, deviceId, dailyQuota: app.perDeviceDailyQuota })
        throw new QuotaExceededError(`Daily quota of ${app.perDeviceDailyQuota} requests exceeded`)
      }
    }

    // Pre-check monthly quota / 每月额度预检查
    if (app.perDeviceMonthlyQuota > 0) {
      const monthUsage = await usageStore.getUsage(deviceKey, 'month')
      if (monthUsage.requests >= app.perDeviceMonthlyQuota) {
        logger.warn('Monthly quota exceeded', { appId: app.appId, deviceId, monthlyQuota: app.perDeviceMonthlyQuota })
        throw new QuotaExceededError(`Monthly quota of ${app.perDeviceMonthlyQuota} requests exceeded`)
      }
    }

    await next()

    // Post-increment on success / 成功后计数
    if (c.res && c.res.ok) {
      await usageStore.incrementUsage(deviceKey, { requests: 1 })
    }
  }
}
