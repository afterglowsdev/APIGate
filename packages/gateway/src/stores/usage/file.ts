import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { UsageIncrement, UsageRecord, UsageWindow } from '../../types/usage.js'
import { windowStart } from '../../utils/time.js'
import type { IUsageStore } from '../../interfaces/usage-store.js'

interface UsageData {
  [key: string]: { count: number; windowStart: number }
}

export class FileUsageStore implements IUsageStore {
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  private async readData(): Promise<UsageData> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as UsageData
    } catch {
      return {}
    }
  }

  private async writeData(data: UsageData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const tempPath = this.filePath + '.tmp'
    await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    await rename(tempPath, this.filePath)
  }

  private makeKey(key: string, window: UsageWindow): string {
    const ws = windowStart(window)
    return `${key}:${window}:${ws}`
  }

  async getUsage(key: string, window: UsageWindow): Promise<UsageRecord> {
    const data = await this.readData()
    const storeKey = this.makeKey(key, window)
    const entry = data[storeKey]
    const ws = windowStart(window)
    if (!entry || entry.windowStart !== ws) {
      return { requests: 0, windowStart: ws }
    }
    return { requests: entry.count, windowStart: entry.windowStart }
  }

  async incrementUsage(key: string, usage: UsageIncrement): Promise<void> {
    const data = await this.readData()
    const windows: UsageWindow[] = ['minute', 'hour', 'day', 'month']
    const inc = usage.requests || 1
    for (const window of windows) {
      const storeKey = this.makeKey(key, window)
      const entry = data[storeKey]
      const ws = windowStart(window)
      if (!entry || entry.windowStart !== ws) {
        data[storeKey] = { count: inc, windowStart: ws }
      } else {
        entry.count += inc
      }
    }
    await this.writeData(data)
  }
}
