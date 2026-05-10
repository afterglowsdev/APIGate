import type { Hono } from 'hono'
import type { GatewayVariables, GatewayBindings } from '../types/env.js'
import type { IConfigStore } from '../interfaces/config-store.js'
import type { IUsageStore } from '../interfaces/usage-store.js'
import type { IRateLimitStore } from '../interfaces/rate-limit-store.js'
import type { IDeviceStore } from '../interfaces/device-store.js'
import type { Logger } from '../services/logger.js'
import { createAuthMiddleware } from '../services/auth.js'
import { createQuotaMiddleware } from '../services/quota.js'
import { createRateLimitMiddleware } from '../services/rate-limit.js'
import { createModelSelectMiddleware } from '../services/model-router.js'
import { createProxyHandler } from '../services/proxy.js'
import { getClientIP } from '../utils/request.js'
import { hashIp } from '../utils/crypto.js'
import { generateRequestId } from '../utils/id.js'
import type { MiddlewareHandler } from 'hono'

export function registerProxyRoute(
  app: Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>,
  configStore: IConfigStore,
  usageStore: IUsageStore,
  rateLimitStore: IRateLimitStore,
  deviceStore: IDeviceStore,
  logger: Logger,
  newApiToken: string,
  newApiBaseUrl: string,
) {
  const auth = createAuthMiddleware(configStore, deviceStore, logger)
  const quota = createQuotaMiddleware(usageStore, configStore, logger)
  const rateLimit = createRateLimitMiddleware(rateLimitStore, logger)
  const modelSelect = createModelSelectMiddleware(configStore, logger)
  const proxyHandler = createProxyHandler(configStore, logger, newApiToken, newApiBaseUrl)

  const requestLogger: MiddlewareHandler = async (c, next) => {
    const requestId = generateRequestId()
    c.set('requestId', requestId)
    const ip = getClientIP(c.req.raw.headers)
    logger.info('Request received', {
      requestId,
      method: c.req.method,
      path: c.req.path,
      appId: c.req.header('X-App-Id') || '-',
      deviceId: c.req.header('X-Device-Id') || '-',
      ipHash: hashIp(ip),
    })
    await next()
  }

  // Chain: requestLogger → auth → quota → rate-limit → model-select → proxy
  // 中间件链：日志 → 鉴权 → 额度 → 限流 → 模型选择 → 代理
  app.post('/v1/chat/completions', requestLogger, auth, quota, rateLimit, modelSelect, (c) => proxyHandler(c))
}
