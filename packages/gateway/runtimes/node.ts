/**
 * Node.js Runtime Adapter
 *
 * Primary development and production target for:
 * - Local development (Windows/Linux/macOS)
 * - Docker deployments
 * - Zeabur / Railway / any Node.js hosting
 *
 * Usage:
 *   pnpm dev          # tsx watch src/runtimes/node.ts
 *   pnpm build && pnpm start   # production
 */

import { serve } from '@hono/node-server'
import { createApp } from '../src/app.js'
import { MemoryConfigStore } from '../src/stores/config/memory.js'
import { FileConfigStore } from '../src/stores/config/file.js'
import { EnvConfigStore } from '../src/stores/config/env.js'
import { MemoryUsageStore } from '../src/stores/usage/memory.js'
import { FileUsageStore } from '../src/stores/usage/file.js'
import { MemoryRateLimitStore } from '../src/stores/rate-limit/memory.js'
import { MemoryDeviceStore } from '../src/stores/device/memory.js'
import { FileDeviceStore } from '../src/stores/device/file.js'
import type { IConfigStore } from '../src/interfaces/config-store.js'
import type { IUsageStore } from '../src/interfaces/usage-store.js'
import type { IRateLimitStore } from '../src/interfaces/rate-limit-store.js'
import type { IDeviceStore } from '../src/interfaces/device-store.js'
import type { LogLevel, LogFormat } from '../src/services/logger.js'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// ---- Load secrets from local secret.json or environment variables ----

async function loadSecrets(): Promise<Record<string, string>> {
  const secrets: Record<string, string> = {}

  // Try loading from secret.json (local dev convenience)
  // Search: same dir as node.ts, then CWD
  const searchPaths = [
    resolve(__dirname, '..', 'secret.json'),           // packages/gateway/secret.json (RELATIVE TO FILE)
    resolve(process.cwd(), 'secret.json'),              // CWD/secret.json
    resolve(process.cwd(), 'packages', 'gateway', 'secret.json'), // root/packages/gateway/secret.json
  ]
  let secretPath = ''
  for (const p of searchPaths) {
    if (existsSync(p)) { secretPath = p; break }
  }

  if (secretPath) {
    try {
      const raw = await readFile(secretPath, 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, string>
      Object.assign(secrets, parsed)
      console.log('[gateway] Loaded secrets from:', secretPath)
    } catch {
      console.warn('[gateway] Failed to parse secret.json, falling back to env vars')
    }
  } else {
    console.log('[gateway] No secret.json found, using env vars')
    console.log('[gateway] Searched:', searchPaths)
  }

  // Env vars take precedence
  for (const key of ['NEW_API_BASE_URL', 'NEW_API_TOKEN', 'ADMIN_PASSWORD', 'ADMIN_JWT_SECRET',
    'CONFIG_STORE_TYPE', 'CONFIG_FILE_PATH', 'USAGE_STORE_TYPE', 'USAGE_FILE_PATH',
    'RATE_LIMIT_STORE_TYPE', 'REDIS_URL', 'LOG_LEVEL', 'NODE_ENV', 'GATEWAY_CONFIG_JSON']) {
    const envVal = process.env[key]
    if (envVal) {
      secrets[key] = envVal
    }
  }

  return secrets
}

// ---- Store factory ----

function createConfigStore(secrets: Record<string, string>): IConfigStore {
  const type = secrets.CONFIG_STORE_TYPE || 'file'
  switch (type) {
    case 'file': {
      const path = secrets.CONFIG_FILE_PATH || './data/gateway-config.json'
      console.log(`[gateway] Using FileConfigStore: ${path}`)
      return new FileConfigStore(path)
    }
    case 'env':
      console.log('[gateway] Using EnvConfigStore (read-only)')
      return new EnvConfigStore(secrets.GATEWAY_CONFIG_JSON)
    case 'memory':
    default:
      console.log('[gateway] Using MemoryConfigStore (data lost on restart)')
      return new MemoryConfigStore()
  }
}

function createUsageStore(secrets: Record<string, string>): IUsageStore {
  const type = secrets.USAGE_STORE_TYPE || 'memory'
  switch (type) {
    case 'file': {
      const path = secrets.USAGE_FILE_PATH || './data/gateway-usage.json'
      console.log(`[gateway] Using FileUsageStore: ${path}`)
      return new FileUsageStore(path)
    }
    case 'memory':
    default:
      console.log('[gateway] Using MemoryUsageStore')
      return new MemoryUsageStore()
  }
}

function createRateLimitStore(_secrets: Record<string, string>): IRateLimitStore {
  console.log('[gateway] Using MemoryRateLimitStore')
  return new MemoryRateLimitStore()
}

function createDeviceStore(secrets: Record<string, string>): IDeviceStore {
  const type = secrets.DEVICE_STORE_TYPE || 'memory'
  switch (type) {
    case 'file': {
      const path = secrets.DEVICE_FILE_PATH || './data/gateway-devices.json'
      console.log(`[gateway] Using FileDeviceStore: ${path}`)
      return new FileDeviceStore(path)
    }
    case 'memory':
    default:
      console.log('[gateway] Using MemoryDeviceStore')
      return new MemoryDeviceStore()
  }
}

// ---- Main ----

async function main() {
  const secrets = await loadSecrets()

  const newApiBaseUrl = secrets.NEW_API_BASE_URL || 'http://localhost:8080'
  const newApiToken = secrets.NEW_API_TOKEN || 'change-me'
  const adminPassword = secrets.ADMIN_PASSWORD || 'admin'
  const adminJwtSecret = secrets.ADMIN_JWT_SECRET || 'gateway-jwt-secret-change-me'
  const logLevel = (secrets.LOG_LEVEL || 'info') as LogLevel
  const logFormat: LogFormat = secrets.NODE_ENV === 'production' ? 'json' : 'pretty'
  const isDev = secrets.NODE_ENV !== 'production'

  if (!secrets.NEW_API_TOKEN) {
    console.warn('[gateway] WARNING: NEW_API_TOKEN not set. Set it in secret.json or environment variable.')
  }

  const configStore = createConfigStore(secrets)
  const usageStore = createUsageStore(secrets)
  const rateLimitStore = createRateLimitStore(secrets)
  const deviceStore = createDeviceStore(secrets)

  const app = createApp({
    configStore,
    usageStore,
    rateLimitStore,
    deviceStore,
    newApiBaseUrl,
    newApiToken,
    adminPassword,
    adminJwtSecret,
    logLevel,
    logFormat,
    isDev,
    adminDistPath: isDev ? undefined : resolve(process.cwd(), '../admin/dist'),
  })

  const port = parseInt(process.env.PORT || '3000', 10)

  console.log(`[gateway] Starting on http://localhost:${port}`)
  console.log(`[gateway] Admin GUI: http://localhost:${port}/admin`)

  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`[gateway] Listening on http://localhost:${info.port}`)
  })
}

main().catch((err) => {
  console.error('[gateway] Fatal error:', err)
  process.exit(1)
})
