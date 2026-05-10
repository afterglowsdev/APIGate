export interface RateLimitResult {
  allowed: boolean
  remaining: number
  reset: number // unix ms timestamp when the window resets
}

export interface IRateLimitStore {
  hit(key: string, windowMs: number, limit: number): Promise<RateLimitResult>
}
