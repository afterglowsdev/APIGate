import type { Context } from 'hono'
import { GatewayError, InternalError } from '../types/errors.js'

export function errorToResponse(c: Context, err: unknown): Response {
  if (err instanceof GatewayError) {
    return c.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      err.status as 200,
    )
  }

  // Unknown error — log and return generic 500
  console.error('[unhandled]', err)
  const internalError = new InternalError()
  return c.json(
    {
      error: {
        code: internalError.code,
        message: internalError.message,
      },
    },
    500,
  )
}
