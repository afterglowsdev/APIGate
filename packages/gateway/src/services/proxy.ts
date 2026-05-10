/**
 * Upstream proxy handler / 上游代理处理器
 *
 * Core responsibilities / 核心职责：
 * 1. Build upstream URL (NEW_API_BASE_URL + /v1/chat/completions) / 构建上游 URL
 * 2. Clean request headers, inject NEW_API_TOKEN / 清理请求头，注入 NEW_API_TOKEN
 * 3. SSE streaming passthrough (does not buffer full response) / SSE 流式透传
 * 4. Non-streaming passthrough / 非流式普通代理
 * 5. AbortController-based timeout / AbortController 超时控制
 * 6. Error handling with log sanitization / 错误处理和日志脱敏
 */

import type { Context } from 'hono'
import type { IConfigStore } from '../interfaces/config-store.js'
import { cleanRequestHeaders, cleanResponseHeaders } from '../utils/headers.js'
import { buildUpstreamURL } from '../utils/request.js'
import { sseHeaders } from '../utils/response.js'
import type { Logger } from './logger.js'
import { UpstreamError, TimeoutError } from '../types/errors.js'
import { nowMs } from '../utils/time.js'

export function createProxyHandler(configStore: IConfigStore, logger: Logger, newApiToken: string, newApiBaseUrl: string) {
  return async (c: Context): Promise<Response> => {
    const startTime = nowMs()
    const requestId = c.get('requestId')
    const app = c.get('app')
    const selectedModel = c.get('selectedModel')

    // Get request body (may have been modified by model-router middleware)
    // 获取请求体（可能已被 model-router 中间件修改）
    let body: string
    const storedBody = c.get('requestBody')
    if (storedBody) {
      body = JSON.stringify(storedBody)
    } else {
      body = await c.req.raw.clone().text()
    }

    // Build upstream request / 构建上游请求
    const upstreamURL = buildUpstreamURL(newApiBaseUrl, '/v1/chat/completions')
    const isStream = shouldStream(body)

    // Clean headers and inject New API token / 清理请求头并注入 New API Token
    const upstreamHeaders = cleanRequestHeaders(c.req.raw.headers, {
      'Authorization': `Bearer ${newApiToken}`,
      'Content-Type': 'application/json',
    })

    // Log with sanitized URL (don't expose full base URL) / 日志（URL 脱敏）
    logger.info('Proxying request', {
      requestId,
      appId: app?.appId,
      model: selectedModel,
      stream: isStream,
      upstreamURL: newApiBaseUrl + '/v1/...',
    })

    // Timeout control / 超时控制
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

      // Upstream returned non-2xx — log and return 502 / 上游返回非 2xx
      if (!upstreamResp.ok) {
        logger.error('Upstream error', {
          requestId,
          status: upstreamResp.status,
          durationMs,
        })
        let errorBody = ''
        try { errorBody = await upstreamResp.text() } catch { /* ignore */ }
        throw new UpstreamError(`Upstream returned ${upstreamResp.status}: ${errorBody.slice(0, 200)}`)
      }

      logger.info('Request completed', {
        requestId,
        appId: app?.appId,
        model: selectedModel,
        status: upstreamResp.status,
        durationMs,
      })

      // SSE streaming — pipe the body stream directly, no buffering / SSE 流式透传
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

      // Non-streaming — return as-is / 非流式直接返回
      const cleanedHeaders = cleanResponseHeaders(upstreamResp.headers)
      return new Response(upstreamResp.body, {
        status: upstreamResp.status,
        headers: cleanedHeaders,
      })

    } catch (err) {
      clearTimeout(timeoutId)

      // AbortController triggered → timeout / 超时
      if ((err as Error).name === 'AbortError') {
        logger.warn('Request timed out', { requestId, timeoutMs, durationMs: nowMs() - startTime })
        throw new TimeoutError(`Upstream request timed out after ${timeoutMs}ms`)
      }

      // Known errors re-thrown / 已知错误直接抛出
      if (err instanceof UpstreamError || err instanceof TimeoutError) {
        throw err
      }

      // Unknown errors (network issues, etc.) / 未知错误
      logger.error('Proxy error', { requestId, error: (err as Error).message })
      throw new UpstreamError('Failed to reach upstream service')
    }
  }
}

/** Check if the request is streaming mode / 判断请求是否为流式模式 */
function shouldStream(body: string): boolean {
  try {
    const parsed = JSON.parse(body)
    return parsed.stream === true
  } catch {
    return false
  }
}
