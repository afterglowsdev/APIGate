export type UsageWindow = 'minute' | 'hour' | 'day' | 'month'

export interface UsageRecord {
  requests: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  windowStart: number // unix ms
}

export interface UsageIncrement {
  requests?: number
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
}
