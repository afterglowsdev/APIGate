import type { Hono } from 'hono'
import type { GatewayVariables, GatewayBindings } from '../types/env.js'
import type { IConfigStore } from '../interfaces/config-store.js'
import type { Logger } from '../services/logger.js'
import { createAdminAuthMiddleware, createLoginHandler, createLogoutHandler } from '../services/admin-auth.js'
import { createProxyHandler } from '../services/proxy.js'
import { maskToken } from '../utils/crypto.js'

/**
 * Validates config for saving (lenient: only structural checks).
 * Returns warnings for incomplete config.
 */
function validateConfigForSave(config: unknown): { ok: boolean; warnings: string[] } {
  const warnings: string[] = []
  if (!config || typeof config !== 'object') {
    return { ok: false, warnings: ['Config must be an object'] }
  }
  const c = config as Record<string, unknown>

  if (c.profiles !== undefined && typeof c.profiles !== 'object') {
    return { ok: false, warnings: ['profiles must be an object'] }
  }
  if (c.clients !== undefined && !Array.isArray(c.clients)) {
    return { ok: false, warnings: ['clients must be an array'] }
  }
  if (c.defaultProfile !== undefined && typeof c.defaultProfile !== 'string') {
    warnings.push('defaultProfile should be a string')
  }
  if (c.timeoutMs !== undefined && (typeof c.timeoutMs !== 'number' || (c.timeoutMs as number) <= 0)) {
    warnings.push('timeoutMs must be a positive number')
  }
  if (c.requestBodyLimitBytes !== undefined && (typeof c.requestBodyLimitBytes !== 'number' || (c.requestBodyLimitBytes as number) <= 0)) {
    warnings.push('requestBodyLimitBytes must be a positive number')
  }

  // Check each profile
  if (c.profiles && typeof c.profiles === 'object') {
    for (const [name, profile] of Object.entries(c.profiles)) {
      const p = profile as Record<string, unknown>
      if (p.max_tokens !== undefined && (typeof p.max_tokens !== 'number' || (p.max_tokens as number) < 0)) {
        warnings.push(`profile "${name}": max_tokens must be non-negative`)
      }
      if (p.models && Array.isArray(p.models)) {
        for (const m of p.models) {
          const model = m as Record<string, unknown>
          if (model.weight !== undefined && (typeof model.weight !== 'number' || (model.weight as number) < 0)) {
            warnings.push(`profile "${name}": model weight must be non-negative`)
          }
        }
      }
      if (p.enabled === true) {
        if (!p.models || !Array.isArray(p.models) || (p.models as unknown[]).length === 0) {
          warnings.push(`profile "${name}": enabled but has no models`)
        }
        if (!p.max_tokens || (p.max_tokens as number) <= 0) {
          warnings.push(`profile "${name}": enabled but max_tokens is missing`)
        }
      }
    }
  }

  // Check each client
  if (c.clients && Array.isArray(c.clients)) {
    for (const client of c.clients) {
      const cl = client as Record<string, unknown>
      if (cl.enabled === true) {
        if (!cl.token || (cl.token as string).length === 0) {
          warnings.push(`client "${cl.id || 'unknown'}": enabled but has no token`)
        }
        if (!cl.allowedProfiles || !Array.isArray(cl.allowedProfiles) || (cl.allowedProfiles as unknown[]).length === 0) {
          warnings.push(`client "${cl.id || 'unknown'}": enabled but has no allowedProfiles`)
        }
      }
      if (cl.dailyQuota !== undefined && (typeof cl.dailyQuota !== 'number' || (cl.dailyQuota as number) < 0)) {
        warnings.push(`client "${cl.id || 'unknown'}": dailyQuota must be non-negative`)
      }
    }
  }

  return { ok: true, warnings }
}

export function registerAdminRoutes(
  app: Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>,
  configStore: IConfigStore,
  logger: Logger,
  adminPassword: string,
  jwtSecret: string,
  newApiToken: string,
  newApiBaseUrl: string,
) {
  const adminAuth = createAdminAuthMiddleware(jwtSecret, logger)
  const loginHandler = createLoginHandler(adminPassword, jwtSecret, logger)
  const logoutHandler = createLogoutHandler()

  // Public: login
  app.post('/api/admin/login', (c) => loginHandler(c))

  // Protected routes
  app.post('/api/admin/logout', adminAuth, (c) => logoutHandler(c))

  app.get('/api/admin/session', adminAuth, (c) => {
    return c.json({ authenticated: true })
  })

  app.get('/api/admin/status', adminAuth, async (c) => {
    const config = await configStore.getConfig()
    return c.json({
      profiles: Object.keys(config.profiles).length,
      clients: config.clients.length,
      defaultProfile: config.defaultProfile,
      profilesList: Object.entries(config.profiles).map(([name, p]) => ({
        name,
        enabled: p.enabled,
        modelCount: p.models.length,
        description: p.description,
      })),
      clientsList: config.clients.map((cl) => ({
        id: cl.id,
        name: cl.name,
        enabled: cl.enabled,
        tokenPreview: maskToken(cl.token, 4),
      })),
      debug: config.debug,
      timeoutMs: config.timeoutMs,
      requestBodyLimitBytes: config.requestBodyLimitBytes,
    })
  })

  app.get('/api/admin/config', adminAuth, async (c) => {
    const config = await configStore.getConfig()
    // Mask sensitive data
    const safeConfig = {
      ...config,
      clients: config.clients.map((cl) => ({
        ...cl,
        token: maskToken(cl.token, 4),
      })),
    }
    return c.json(safeConfig)
  })

  app.put('/api/admin/config', adminAuth, async (c) => {
    let body: Record<string, unknown>
    try {
      body = await c.req.json()
    } catch {
      return c.json({ ok: false, warnings: ['Invalid JSON body'] }, 400)
    }

    const validation = validateConfigForSave(body)
    if (!validation.ok) {
      return c.json(validation, 400)
    }

    // Merge with existing config to preserve fields that weren't sent
    const existing = await configStore.getConfig()
    const merged = { ...existing, ...body } as typeof existing

    // Preserve un-masked client tokens from existing config
    if (body.clients && Array.isArray(body.clients)) {
      merged.clients = (body.clients as Record<string, unknown>[]).map((newClient, i) => {
        const existingClient = existing.clients[i]
        const token = newClient.token as string
        // If token wasn't changed (still masked), keep existing
        if (existingClient && token && token.startsWith('****')) {
          return { ...existingClient, ...newClient, token: existingClient.token }
        }
        return { ...existingClient, ...newClient } as typeof existing.clients[0]
      })
    }

    await configStore.saveConfig(merged)
    logger.info('Config saved', { warnings: validation.warnings })

    return c.json({ ok: true, warnings: validation.warnings })
  })

  // Test endpoint — uses same proxy logic
  app.post('/api/admin/test', adminAuth, async (c) => {
    const proxyHandler = createProxyHandler(configStore, logger, newApiToken, newApiBaseUrl)
    // Inject a fake client for test requests
    c.set('client', {
      id: 'admin-test',
      name: 'Admin Test',
      token: '',
      enabled: true,
      allowedProfiles: [],
      dailyQuota: 0,
      monthlyQuota: 0,
      rateLimitPerMinute: 0,
    })
    return proxyHandler(c)
  })
}
