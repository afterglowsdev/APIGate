/**
 * Vercel Serverless Functions Runtime Adapter
 *
 * Deploy with vercel.json:
 * {
 *   "functions": {
 *     "api/**\/*.ts": {
 *       "runtime": "@vercel/node@3"
 *     }
 *   }
 * }
 */

import { createApp } from '../src/app.js'
import { EnvConfigStore } from '../src/stores/config/env.js'
import { MemoryUsageStore } from '../src/stores/usage/memory.js'
import { MemoryRateLimitStore } from '../src/stores/rate-limit/memory.js'

export default async function handler(req: Request): Promise<Response> {
  const newApiBaseUrl = process.env.NEW_API_BASE_URL || ''
  const newApiToken = process.env.NEW_API_TOKEN || ''
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
  const adminJwtSecret = process.env.ADMIN_JWT_SECRET || 'change-me'
  const gatewayConfigJson = process.env.GATEWAY_CONFIG_JSON || ''

  const app = createApp({
    configStore: new EnvConfigStore(gatewayConfigJson),
    usageStore: new MemoryUsageStore(),
    rateLimitStore: new MemoryRateLimitStore(),
    newApiBaseUrl,
    newApiToken,
    adminPassword,
    adminJwtSecret,
    logLevel: (process.env.LOG_LEVEL as 'info') || 'info',
    logFormat: 'json',
    isDev: false,
    adminDistPath: undefined,
  })

  return app.fetch(req)
}
