import type { UsageIncrement, UsageRecord, UsageWindow } from '../types/usage.js'

export interface IUsageStore {
  getUsage(key: string, window: UsageWindow): Promise<UsageRecord>
  incrementUsage(key: string, usage: UsageIncrement): Promise<void>
}
