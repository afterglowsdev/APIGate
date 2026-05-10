/**
 * Netlify Functions Runtime Adapter / Netlify Functions 运行时适配
 */

import { createApp } from '../src/app.js'
import { EnvConfigStore } from '../src/stores/config/env.js'
import { MemoryUsageStore } from '../src/stores/usage/memory.js'
import { MemoryRateLimitStore } from '../src/stores/rate-limit/memory.js'
import { MemoryDeviceStore } from '../src/stores/device/memory.js'

interface NetlifyEvent {
  rawUrl: string
  httpMethod: string
  headers: Record<string, string>
  body?: string
}

export default async function handler(event: NetlifyEvent): Promise<{
  statusCode: number; headers: Record<string, string>; body: string
}> {
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

  const req = new Request(event.rawUrl, {
    method: event.httpMethod,
    headers: new Headers(event.headers),
    body: event.body || undefined,
  })

  const resp = await app.fetch(req)
  const respBody = await resp.text()
  const headers: Record<string, string> = {}
  resp.headers.forEach((v, k) => { headers[k] = v })

  return { statusCode: resp.status, headers, body: respBody }
}
