/**
 * App and device authentication middleware.
 *
 * Design intent:
 * - Application identification is driven by configured `app` identifiers
 *   instead of a hardcoded `X-App-Id` requirement.
 * - When only one app is enabled, the gateway can fall back to that app if no
 *   explicit app identifier is present. This keeps single-app deployments easy
 *   to use while still allowing multi-app routing.
 * - Device/user identifiers are still evaluated in configured order; the first
 *   tracked match becomes the quota and rate-limit key.
 */

import type { MiddlewareHandler } from 'hono'
import type { IConfigStore } from '../interfaces/config-store.js'
import type { IDeviceStore } from '../interfaces/device-store.js'
import type { AppConfig, AuthIdentifier } from '../types/config.js'
import { secureCompare, hashIp } from '../utils/crypto.js'
import { getClientIP } from '../utils/request.js'
import type { Logger } from './logger.js'
import {
  UnauthorizedError,
  ForbiddenError,
  OutsideAllowedHoursError,
  InvalidRequestError,
} from '../types/errors.js'
import { isWithinTimeRange } from '../utils/time.js'

export function createAuthMiddleware(
  configStore: IConfigStore,
  deviceStore: IDeviceStore,
  logger: Logger,
): MiddlewareHandler {
  return async (c, next) => {
    const config = await configStore.getConfig()
    const app = resolveAppFromRequest(config.apps, c.req.raw.headers, logger)
    const appId = app.appId

    if (!app.enabled) {
      throw new ForbiddenError('app_disabled', `Application "${app.name}" is disabled`)
    }

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

    const identifiers = app.identifiers || []
    let deviceId = ''
    const deviceMeta: Record<string, string> = {}

    for (const ident of identifiers) {
      const value = c.req.header(ident.header)
      if (!value) {
        if (ident.required) {
          throw new InvalidRequestError(`Missing required header: ${ident.header}`)
        }
        continue
      }

      if (ident.type === 'app') {
        if (value !== app.appId) {
          logger.warn('Auth failed: invalid app identifier', { appId, header: ident.header, value })
          throw new UnauthorizedError(`Invalid application identifier "${ident.header}"`)
        }
        continue
      }

      if (ident.type === 'device' && ident.track && !deviceId) {
        deviceId = value
      }
      if (ident.type === 'user' && ident.track && !deviceId) {
        deviceId = `user:${value}`
      }
      if (ident.type === 'custom') {
        deviceMeta[ident.header] = value
      }
    }

    if (!deviceId && !app.allowAnonymousDevices) {
      const hasTrackedIdentifier = identifiers.some(
        (ident) => (ident.type === 'device' || ident.type === 'user') && ident.track,
      )
      if (hasTrackedIdentifier) {
        throw new ForbiddenError(
          'device_identifier_missing',
          `Application "${appId}" requires a tracked device or user identifier`,
        )
      }
    }

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
          throw new ForbiddenError(
            'device_not_registered',
            `Device "${deviceId.slice(0, 16)}..." is not registered for app "${appId}"`,
          )
        }
      }

      if (device && device.status === 'blocked') {
        logger.warn('Blocked device attempted request', { appId, deviceId: deviceId.slice(0, 16) })
        throw new ForbiddenError('device_blocked', `Device is blocked for app "${appId}"`)
      }

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

    if (app.minAppVersion) {
      const clientVersion = c.req.header('X-App-Version')
      if (clientVersion && compareVersions(clientVersion, app.minAppVersion) < 0) {
        throw new ForbiddenError(
          'version_too_old',
          `App version ${clientVersion} is below minimum ${app.minAppVersion}`,
        )
      }
    }

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

function resolveAppFromRequest(apps: AppConfig[], headers: Headers, logger: Logger): AppConfig {
  const enabledApps = apps.filter((app) => app.enabled)
  if (enabledApps.length === 0) {
    throw new UnauthorizedError('No enabled application is configured')
  }

  const explicitHeaders = new Map<string, string>()
  const matchedApps: AppConfig[] = []

  for (const app of enabledApps) {
    for (const ident of getAppIdentifiers(app)) {
      const value = headers.get(ident.header)
      if (!value) continue
      explicitHeaders.set(ident.header, value)
      if (value === app.appId) {
        matchedApps.push(app)
        break
      }
    }
  }

  if (matchedApps.length === 1) {
    return matchedApps[0]
  }

  if (matchedApps.length > 1) {
    logger.warn('Auth failed: ambiguous app identifier', {
      appIds: matchedApps.map((app) => app.appId),
    })
    throw new UnauthorizedError('Ambiguous application identifier')
  }

  if (explicitHeaders.size > 0) {
    const [header, value] = explicitHeaders.entries().next().value as [string, string]
    logger.warn('Auth failed: unknown app identifier', { header, value })
    throw new UnauthorizedError(`Unknown application identifier "${header}"`)
  }

  const hasConfiguredAppIdentifiers = enabledApps.some((app) => getAppIdentifiers(app).length > 0)
  if (hasConfiguredAppIdentifiers) {
    if (enabledApps.length === 1) {
      return enabledApps[0]
    }
    throw new UnauthorizedError('Missing application identifier header')
  }

  const legacyAppId = headers.get('X-App-Id')
  if (legacyAppId) {
    const legacyApp = enabledApps.find((app) => app.appId === legacyAppId)
    if (!legacyApp) {
      logger.warn('Auth failed: unknown legacy app identifier', { appId: legacyAppId })
      throw new UnauthorizedError(`Unknown application "${legacyAppId}"`)
    }
    return legacyApp
  }

  if (enabledApps.length === 1) {
    return enabledApps[0]
  }

  throw new UnauthorizedError('Missing application identifier header')
}

function getAppIdentifiers(app: AppConfig): AuthIdentifier[] {
  return (app.identifiers || []).filter(
    (ident) => ident.type === 'app' && ident.header.trim().length > 0,
  )
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
