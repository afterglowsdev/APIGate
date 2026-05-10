/**
 * Netlify Blobs ConfigStore — persistent storage native to Netlify
 * 使用 Netlify Blobs 实现配置持久化，无需外部 Redis 或数据库
 */

import type { GatewayConfig } from '../../types/config.js'
import { DEFAULT_GATEWAY_CONFIG } from '../../types/config.js'
import type { IConfigStore } from '../../interfaces/config-store.js'

// Lazy-load @netlify/blobs to avoid import errors on other platforms
async function getBlobStore(storeName: string) {
  const { getStore } = await import('@netlify/blobs')
  return getStore(storeName)
}

export class NetlifyBlobsConfigStore implements IConfigStore {
  private storeName: string

  constructor(storeName = 'gateway-config') {
    this.storeName = storeName
  }

  async getConfig(): Promise<GatewayConfig> {
    try {
      const store = await getBlobStore(this.storeName)
      const data = await store.get('config', { type: 'json' }) as GatewayConfig | null
      if (data) return data
    } catch {
      // Blob not found or first access — return defaults
    }
    const defaults = structuredClone(DEFAULT_GATEWAY_CONFIG)
    // Save defaults so the store is initialised
    try { await this.saveConfig(defaults) } catch { /* ignore */ }
    return structuredClone(defaults)
  }

  async saveConfig(config: GatewayConfig): Promise<void> {
    const store = await getBlobStore(this.storeName)
    await store.set('config', JSON.stringify(config))
  }
}
