import type { Hono } from 'hono'
import type { GatewayVariables, GatewayBindings } from '../types/env.js'
import type { Logger } from '../services/logger.js'

/**
 * Admin SPA serving routes / 管理后台 SPA 路由
 *
 * Development: redirect to Vite dev server (localhost:5173)
 *              重定向到 Vite dev server — 避免代理 Vite 内部路径的复杂性
 * Production (Node.js): serve static files from admin dist/
 *                       提供静态文件服务
 *
 * Customize the admin path prefix by changing ADMIN_PATH below.
 * ADMIN_PATH 为管理后台路径前缀，可按需修改。
 * Default / 默认：/admin
 * Can be set to: /manage/ or /xxx/
 * 可自定义为：/manage/ 或 /xxx/
 */
const ADMIN_PATH = '/admin'

export function registerAdminSpaRoutes(
  app: Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>,
  logger: Logger,
  isDev: boolean,
  adminDistPath?: string,
) {
  if (isDev) {
    // In dev mode, redirect to Vite dev server directly.
    // Trying to proxy Vite's HTML leads to broken asset paths (/@vite/client, /src/main.ts etc.)
    // because those are served by Vite on its own port, not by the gateway.
    // 开发模式下直接重定向到 Vite，避免代理导致的资源路径问题
    logger.info('Admin SPA: dev mode — redirecting to http://localhost:5173')
    app.get(`${ADMIN_PATH}`, (c) => c.redirect('http://localhost:5173'))
    app.get(`${ADMIN_PATH}/*`, (c) => c.redirect('http://localhost:5173'))
  } else if (adminDistPath) {
    // In production, serve static files / 生产模式提供静态文件
    import('@hono/node-server/serve-static').then(({ serveStatic }) => {
      app.use(`${ADMIN_PATH}/*`, serveStatic({ root: adminDistPath }))
      app.get(`${ADMIN_PATH}/*`, serveStatic({ path: 'index.html', root: adminDistPath }))
    }).catch(() => {
      logger.warn('Admin SPA: serve-static not available — skipping admin UI')
    })
  } else {
    // Serverless mode: admin is deployed separately / Serverless 模式：管理后台单独部署
    app.get(`${ADMIN_PATH}`, (c) => c.html('<html><body><h1>Admin UI</h1><p>Deploy the admin frontend separately.</p></body></html>'))
  }
}

export { ADMIN_PATH }
