/**
 * Cloudflare Workers Runtime Adapter
 *
 * Deploy with:
 *   wrangler deploy
 *
 * Required bindings in wrangler.toml:
 *   [vars]
 *   NEW_API_BASE_URL = "..."
 *   ADMIN_JWT_SECRET = "..."
 *
 *   [[kv_namespaces]]
 *   binding = "CONFIG_KV"
 */

import { createApp } from '../src/app.js'
import { MemoryConfigStore } from '../src/stores/config/memory.js'
import { MemoryUsageStore } from '../src/stores/usage/memory.js'
import { MemoryRateLimitStore } from '../src/stores/rate-limit/memory.js'

interface Env {
  NEW_API_BASE_URL: string
  NEW_API_TOKEN: string
  ADMIN_PASSWORD: string
  ADMIN_JWT_SECRET: string
  LOG_LEVEL?: string
  CONFIG_KV?: KVNamespace
  USAGE_KV?: KVNamespace
  RATE_LIMIT_KV?: KVNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const newApiBaseUrl = env.NEW_API_BASE_URL || ''
    const newApiToken = env.NEW_API_TOKEN || ''
    const adminPassword = env.ADMIN_PASSWORD || 'admin'
    const adminJwtSecret = env.ADMIN_JWT_SECRET || 'change-me'

    const app = createApp({
      configStore: new MemoryConfigStore(),
      usageStore: new MemoryUsageStore(),
      rateLimitStore: new MemoryRateLimitStore(),
      newApiBaseUrl,
      newApiToken,
      adminPassword,
      adminJwtSecret,
      logLevel: (env.LOG_LEVEL as 'info') || 'info',
      logFormat: 'json',
      isDev: false,
      adminDistPath: undefined, // Admin is served via Cloudflare Pages separately
    })

    return app.fetch(request)
  },
}
