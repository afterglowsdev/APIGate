const BASE = '/api/admin'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  if (resp.status === 401) {
    // Clear auth on 401
    const { useAuthStore } = await import('../stores/auth')
    useAuthStore().logout()
    throw new Error('Unauthorized')
  }

  const data = await resp.json()
  if (!resp.ok) {
    throw new Error(data?.error?.message || `Request failed: ${resp.status}`)
  }

  return data as T
}

export interface GatewayStatus {
  profiles: number
  clients: number
  defaultProfile: string
  profilesList: { name: string; enabled: boolean; modelCount: number; description?: string }[]
  clientsList: { id: string; name: string; enabled: boolean; tokenPreview: string }[]
  debug: boolean
  timeoutMs: number
  requestBodyLimitBytes: number
}

export interface GatewayConfigResponse {
  defaultProfile: string
  debug: boolean
  timeoutMs: number
  requestBodyLimitBytes: number
  profiles: Record<string, ProfileData>
  clients: ClientData[]
}

export interface ProfileData {
  enabled: boolean
  description?: string
  models: { name: string; weight: number }[]
  max_tokens: number
  temperature: number
}

export interface ClientData {
  id: string
  name: string
  token: string
  enabled: boolean
  allowedProfiles: string[]
  dailyQuota: number
  monthlyQuota: number
  rateLimitPerMinute: number
  allowedHours?: {
    enabled: boolean
    timezone: string
    start: string
    end: string
  }
}

export interface ConfigSaveResult {
  ok: boolean
  warnings: string[]
}

export const api = {
  login(password: string) {
    return request<{ ok: boolean }>('/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    })
  },

  logout() {
    return request<{ ok: boolean }>('/logout', { method: 'POST' })
  },

  getSession() {
    return request<{ authenticated: boolean }>('/session')
  },

  getStatus() {
    return request<GatewayStatus>('/status')
  },

  getConfig() {
    return request<GatewayConfigResponse>('/config')
  },

  saveConfig(config: unknown) {
    return request<ConfigSaveResult>('/config', {
      method: 'PUT',
      body: JSON.stringify(config),
    })
  },

  test(params: { model?: string; messages: { role: string; content: string }[]; stream?: boolean }) {
    return request<unknown>('/test', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  },
}
