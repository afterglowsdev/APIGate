import type { IConfigStore } from '../interfaces/config-store.js'
import type { IUsageStore } from '../interfaces/usage-store.js'
import type { IRateLimitStore } from '../interfaces/rate-limit-store.js'

export interface RuntimeAdapter {
  name: string
  createConfigStore(): IConfigStore
  createUsageStore(): IUsageStore
  createRateLimitStore(): IRateLimitStore
}
