import { isoTimestamp } from '../utils/time.js'
import { sanitizeMeta } from '../utils/sanitize.js'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogFormat = 'json' | 'pretty'

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

export function createLogger(level: LogLevel = 'info', format: LogFormat = 'pretty'): Logger {
  const minLevel = LOG_LEVELS[level]

  function log(logLevel: LogLevel, message: string, meta?: Record<string, unknown>) {
    if (LOG_LEVELS[logLevel] < minLevel) return

    const sanitized = meta ? sanitizeMeta(meta) : undefined

    if (format === 'json') {
      const entry = {
        ts: isoTimestamp(),
        level: logLevel,
        message,
        ...sanitized,
      }
      console.log(JSON.stringify(entry))
    } else {
      const ts = isoTimestamp().replace('T', ' ').slice(0, 19)
      const metaStr = sanitized ? ' ' + JSON.stringify(sanitized) : ''
      console.log(`[${ts}] [${logLevel.toUpperCase()}] ${message}${metaStr}`)
    }
  }

  return {
    debug: (m, meta) => log('debug', m, meta),
    info: (m, meta) => log('info', m, meta),
    warn: (m, meta) => log('warn', m, meta),
    error: (m, meta) => log('error', m, meta),
  }
}
