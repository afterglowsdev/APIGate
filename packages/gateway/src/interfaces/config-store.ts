import type { GatewayConfig } from '../types/config.js'

export interface IConfigStore {
  getConfig(): Promise<GatewayConfig>
  saveConfig(config: GatewayConfig): Promise<void>
}
