import type { GatewayConfig } from '../../types/config.js'
import { DEFAULT_GATEWAY_CONFIG } from '../../types/config.js'
import type { IConfigStore } from '../../interfaces/config-store.js'

export class MemoryConfigStore implements IConfigStore {
  private config: GatewayConfig

  constructor(initialConfig?: GatewayConfig) {
    this.config = initialConfig ? structuredClone(initialConfig) : structuredClone(DEFAULT_GATEWAY_CONFIG)
  }

  async getConfig(): Promise<GatewayConfig> {
    return structuredClone(this.config)
  }

  async saveConfig(config: GatewayConfig): Promise<void> {
    this.config = structuredClone(config)
  }
}
