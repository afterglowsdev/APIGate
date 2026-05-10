/**
 * Netlify Functions Runtime Adapter
 *
 * Deploy with netlify.toml:
 * [functions]
 * node_bundler = "esbuild"
 */

import { createApp } from '../src/app.js'
import { EnvConfigStore } from '../src/stores/config/env.js'
import { MemoryUsageStore } from '../src/stores/usage/memory.js'
import { MemoryRateLimitStore } from '../src/stores/rate-limit/memory.js'

interface NetlifyEvent {
  rawUrl: string
  httpMethod: string
  headers: Record<string, string>
  body?: string
  isBase64Encoded?: boolean
}

export default async function handler(event: NetlifyEvent): Promise<{
  statusCode: number
  headers: Record<string, string>
  body: string
}> {
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

  const req = new Request(event.rawUrl, {
    method: event.httpMethod,
    headers: new Headers(event.headers),
    body: event.body ? event.body : undefined,
  })

  const resp = await app.fetch(req)
  const respBody = await resp.text()

  const headers: Record<string, string> = {}
  resp.headers.forEach((value, key) => {
    headers[key] = value
  })

  return {
    statusCode: resp.status,
    headers,
    body: respBody,
  }
}
