import type { MiddlewareHandler, Context } from 'hono'
import { SignJWT, jwtVerify } from 'jose'
import { secureCompare } from '../utils/crypto.js'
import type { Logger } from './logger.js'
import { UnauthorizedError } from '../types/errors.js'

const TOKEN_COOKIE = 'admin_token'
const SESSION_DURATION_SECONDS = 60 * 60 * 24 // 24 hours

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

export async function createAdminToken(_password: string, jwtSecret: string): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey(jwtSecret))
}

export async function verifyAdminToken(token: string, jwtSecret: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecretKey(jwtSecret))
    return true
  } catch {
    return false
  }
}

export function createAdminAuthMiddleware(jwtSecret: string, logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    const cookieToken = c.req.header('cookie')?.match(/(?:^|;\s*)admin_token=([^;]*)/)?.[1]
    const authHeader = c.req.header('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    const token = cookieToken || authHeader

    if (!token) {
      throw new UnauthorizedError('Admin authentication required')
    }

    const valid = await verifyAdminToken(token, jwtSecret)
    if (!valid) {
      logger.warn('Admin auth failed: invalid or expired token')
      throw new UnauthorizedError('Invalid or expired admin session')
    }

    await next()
  }
}

function setCookieHeader(c: Context, value: string, maxAge: number) {
  c.header(
    'Set-Cookie',
    `${TOKEN_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
  )
}

export function createLoginHandler(adminPassword: string, jwtSecret: string, logger: Logger) {
  return async (c: Context) => {
    let body: { password?: string }
    try {
      body = await c.req.json()
    } catch {
      c.status(400)
      return c.json({ error: { code: 'invalid_request', message: 'Invalid JSON' } })
    }

    if (!body.password) {
      c.status(400)
      return c.json({ error: { code: 'invalid_request', message: 'Password is required' } })
    }

    if (!secureCompare(body.password, adminPassword)) {
      logger.warn('Admin login failed: wrong password')
      c.status(401)
      return c.json({ error: { code: 'unauthorized', message: 'Invalid password' } })
    }

    const token = await createAdminToken(adminPassword, jwtSecret)
    logger.info('Admin login successful')
    setCookieHeader(c, token, SESSION_DURATION_SECONDS)
    return c.json({ ok: true })
  }
}

export function createLogoutHandler() {
  return async (c: Context) => {
    setCookieHeader(c, '', 0)
    return c.json({ ok: true })
  }
}
