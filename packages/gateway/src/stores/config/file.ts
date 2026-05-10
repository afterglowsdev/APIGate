import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { GatewayConfig } from '../../types/config.js'
import { DEFAULT_GATEWAY_CONFIG } from '../../types/config.js'
import type { IConfigStore } from '../../interfaces/config-store.js'

export class FileConfigStore implements IConfigStore {
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  async getConfig(): Promise<GatewayConfig> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as GatewayConfig
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
