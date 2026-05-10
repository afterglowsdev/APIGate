/**
 * Admin authentication service / 管理员鉴权服务
 *
 * Uses JWT (HS256) + httpOnly Cookie for session management.
 * 使用 JWT (HS256) + httpOnly Cookie 实现会话管理。
 *
 * Login: verify ADMIN_PASSWORD, issue JWT, set Cookie / 验证密码，签发 JWT，写入 Cookie
 * Middleware: extract JWT from Cookie or Authorization header, verify / 从 Cookie 或 Authorization 头提取并验证 JWT
 * Logout: clear the Cookie / 清除 Cookie
 */

import type { MiddlewareHandler, Context } from 'hono'
import { SignJWT, jwtVerify } from 'jose'
import { secureCompare } from '../utils/crypto.js'
import type { Logger } from './logger.js'
import { UnauthorizedError } from '../types/errors.js'

const TOKEN_COOKIE = 'admin_token'
const SESSION_DURATION_SECONDS = 60 * 60 * 24 // 24 hours / 24 小时

function getSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret)
}

/** Issue admin JWT token / 签发管理员 JWT Token */
export async function createAdminToken(_password: string, jwtSecret: string): Promise<string> {
  return new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey(jwtSecret))
}

/** Verify admin JWT token / 验证管理员 JWT Token */
export async function verifyAdminToken(token: string, jwtSecret: string): Promise<boolean> {
  try {
    await jwtVerify(token, getSecretKey(jwtSecret))
    return true
  } catch {
    return false
  }
}

/** Admin auth middleware — protects /api/admin/* routes / 管理员鉴权中间件 */
export function createAdminAuthMiddleware(jwtSecret: string, logger: Logger): MiddlewareHandler {
  return async (c, next) => {
    // Read from cookie first, then Authorization header / 优先从 Cookie 读取，其次从 Authorization 头
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

/** Set admin session cookie / 设置管理员会话 Cookie */
function setCookieHeader(c: Context, value: string, maxAge: number) {
  c.header(
    'Set-Cookie',
    `${TOKEN_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`,
  )
}

/** Login handler — verify password, issue JWT / 登录处理 */
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

    // Constant-time compare to prevent timing attacks / 常数时间比较，防止时序攻击
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

/** Logout handler — clear the Cookie / 登出处理 */
export function createLogoutHandler() {
  return async (c: Context) => {
    setCookieHeader(c, '', 0) // Max-Age=0 deletes the cookie / Max-Age=0 即删除
    return c.json({ ok: true })
  }
}
