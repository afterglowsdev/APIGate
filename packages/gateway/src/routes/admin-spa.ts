import type { Hono } from 'hono'
import type { GatewayVariables, GatewayBindings } from '../types/env.js'
import type { Logger } from '../services/logger.js'
import { serveStatic } from '@hono/node-server/serve-static'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Admin SPA serving routes / 管理后台 SPA 路由
 *
 * Production: serves built static files from ../admin/dist
 *             生产模式：提供已构建的静态文件
 * Development: also serves static files if built, otherwise shows a hint
 *              开发模式：如果已构建则提供静态文件，否则显示提示
 *
 * In dev mode, it's recommended to access the admin UI at http://localhost:5173
 * (Vite dev server with hot-reload). The gateway's /admin always serves the
 * production build — no redirects to Vite.
 * 开发时建议直接访问 :5173（Vite 热更新），网关的 /admin 始终提供生产构建。
 *
 * Customize the admin path prefix by changing ADMIN_PATH below.
 * ADMIN_PATH 为管理后台路径前缀，可按需修改。默认 /admin。
 */
const ADMIN_PATH = '/admin'

export function registerAdminSpaRoutes(
  app: Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>,
  logger: Logger,
  _isDev: boolean,
  adminDistPath?: string,
) {
  const distPath = adminDistPath || resolve(process.cwd(), '..', 'admin', 'dist')

  if (!existsSync(distPath)) {
    logger.warn(`Admin SPA: dist not found at ${distPath}`)
    logger.warn('Run "pnpm build" to build the admin frontend, or use "pnpm dev:admin" for development at http://localhost:5173')
    app.get(`${ADMIN_PATH}`, (c) =>
      c.html(`<html><body style="font-family:sans-serif;padding:2rem">
        <h1>Admin UI not built</h1>
        <p>The admin frontend has not been built yet.</p>
        <p><b>Production:</b> <code>pnpm build</code></p>
        <p><b>Development:</b> <code>pnpm dev:admin</code> then visit <a href="http://localhost:5173">http://localhost:5173</a></p>
      </body></html>`))
    app.get(`${ADMIN_PATH}/*`, (c) =>
      c.html(`<html><body style="font-family:sans-serif;padding:2rem">
        <h1>Admin UI not built</h1>
        <p>Run <code>pnpm build</code> first.</p>
      </body></html>`))
    return
  }

  logger.info(`Admin SPA: serving from ${distPath}`)

  // Serve ALL static files from admin dist at root level.
  // This handles /assets/*.js, /assets/*.css, /favicon.ico etc.
  // API routes (/api/*, /v1/*, /health) have priority and won't be overridden.
  // 提供 dist 下所有静态文件，API 路由优先。
  app.use('/*', serveStatic({ root: distPath }))

  // SPA fallback: /admin and /admin/* return index.html / SPA 回退
  app.get(`${ADMIN_PATH}`, serveStatic({ path: '/index.html', root: distPath }))
  app.get(`${ADMIN_PATH}/*`, serveStatic({ path: '/index.html', root: distPath }))
}

export { ADMIN_PATH }
