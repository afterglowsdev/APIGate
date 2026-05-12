/**
 * LLM API Secure Forwarding Gateway — Core App Factory
 * LLM API 安全转发网关 — 核心应用工厂
 *
 * Assembles stores, services, and routes into a complete Hono application.
 * Different platforms adapt by injecting different store implementations.
 * 将存储、服务、路由组装为完整的 Hono 应用。不同运行平台通过传入不同的 store 实现来适配。
 *
 * Request pipeline / 请求处理流程：
 * Request → CORS → global timing/logging → route matching → middleware chain → response
 *                                                               ↓
 *    POST /v1/chat/completions:  requestLogger → auth → quota → rate-limit → model-select → proxy
 *    /api/admin/*:               adminAuth → handler → JSON response
 *    /admin/*:                   SPA static files or proxy to Vite dev server
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { GatewayVariables, GatewayBindings } from './types/env.js'
import type { IConfigStore } from './interfaces/config-store.js'
import type { IUsageStore } from './interfaces/usage-store.js'
import type { IRateLimitStore } from './interfaces/rate-limit-store.js'
import type { IDeviceStore } from './interfaces/device-store.js'
import { createLogger } from './services/logger.js'
import type { Logger, LogLevel, LogFormat } from './services/logger.js'
import { registerHealthRoute } from './routes/health.js'
import { registerProxyRoute } from './routes/proxy.js'
import { registerAdminRoutes } from './routes/admin.js'
import { errorToResponse } from './utils/errors.js'
import { GatewayError } from './types/errors.js'
import { nowMs } from './utils/time.js'

type GatewayApp = Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>

export type RegisterAdminSpaRoutes = (
  app: GatewayApp,
  logger: Logger,
  isDev: boolean,
) => void

export interface GatewayOptions {
  configStore: IConfigStore
  usageStore: IUsageStore
  rateLimitStore: IRateLimitStore
  deviceStore: IDeviceStore
  newApiBaseUrl: string
  newApiToken: string
  adminPassword: string
  adminJwtSecret: string
  logLevel?: LogLevel
  logFormat?: LogFormat
  isDev?: boolean
  registerAdminSpaRoutes?: RegisterAdminSpaRoutes
}

export function createApp(options: GatewayOptions): GatewayApp {
  const {
    configStore,
    usageStore,
    rateLimitStore,
    deviceStore,
    newApiBaseUrl,
    newApiToken,
    adminPassword,
    adminJwtSecret,
    logLevel = 'info',
    logFormat = 'pretty',
    isDev = false,
    registerAdminSpaRoutes,
  } = options

  const logger = createLogger(logLevel, logFormat)

  const app = new Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>()

  // Global CORS for admin API
  app.use(
    '/api/admin/*',
    cors({
      origin: isDev ? ['http://localhost:5173'] : ['*'],
      credentials: true,
    }),
  )

  // Global request timing and logging
  app.use('*', async (c, next) => {
    const start = nowMs()
    c.set('requestStartMs', start)
    await next()
    const durationMs = nowMs() - start
    logger.info('Response sent', {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      durationMs,
    })
  })

  // Global error handler
  app.onError((err, c) => {
    logger.error('Unhandled error', {
      path: c.req.path,
      error: err instanceof Error ? err.message : String(err),
      stack: isDev && err instanceof Error ? err.stack : undefined,
    })
    return errorToResponse(c, err)
  })

  // 404 for unknown API paths
  app.use('/v1/*', async (c, next) => {
    await next()
    if (!c.res || c.res.status === 404) {
      return c.json(
        { error: { code: 'not_found', message: 'Not found' } },
        404,
      )
    }
  })

  // Register routes
  registerHealthRoute(app)
  registerProxyRoute(app, configStore, usageStore, rateLimitStore, deviceStore, logger, newApiToken, newApiBaseUrl)
  registerAdminRoutes(app, configStore, deviceStore, logger, adminPassword, adminJwtSecret, newApiToken, newApiBaseUrl)
  if (registerAdminSpaRoutes) {
    registerAdminSpaRoutes(app, logger, isDev)
  }

  // Fallback 404
  app.all('*', (c) => {
    return c.json(
      { error: { code: 'not_found', message: 'Not found' } },
      404 as never,
    )
  })

  logger.info('Gateway app created', {
    newApiBaseUrl,
    logLevel,
    isDev,
  })

  return app
}
