import type { Hono } from 'hono'
import type { GatewayVariables, GatewayBindings } from '../types/env.js'
import { nowMs } from '../utils/time.js'

const startTime = nowMs()

export function registerHealthRoute(app: Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>) {
  app.get('/health', (c) => {
    const uptimeMs = nowMs() - startTime
    return c.json({
      status: 'ok',
      uptime: Math.floor(uptimeMs / 1000),
      uptimeMs,
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    })
  })
}
