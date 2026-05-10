import type { Context } from 'hono'

export function jsonSuccess(c: Context, data: unknown, status = 200): Response {
  return c.json(data, status as never)
}

export function jsonError(
  c: Context,
  code: string,
  message: string,
  status: number,
  details?: Record<string, unknown>,
): Response {
  return c.json(
    {
      error: {
        code,
        message,
        ...(details ? { details } : {}),
      },
    },
    status as never,
  )
}

export function sseHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  }
}
