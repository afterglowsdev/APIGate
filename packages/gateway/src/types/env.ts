import type { ClientConfig, GatewayConfig, ModelProfile } from './config.js'

/** Variables set on the Hono context by middleware */
export interface GatewayVariables {
  requestId: string
  client?: ClientConfig
  selectedModel?: string
  selectedProfile?: ModelProfile
  requestStartMs: number
}

/** Bindings available from the platform runtime */
export interface GatewayBindings {
  // Secrets
  NEW_API_TOKEN?: string
  ADMIN_PASSWORD?: string
  ADMIN_JWT_SECRET?: string
  ENCRYPTION_KEY?: string

  // General env
  NEW_API_BASE_URL?: string
  CONFIG_STORE_TYPE?: string
  CONFIG_FILE_PATH?: string
  USAGE_STORE_TYPE?: string
  USAGE_FILE_PATH?: string
  RATE_LIMIT_STORE_TYPE?: string
  REDIS_URL?: string
  LOG_LEVEL?: string
  NODE_ENV?: string
  GATEWAY_CONFIG_JSON?: string

  // Cloudflare KV namespaces
  CONFIG_KV?: KVNamespace
  USAGE_KV?: KVNamespace
  RATE_LIMIT_KV?: KVNamespace
}

/** Cloudflare Workers KV-like interface */
export interface KVNamespace {
  get(key: string, type?: 'text' | 'json' | 'arrayBuffer'): Promise<string | object | ArrayBuffer | null>
  put(key: string, value: string | ArrayBuffer, options?: { expirationTtl?: number }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number }): Promise<{ keys: { name: string }[] }>
}

/** Configuration for the gateway runtime (derived from env vars) */
export interface RuntimeConfig {
  newApiBaseUrl: string
  newApiToken: string
  adminPassword: string
  adminJwtSecret: string
  encryptionKey: string
  configStoreType: string
  configFilePath: string
  usageStoreType: string
  usageFilePath: string
  rateLimitStoreType: string
  redisUrl: string
  logLevel: string
  nodeEnv: string
  gatewayConfigJson: string
}
