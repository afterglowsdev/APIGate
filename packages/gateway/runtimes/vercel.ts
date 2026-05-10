/**
 * Vercel Serverless Functions Runtime Adapter / Vercel Serverless 运行时适配
 */

import { createApp } from '../src/app.js'
import { EnvConfigStore } from '../src/stores/config/env.js'
import { MemoryUsageStore } from '../src/stores/usage/memory.js'
import { MemoryRateLimitStore } from '../src/stores/rate-limit/memory.js'
import { MemoryDeviceStore } from '../src/stores/device/memory.js'

export default async function handler(req: Request): Promise<Response> {
  const app = createApp({
    configStore: new EnvConfigStore(process.env.GATEWAY_CONFIG_JSON || ''),
    usageStore: new MemoryUsageStore(),
    rateLimitStore: new MemoryRateLimitStore(),
    deviceStore: new MemoryDeviceStore(),
    newApiBaseUrl: process.env.NEW_API_BASE_URL || '',
    newApiToken: process.env.NEW_API_TOKEN || '',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin',
    adminJwtSecret: process.env.ADMIN_JWT_SECRET || 'change-me',
    logLevel: (process.env.LOG_LEVEL as 'info') || 'info',
    logFormat: 'json',
    isDev: false,
  })

  return app.fetch(req)
}
