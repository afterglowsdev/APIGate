import type { Hono } from 'hono'
import type { GatewayVariables, GatewayBindings } from '../types/env.js'
import type { Logger } from '../services/logger.js'

/**
 * Registers the admin SPA serving routes.
 * In development, proxies to Vite dev server.
 * In production (Node.js), serves static files.
 * This path prefix can be customized — change ADMIN_PATH below.
 *
 * Default: /admin
 * Can be set to something else like /manage/ or /xxx/
 */
const ADMIN_PATH = '/admin'

export function registerAdminSpaRoutes(
  app: Hono<{ Variables: GatewayVariables; Bindings: GatewayBindings }>,
  logger: Logger,
  isDev: boolean,
  adminDistPath?: string,
) {
  if (isDev) {
    // In dev mode, proxy to Vite dev server at localhost:5173
    logger.info('Admin SPA: dev mode — proxying to http://localhost:5173')
    app.all(`${ADMIN_PATH}/*`, async (c) => {
      const viteURL = `http://localhost:5173${c.req.path}`
      try {
        const resp = await fetch(viteURL, {
          headers: c.req.raw.headers,
          redirect: 'manual',
        })
        return new Response(resp.body, {
          status: resp.status,
          headers: resp.headers,
        })
      } catch {
        return c.html(
          '<html><body><h1>Admin dev server not running</h1><p>Start with: pnpm dev:admin</p></body></html>',
          503,
        )
      }
    })
    app.get(`${ADMIN_PATH}`, async (c) => {
      try {
        const resp = await fetch(`http://localhost:5173${ADMIN_PATH}/`)
        return new Response(resp.body, {
          status: resp.status,
          headers: resp.headers,
        })
      } catch {
        return c.html(
          '<html><body><h1>Admin dev server not running</h1><p>Start with: pnpm dev:admin</p></body></html>',
          503,
        )
      }
    })
  } else if (adminDistPath) {
    // In production, serve static files
    // Dynamic import to avoid bundling serve-static in non-Node runtimes
    import('@hono/node-server/serve-static').then(({ serveStatic }) => {
      app.use(`${ADMIN_PATH}/*`, serveStatic({ root: adminDistPath }))
      app.get(`${ADMIN_PATH}/*`, serveStatic({ path: 'index.html', root: adminDistPath }))
    }).catch(() => {
      logger.warn('Admin SPA: serve-static not available — skipping admin UI')
    })
  }
}

export { ADMIN_PATH }
