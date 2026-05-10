import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { GatewayConfig } from '../../types/config.js'
import { DEFAULT_GATEWAY_CONFIG } from '../../types/config.js'
import type { IConfigStore } from '../../interfaces/config-store.js'

/** Migrate old "clients" field to new "apps" field / 将旧 clients 字段迁移为新 apps 字段 */
function migrateConfig(raw: Record<string, unknown>): Record<string, unknown> {
  if (Array.isArray(raw.clients) && !Array.isArray(raw.apps)) {
    console.log('[gateway] Migrating old "clients" config to new "apps" format')
    raw.apps = (raw.clients as Record<string, unknown>[]).map((c: Record<string, unknown>) => ({
      appId: c.id || c.appId || 'unknown',
      name: c.name || 'Migrated App',
      enabled: c.enabled ?? true,
      requireAppSecret: false,
      appSecret: c.token || '',
      autoRegisterDevices: true,
      allowAnonymousDevices: true,
      identifiers: [
        { header: 'X-Device-Id', type: 'device', required: true, track: true },
        { header: 'user_id', type: 'user', required: false, track: true },
      ],
      defaultProfile: (c as any).defaultProfile || '',
      allowedProfiles: c.allowedProfiles || [],
      perDeviceDailyQuota: c.dailyQuota || 0,
      perDeviceMonthlyQuota: c.monthlyQuota || 0,
      perDeviceRateLimitPerMinute: c.rateLimitPerMinute || 0,
      perIpRateLimitPerMinute: 0,
      globalRateLimitPerMinute: 0,
    }))
    delete raw.clients
  }
  return raw
}

export class FileConfigStore implements IConfigStore {
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async getConfig(): Promise<GatewayConfig> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      const parsed = JSON.parse(raw) as Record<string, unknown>
      const migrated = migrateConfig(parsed)
      // Save migrated config back / 回写迁移后的配置
      if (migrated !== parsed) {
        await this.saveConfig(migrated as unknown as GatewayConfig)
      }
      return migrated as unknown as GatewayConfig
    } catch {
      const defaults = structuredClone(DEFAULT_GATEWAY_CONFIG)
      await this.saveConfig(defaults)
      return structuredClone(defaults)
    }
  }

  async saveConfig(config: GatewayConfig): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const tempPath = this.filePath + '.tmp'
    await writeFile(tempPath, JSON.stringify(config, null, 2), 'utf-8')
    await rename(tempPath, this.filePath)
  }
}
