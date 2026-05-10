import type { Context } from 'hono'
import type { IConfigStore } from '../interfaces/config-store.js'
import { cleanRequestHeaders, cleanResponseHeaders } from '../utils/headers.js'
import { buildUpstreamURL } from '../utils/request.js'
import { sseHeaders } from '../utils/response.js'
import type { Logger } from './logger.js'
import { UpstreamError, TimeoutError } from '../types/errors.js'
import { nowMs } from '../utils/time.js'

const NEW_API_TOKEN_PLACEHOLDER = '{{NEW_API_TOKEN}}'

export function createProxyHandler(configStore: IConfigStore, logger: Logger, newApiToken: string, newApiBaseUrl: string) {
  return async (c: Context): Promise<Response> => {
    const startTime = nowMs()
    const requestId = c.get('requestId')
    const client = c.get('client')
    const selectedModel = c.get('selectedModel')

    // Get request body
    let body: string
    const storedBody = c.get('requestBody')
    if (storedBody) {
      body = JSON.stringify(storedBody)
    } else {
      body = await c.req.raw.clone().text()
    }

    // Build upstream request
    const upstreamURL = buildUpstreamURL(newApiBaseUrl, '/v1/chat/completions')
    const isStream = shouldStream(body)

    // Prepare headers
    const upstreamHeaders = cleanRequestHeaders(c.req.raw.headers, {
      'Authorization': `Bearer ${newApiToken}`,
      'Content-Type': 'application/json',
    })

    logger.info('Proxying request', {
      requestId,
      clientId: client?.id,
      model: selectedModel,
      stream: isStream,
      upstreamURL: newApiBaseUrl + '/v1/...',
    })

    // Create abort controller for timeout
    const config = await configStore.getConfig()
    const timeoutMs = config.timeoutMs || 30000
    const abortController = new AbortController()
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

    try {
      const upstreamResp = await fetch(upstreamURL, {
        method: 'POST',
        headers: upstreamHeaders,
        body,
        signal: abortController.signal,
      })

      clearTimeout(timeoutId)

      const durationMs = nowMs() - startTime

      if (!upstreamResp.ok) {
        logger.error('Upstream error', {
          requestId,
          status: upstreamResp.status,
          durationMs,
        })

        // Try to get upstream error body
        let errorBody = ''
        try { errorBody = await upstreamResp.text() } catch { /* ignore */ }

        throw new UpstreamError(
          `Upstream returned ${upstreamResp.status}: ${errorBody.slice(0, 200)}`,
        )
      }

      logger.info('Request completed', {
        requestId,
        clientId: client?.id,
        model: selectedModel,
        status: upstreamResp.status,
        durationMs,
      })

      // Stream the response
      if (isStream && upstreamResp.body) {
        const cleanedHeaders = cleanResponseHeaders(upstreamResp.headers)
        for (const [key, value] of Object.entries(sseHeaders())) {
          cleanedHeaders.set(key, value)
        }
        return new Response(upstreamResp.body, {
          status: upstreamResp.status,
          headers: cleanedHeaders,
        })
      }

      // Non-streaming: return as-is
      const cleanedHeaders = cleanResponseHeaders(upstreamResp.headers)
      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        headers: cleanedHeaders,
      })

    } catch (err) {
      clearTimeout(timeoutId)

      if ((err as Error).name === 'AbortError') {
        logger.warn('Request timed out', { requestId, timeoutMs, durationMs: nowMs() - startTime })
        throw new TimeoutError(`Upstream request timed out after ${timeoutMs}ms`)
      }

      if (err instanceof UpstreamError || err instanceof TimeoutError) {
        throw err
      }

      logger.error('Proxy error', { requestId, error: (err as Error).message })
      throw new UpstreamError('Failed to reach upstream service')
    }
  }
}

function shouldStream(body: string): boolean {
  try {
    const parsed = JSON.parse(body)
    return parsed.stream === true
  } catch {
    return false
  }
}
