import type { GatewayConfig } from '../../types/config.js'
import { DEFAULT_GATEWAY_CONFIG } from '../../types/config.js'
import type { IConfigStore } from '../../interfaces/config-store.js'

export class EnvConfigStore implements IConfigStore {
  private configJson: string

  constructor(configJson?: string) {
    this.configJson = configJson || ''
  }

  async getConfig(): Promise<GatewayConfig> {
    if (!this.configJson) {
      return structuredClone(DEFAULT_GATEWAY_CONFIG)
    }
    try {
      const parsed = JSON.parse(this.configJson) as Partial<GatewayConfig>
      const defaults = structuredClone(DEFAULT_GATEWAY_CONFIG)
      return { ...defaults, ...parsed } as GatewayConfig
    } catch {
      return structuredClone(DEFAULT_GATEWAY_CONFIG)
    }
  }

  async saveConfig(_config: GatewayConfig): Promise<void> {
    // EnvConfigStore is read-only — config is set via environment variable
  }
}
