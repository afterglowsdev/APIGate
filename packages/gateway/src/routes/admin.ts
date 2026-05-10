import type { Hono } from 'hono'
import type { GatewayVariables, GatewayBindings } from '../types/env.js'
import type { IConfigStore } from '../interfaces/config-store.js'
import type { IDeviceStore } from '../interfaces/device-store.js'
import type { Logger } from '../services/logger.js'
import { createAdminAuthMiddleware, createLoginHandler, createLogoutHandler } from '../services/admin-auth.js'
import { createProxyHandler } from '../services/proxy.js'

/**
 * Lenient validation for config save — only structural checks, allows incomplete drafts.
 * 保存时宽松校验 — 仅做结构检查，允许草稿。
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
  if (c.apps !== undefined && !Array.isArray(c.apps)) {
    return { ok: false, warnings: ['apps must be an array'] }
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

  // Check apps / 检查应用
  if (c.apps && Array.isArray(c.apps)) {
    for (const app of c.apps) {
      const a = app as Record<string, unknown>
      if (a.enabled === true) {
        if (!a.appId || (a.appId as string).length === 0) {
          warnings.push(`app: enabled but has no appId`)
        }
        if (!a.allowedProfiles || !Array.isArray(a.allowedProfiles) || (a.allowedProfiles as unknown[]).length === 0) {
          warnings.push(`app "${a.appId || 'unknown'}": enabled but has no allowedProfiles`)
        }
      }
    }
  }

  return { ok: true, warnings }
}

export function registerAdminRoutes(
  app: Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>,
  configStore: IConfigStore,
  deviceStore: IDeviceStore,
  logger: Logger,
  adminPassword: string,
  jwtSecret: string,
  newApiToken: string,
  newApiBaseUrl: string,
) {
  const adminAuth = createAdminAuthMiddleware(jwtSecret, logger)
  const loginHandler = createLoginHandler(adminPassword, jwtSecret, logger)
  const logoutHandler = createLogoutHandler()

  // ---- Public / 公开 ----
  app.post('/api/admin/login', (c) => loginHandler(c))

  // ---- Protected / 需登录 ----
  app.post('/api/admin/logout', adminAuth, (c) => logoutHandler(c))

  app.get('/api/admin/session', adminAuth, (c) => c.json({ authenticated: true }))

  app.get('/api/admin/status', adminAuth, async (c) => {
    const config = await configStore.getConfig()
    // Count total devices / 统计设备总数
    const deviceList = await deviceStore.listDevices({ limit: 0 })
    return c.json({
      profiles: Object.keys(config.profiles).length,
      apps: config.apps.length,
      devices: deviceList.total,
      defaultProfile: config.defaultProfile,
      profilesList: Object.entries(config.profiles).map(([name, p]) => ({
        name, enabled: p.enabled, modelCount: p.models.length, description: p.description,
      })),
      appsList: config.apps.map((a) => ({
        appId: a.appId, name: a.name, enabled: a.enabled,
      })),
      debug: config.debug,
      timeoutMs: config.timeoutMs,
      requestBodyLimitBytes: config.requestBodyLimitBytes,
    })
  })

  app.get('/api/admin/config', adminAuth, async (c) => {
    const config = await configStore.getConfig()
    // Mask app secrets / 遮盖应用密钥
    const safeConfig = {
      ...config,
      apps: config.apps.map((a) => ({
        ...a,
        appSecret: a.appSecret ? '****' : '',
      })),
    }
    return c.json(safeConfig)
  })

  app.put('/api/admin/config', adminAuth, async (c) => {
    let body: Record<string, unknown>
    try { body = await c.req.json() } catch {
      return c.json({ ok: false, warnings: ['Invalid JSON body'] }, 400)
    }

    const validation = validateConfigForSave(body)
    if (!validation.ok) return c.json(validation, 400)

    const existing = await configStore.getConfig()
    const merged = { ...existing, ...body } as typeof existing

    // Preserve masked app secrets / 保留被遮盖的密钥
    if (body.apps && Array.isArray(body.apps)) {
      merged.apps = (body.apps as Record<string, unknown>[]).map((newApp, i) => {
        const existingApp = existing.apps[i]
        const secret = newApp.appSecret as string
        if (existingApp && secret === '****') {
          return { ...existingApp, ...newApp, appSecret: existingApp.appSecret }
        }
        return { ...existingApp, ...newApp } as typeof existing.apps[0]
      })
    }

    await configStore.saveConfig(merged)
    logger.info('Config saved', { warnings: validation.warnings })
    return c.json({ ok: true, warnings: validation.warnings })
  })

  // ---- Device management / 设备管理 ----
  app.get('/api/admin/devices', adminAuth, async (c) => {
    const appId = c.req.query('appId')
    const status = c.req.query('status') as 'active' | 'blocked' | undefined
    const search = c.req.query('search')
    const offset = parseInt(c.req.query('offset') || '0', 10)
    const limit = parseInt(c.req.query('limit') || '50', 10)

    const result = await deviceStore.listDevices({
      appId,
      status,
      search,
      offset,
      limit: Math.min(limit, 200),
    })
    return c.json(result)
  })

  // Block a device / 封禁设备
  app.post('/api/admin/devices/:appId/:deviceId/block', adminAuth, async (c) => {
    const { appId, deviceId } = c.req.param()
    await deviceStore.setDeviceStatus(appId, deviceId, 'blocked')
    logger.info('Device blocked', { appId, deviceId })
    return c.json({ ok: true })
  })

  // Unblock a device / 解封设备
  app.post('/api/admin/devices/:appId/:deviceId/unblock', adminAuth, async (c) => {
    const { appId, deviceId } = c.req.param()
    await deviceStore.setDeviceStatus(appId, deviceId, 'active')
    logger.info('Device unblocked', { appId, deviceId })
    return c.json({ ok: true })
  })

  // Update device note / 更新设备备注
  app.put('/api/admin/devices/:appId/:deviceId/note', adminAuth, async (c) => {
    const { appId, deviceId } = c.req.param()
    let body: { note?: string }
    try { body = await c.req.json() } catch {
      return c.json({ ok: false, message: 'Invalid JSON' }, 400)
    }
    const device = await deviceStore.getDevice(appId, deviceId)
    if (!device) return c.json({ ok: false, message: 'Device not found' }, 404)
    device.note = body.note
    await deviceStore.upsertDevice(device)
    return c.json({ ok: true })
  })

  // ---- Test endpoint / 测试端点 ----
  app.post('/api/admin/test', adminAuth, async (c) => {
    const proxyHandler = createProxyHandler(configStore, logger, newApiToken, newApiBaseUrl)
    // Inject a fake app for test requests / 为测试请求注入虚拟应用
    c.set('app', {
      appId: 'admin-test',
      name: 'Admin Test',
      enabled: true,
      requireAppSecret: false,
      appSecret: '',
      identifiers: [],
      autoRegisterDevices: false,
      allowAnonymousDevices: true,
      defaultProfile: '',
      allowedProfiles: [],
      perDeviceDailyQuota: 0,
      perDeviceMonthlyQuota: 0,
      perDeviceRateLimitPerMinute: 0,
      perIpRateLimitPerMinute: 0,
      globalRateLimitPerMinute: 0,
    })
    return proxyHandler(c)
  })
}
