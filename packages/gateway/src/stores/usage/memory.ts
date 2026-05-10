import type { UsageIncrement, UsageRecord, UsageWindow } from '../../types/usage.js'
import { windowStart } from '../../utils/time.js'
import type { IUsageStore } from '../../interfaces/usage-store.js'

export class MemoryUsageStore implements IUsageStore {
  private store = new Map<string, { count: number; windowStart: number }>()

  private makeKey(key: string, window: UsageWindow): string {
    const ws = windowStart(window)
    return `${key}:${window}:${ws}`
  }

  async getUsage(key: string, window: UsageWindow): Promise<UsageRecord> {
    const storeKey = this.makeKey(key, window)
    const entry = this.store.get(storeKey)
    const ws = windowStart(window)
    if (!entry || entry.windowStart !== ws) {
      return { requests: 0, windowStart: ws }
    }
    return { requests: entry.count, windowStart: entry.windowStart }
  }

  async incrementUsage(key: string, usage: UsageIncrement): Promise<void> {
    // For simplicity, we increment across all windows
    const windows: UsageWindow[] = ['minute', 'hour', 'day', 'month']
    const inc = usage.requests || 1
    for (const window of windows) {
      const storeKey = this.makeKey(key, window)
      const entry = this.store.get(storeKey)
      const ws = windowStart(window)
      if (!entry || entry.windowStart !== ws) {
        this.store.set(storeKey, { count: inc, windowStart: ws })
      } else {
        entry.count += inc
      }
    }
  }
}
