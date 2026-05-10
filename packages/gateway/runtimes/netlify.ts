/**
 * Netlify Functions Runtime Adapter / Netlify Functions 运行时适配
 *
 * Uses Netlify Blobs for persistent storage — no external Redis needed.
 * 使用 Netlify Blobs 实现持久化存储，无需外部 Redis。
 */

import { createApp } from '../src/app.js'
import { NetlifyBlobsConfigStore } from '../src/stores/config/netlify-blobs.js'
import { MemoryUsageStore } from '../src/stores/usage/memory.js'
import { MemoryRateLimitStore } from '../src/stores/rate-limit/memory.js'
import { NetlifyBlobsDeviceStore } from '../src/stores/device/netlify-blobs.js'

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
    // Netlify Blobs — persistent, no external service needed
    configStore: new NetlifyBlobsConfigStore('gateway-config'),
    // Usage and rate-limit still use memory in MVP (acceptable for single-function)
    usageStore: new MemoryUsageStore(),
    rateLimitStore: new MemoryRateLimitStore(),
    // Device records persisted via Blobs
    deviceStore: new NetlifyBlobsDeviceStore('gateway-devices'),
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
