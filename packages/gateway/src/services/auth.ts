/**
 * App + Device authentication middleware / 应用 + 设备鉴权中间件
 *
 * The admin configures which headers are used for device/user identification
 * via `app.identifiers` — no header names are hardcoded (except X-App-Id
 * which maps to the app). The identifiers are evaluated in their configured
 * order; the first matching `track: true` header becomes the rate-limit key.
 *
 * 管理员通过 `app.identifiers` 自由配置识别码，不写死任何 Header 名称。
 * 识别码按配置顺序评估，第一个 `track: true` 的匹配项作为限流主键。
 *
 * Flow / 流程：
 * 1. X-App-Id lookup → find app config
 * 2. Check appSecret if requireAppSecret=true
 * 3. Parse configured identifiers from request headers
 * 4. Auto-register device if enabled
 * 5. Check device blocked status
 * 6. Check minAppVersion
 * 7. Check allowedHours
 */

import type { MiddlewareHandler } from 'hono'
import type { IConfigStore } from '../interfaces/config-store.js'
import type { IDeviceStore } from '../interfaces/device-store.js'
import { secureCompare, hashIp } from '../utils/crypto.js'
import { getClientIP } from '../utils/request.js'
import type { Logger } from './logger.js'
import {
  UnauthorizedError, ForbiddenError, OutsideAllowedHoursError, InvalidRequestError,
} from '../types/errors.js'
import { isWithinTimeRange } from '../utils/time.js'

export function createAuthMiddleware(
  configStore: IConfigStore,
  deviceStore: IDeviceStore,
  logger: Logger,
): MiddlewareHandler {
  return async (c, next) => {
    // 1. Identify the app — X-App-Id is the only required header / 识别应用
    const appId = c.req.header('X-App-Id')
    if (!appId) {
      throw new UnauthorizedError('Missing X-App-Id header')
    }

    const config = await configStore.getConfig()
    const app = config.apps.find((a) => a.appId === appId)

    if (!app) {
      logger.warn('Auth failed: unknown app', { appId })
      throw new UnauthorizedError(`Unknown application "${appId}"`)
    }

    if (!app.enabled) {
      throw new ForbiddenError('app_disabled', `Application "${app.name}" is disabled`)
    }

    // 2. Check app secret if required / 验证应用密钥
    if (app.requireAppSecret) {
      if (!app.appSecret) {
        logger.error('Auth blocked: app secret required but not configured', { appId })
        throw new ForbiddenError(
          'app_secret_not_configured',
          `Application "${appId}" requires an app secret but none is configured`,
        )
      }
      const secret = c.req.header('X-App-Secret')
        || c.req.header('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
      if (!secret || !secureCompare(secret, app.appSecret)) {
        logger.warn('Auth failed: invalid app secret', { appId })
        throw new UnauthorizedError(`Invalid or missing app secret for "${appId}"`)
      }
    }

    // 3. Parse configured identifiers / 解析管理员配置的识别码
    //    Evaluated in order; the first `track: true` match is the primary device key
    const identifiers = app.identifiers || []
    let deviceId = ''
    let deviceMeta: Record<string, string> = {}

    for (const ident of identifiers) {
      const value = c.req.header(ident.header)
      if (value) {
        // First matching device-type identifier → primary device key
        if (ident.type === 'device' && ident.track && !deviceId) {
          deviceId = value
        }
        // First matching user-type identifier with tracking → also used as device key fallback
        if (ident.type === 'user' && ident.track && !deviceId) {
          deviceId = `user:${value}`
        }
        // Collect metadata (version, platform, etc.) / 收集元数据
        if (ident.type === 'custom') {
          deviceMeta[ident.header] = value
        }
      } else if (ident.required) {
        throw new InvalidRequestError(`Missing required header: ${ident.header}`)
      }
    }

    // 4. Device registration and blocking / 设备注册与封禁检查
    if (deviceId) {
      c.set('deviceId', deviceId)

      let device = await deviceStore.getDevice(appId, deviceId)

      if (!device) {
        if (app.autoRegisterDevices) {
          const ip = getClientIP(c.req.raw.headers)
          const now = new Date().toISOString()
          device = {
            appId,
            deviceId,
            status: 'active',
            firstSeenAt: now,
            lastSeenAt: now,
            appVersion: deviceMeta['X-App-Version'] || c.req.header('X-App-Version') || undefined,
            platform: deviceMeta['X-Platform'] || c.req.header('X-Platform') || undefined,
            ipHash: hashIp(ip),
          }
          await deviceStore.upsertDevice(device)
          logger.info('Device auto-registered', { appId, deviceId: deviceId.slice(0, 16) })
        } else if (!app.allowAnonymousDevices) {
          throw new ForbiddenError('device_not_registered',
            `Device "${deviceId.slice(0, 16)}..." is not registered for app "${appId}"`)
        }
      }

      if (device && device.status === 'blocked') {
        logger.warn('Blocked device attempted request', { appId, deviceId: deviceId.slice(0, 16) })
        throw new ForbiddenError('device_blocked',
          `Device is blocked for app "${appId}"`)
      }

      // Update device metadata / 更新设备元数据
      if (device) {
        device.lastSeenAt = new Date().toISOString()
        const ver = c.req.header('X-App-Version')
        if (ver) device.appVersion = ver
        const plat = c.req.header('X-Platform')
        if (plat) device.platform = plat
        await deviceStore.upsertDevice(device)
        c.set('device', device)
      }
    }

    // 5. Min version check / 最低版本检查
    if (app.minAppVersion) {
      const clientVersion = c.req.header('X-App-Version')
      if (clientVersion && compareVersions(clientVersion, app.minAppVersion) < 0) {
        throw new ForbiddenError('version_too_old',
          `App version ${clientVersion} is below minimum ${app.minAppVersion}`)
      }
    }

    // 6. Allowed hours / 时间窗口
    if (app.allowedHours?.enabled) {
      const { timezone, start, end } = app.allowedHours
      if (!isWithinTimeRange(timezone, start, end)) {
        throw new OutsideAllowedHoursError('Outside allowed hours')
      }
    }

    c.set('app', app)
    await next()
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const va = pa[i] || 0
    const vb = pb[i] || 0
    if (va !== vb) return va - vb
  }
  return 0
}
