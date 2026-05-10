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
    throw { code: 'request_too_large', message: 'Request body too large', status: 413 }
  }

  const text = await req.text()
  if (text.length > limitBytes) {
    throw { code: 'request_too_large', message: 'Request body too large', status: 413 }
  }

  try {
    return JSON.parse(text)
  } catch {
    throw { code: 'invalid_request', message: 'Invalid JSON in request body', status: 400 }
  }
}

export function buildUpstreamURL(baseUrl: string, path: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  return `${cleanBase}${cleanPath}`
}
