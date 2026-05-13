/**
 * Netlify Functions Runtime Adapter
 *
 * Supports both:
 * 1. Modern Netlify Functions, which pass a standard Request object
 * 2. Legacy Lambda-style event objects
 */

import { createApp } from '../src/app.js'
import { NetlifyBlobsConfigStore } from '../src/stores/config/netlify-blobs.js'
import { MemoryUsageStore } from '../src/stores/usage/memory.js'
import { MemoryRateLimitStore } from '../src/stores/rate-limit/memory.js'
import { NetlifyBlobsDeviceStore } from '../src/stores/device/netlify-blobs.js'

interface NetlifyEvent {
  rawUrl?: string
  url?: string
  path?: string
  httpMethod: string
  headers: Record<string, string>
  body?: string
  isBase64Encoded?: boolean
}

function createGatewayApp() {
  return createApp({
    configStore: new NetlifyBlobsConfigStore('gateway-config'),
    usageStore: new MemoryUsageStore(),
    rateLimitStore: new MemoryRateLimitStore(),
    deviceStore: new NetlifyBlobsDeviceStore('gateway-devices'),
    newApiBaseUrl: process.env.NEW_API_BASE_URL || '',
    newApiToken: process.env.NEW_API_TOKEN || '',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin',
    adminJwtSecret: process.env.ADMIN_JWT_SECRET || 'change-me',
    logLevel: (process.env.LOG_LEVEL as 'info') || 'info',
    logFormat: 'json',
    isDev: false,
  })
}

function toRequest(event: NetlifyEvent): Request {
  const headers = new Headers(event.headers || {})
  const host = headers.get('host')
  const proto = headers.get('x-forwarded-proto') || 'https'
  const url = event.rawUrl || event.url || (host && event.path ? `${proto}://${host}${event.path}` : '')

  if (!url) {
    throw new TypeError('Netlify event did not include a usable request URL')
  }

  const body = event.body
    ? (event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body)
    : undefined

  return new Request(url, {
    method: event.httpMethod,
    headers,
    body,
  })
}

async function toLambdaResponse(resp: Response): Promise<{
  statusCode: number
  headers: Record<string, string>
  body: string
}> {
  const body = await resp.text()
  const headers: Record<string, string> = {}
  resp.headers.forEach((value, key) => {
    headers[key] = value
  })
  return { statusCode: resp.status, headers, body }
}

export default async function handler(
  reqOrEvent: Request | NetlifyEvent,
): Promise<Response | { statusCode: number; headers: Record<string, string>; body: string }> {
  const app = createGatewayApp()

  if (reqOrEvent instanceof Request) {
    return app.fetch(reqOrEvent)
  }

  const req = toRequest(reqOrEvent)
  const resp = await app.fetch(req)
  return toLambdaResponse(resp)
}
