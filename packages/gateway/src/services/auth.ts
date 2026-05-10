import type { MiddlewareHandler } from 'hono'
import type { IConfigStore } from '../interfaces/config-store.js'
import { extractClientToken } from '../utils/headers.js'
import { secureCompare, hashIp } from '../utils/crypto.js'
import { getClientIP } from '../utils/request.js'
import type { Logger } from './logger.js'
import { UnauthorizedError, ClientDisabledError, ForbiddenError, OutsideAllowedHoursError } from '../types/errors.js'
import { isWithinTimeRange } from '../utils/time.js'

export function createAuthMiddleware(configStore: IConfigStore, logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const token = extractClientToken(c.req.raw.headers)
    if (!token) {
      throw new UnauthorizedError('Missing client token. Provide Authorization: Bearer <token> or X-Client-Token header.')
    }

    const config = await configStore.getConfig()
    const client = config.clients.find((cl) => secureCompare(cl.token, token))

    if (!client) {
      const ip = getClientIP(c.req.raw.headers)
      logger.warn('Auth failed: unknown client token', { ipHash: hashIp(ip) })
      throw new UnauthorizedError('Invalid client token')
    }

    if (!client.enabled) {
      throw new ClientDisabledError(`Client "${client.id}" is disabled`)
    }

    // Check allowed hours
    if (client.allowedHours?.enabled) {
      const { timezone, start, end } = client.allowedHours
      if (!isWithinTimeRange(timezone, start, end)) {
        throw new OutsideAllowedHoursError('Access is restricted to specific hours')
      }
    }

    c.set('client', client)
    await next()
  }
}
