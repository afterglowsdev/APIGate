import type { Hono } from 'hono'
import type { GatewayVariables, GatewayBindings } from '../types/env.js'
import type { Logger } from '../services/logger.js'
import { serveStatic } from '@hono/node-server/serve-static'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Admin SPA serving routes / 管理后台 SPA 路由
 *
 * Development: redirect to Vite dev server (localhost:5173)
 *              开发模式：重定向到 Vite dev server
 * Production (Node.js): serve static files from admin dist/
 *                       生产模式：提供管理后台静态文件
 *
 * Customize the admin path prefix by changing ADMIN_PATH below.
 * ADMIN_PATH 为管理后台路径前缀，可按需修改。
 * Default / 默认：/admin
 */
const ADMIN_PATH = '/admin'

export function registerAdminSpaRoutes(
  app: Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>,
  logger: Logger,
  isDev: boolean,
  adminDistPath?: string,
) {
  if (isDev) {
    // Dev mode: redirect to Vite. The Vite server handles everything.
    // 开发模式：重定向到 Vite dev server
    logger.info('Admin SPA: dev mode — redirecting to http://localhost:5173')
    app.get(`${ADMIN_PATH}`, (c) => c.redirect('http://localhost:5173'))
    app.get(`${ADMIN_PATH}/*`, (c) => c.redirect('http://localhost:5173'))
    return
  }

  // Production: serve static files
  // 生产模式：提供静态文件
  const distPath = adminDistPath || resolve(process.cwd(), '..', 'admin', 'dist')

  if (!existsSync(distPath)) {
    logger.warn(`Admin SPA: dist not found at ${distPath} — admin UI unavailable. Run "pnpm build" first.`)
    app.get(`${ADMIN_PATH}`, (c) =>
      c.html('<html><body><h1>Admin UI not built</h1><p>Run <code>pnpm build</code> first.</p></body></html>'))
    app.get(`${ADMIN_PATH}/*`, (c) =>
      c.html('<html><body><h1>Admin UI not built</h1><p>Run <code>pnpm build</code> first.</p></body></html>'))
    return
  }

  logger.info(`Admin SPA: serving static files from ${distPath}`)

  // Serve static assets
  app.use(`${ADMIN_PATH}/*`, serveStatic({ root: distPath }))

  // SPA fallback: any unmatched /admin/* returns index.html
  app.get(`${ADMIN_PATH}`, serveStatic({ path: '/index.html', root: distPath }))
  app.get(`${ADMIN_PATH}/*`, serveStatic({ path: '/index.html', root: distPath }))
}

export { ADMIN_PATH }
