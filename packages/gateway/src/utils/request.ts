import { InvalidRequestError, RequestTooLargeError } from '../types/errors.js'

const IP_HEADERS = ['CF-Connecting-IP', 'X-Forwarded-For', 'X-Real-IP']

export function getClientIP(headers: Headers): string {
  for (const header of IP_HEADERS) {
    const value = headers.get(header)
    if (value) {
      // X-Forwarded-For may contain multiple IPs; take the first
      const first = value.split(',')[0].trim()
      if (first) return first
    }
  }
  return '127.0.0.1'
}

export async function parseRequestBody(req: Request, limitBytes: number): Promise<unknown> {
  const contentLength = parseInt(req.headers.get('content-length') || '0', 10)
  if (contentLength > limitBytes) {
    throw new RequestTooLargeError()
  }

  const text = await req.text()
  if (new TextEncoder().encode(text).byteLength > limitBytes) {
    throw new RequestTooLargeError()
  }

  try {
    return JSON.parse(text)
  } catch {
    throw new InvalidRequestError('Invalid JSON in request body')
  }
}

export function buildUpstreamURL(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}
