/**
 * Cloudflare Workers Runtime Adapter
 * Cloudflare Workers 运行时适配
 *
 * Deploy with / 部署命令:
 *   wrangler deploy
 */

import { createApp } from '../src/app.js'
import { MemoryConfigStore } from '../src/stores/config/memory.js'
import { MemoryUsageStore } from '../src/stores/usage/memory.js'
import { MemoryRateLimitStore } from '../src/stores/rate-limit/memory.js'
import { MemoryDeviceStore } from '../src/stores/device/memory.js'

interface Env {
  NEW_API_BASE_URL: string
  NEW_API_TOKEN: string
  ADMIN_PASSWORD: string
  ADMIN_JWT_SECRET: string
  LOG_LEVEL?: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const app = createApp({
      configStore: new MemoryConfigStore(),
      usageStore: new MemoryUsageStore(),
      rateLimitStore: new MemoryRateLimitStore(),
      deviceStore: new MemoryDeviceStore(),
      newApiBaseUrl: env.NEW_API_BASE_URL || '',
      newApiToken: env.NEW_API_TOKEN || '',
      adminPassword: env.ADMIN_PASSWORD || 'admin',
      adminJwtSecret: env.ADMIN_JWT_SECRET || 'change-me',
      logLevel: (env.LOG_LEVEL as 'info') || 'info',
      logFormat: 'json',
      isDev: false,
    })

    return app.fetch(request)
  },
}
