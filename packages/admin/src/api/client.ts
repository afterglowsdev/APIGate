const BASE = '/api/admin'

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  })

  if (resp.status === 401) {
    const { useAuthStore } = await import('../stores/auth')
    useAuthStore().logout()
    throw new Error('Unauthorized')
  }

  const text = await resp.text()
  let data: Record<string, unknown>
  try { data = text ? JSON.parse(text) : {} } catch {
    throw new Error(`Server returned invalid response (${resp.status}): ${text.slice(0, 200)}`)
  }
  if (!resp.ok) throw new Error((data?.error as Record<string, string>)?.message || `Request failed: ${resp.status}`)
  return data as T
}

// ---- Types / 类型 ----

export interface GatewayStatus {
  profiles: number
  apps: number
  devices: number
  defaultProfile: string
  profilesList: { name: string; enabled: boolean; modelCount: number; description?: string }[]
  appsList: { appId: string; name: string; enabled: boolean }[]
  debug: boolean
  timeoutMs: number
  requestBodyLimitBytes: number
}

export interface AuthIdentifier {
  header: string
  type: 'app' | 'device' | 'user' | 'custom'
  required: boolean
  track: boolean
}

export interface AppData {
  appId: string
  name: string
  enabled: boolean
  appSecret?: string
  requireAppSecret: boolean
  identifiers: AuthIdentifier[]
  autoRegisterDevices: boolean
  allowAnonymousDevices: boolean
  defaultProfile: string
  allowedProfiles: string[]
  perDeviceDailyQuota: number
  perDeviceMonthlyQuota: number
  perDeviceRateLimitPerMinute: number
  perIpRateLimitPerMinute: number
  globalRateLimitPerMinute: number
  minAppVersion?: string
  allowedHours?: { enabled: boolean; timezone: string; start: string; end: string }
}

export interface ProfileData {
  enabled: boolean
  description?: string
  models: { name: string; weight: number }[]
  max_tokens: number
  temperature: number
}

export interface GatewayConfigResponse {
  defaultProfile: string
  debug: boolean
  timeoutMs: number
  requestBodyLimitBytes: number
  profiles: Record<string, ProfileData>
  apps: AppData[]
}

export interface DeviceData {
  appId: string
  deviceId: string
  status: 'active' | 'blocked'
  firstSeenAt: string
  lastSeenAt: string
  appVersion?: string
  platform?: string
  ipHash?: string
  note?: string
}

export interface DeviceListResult {
  devices: DeviceData[]
  total: number
}

export interface ConfigSaveResult { ok: boolean; warnings: string[] }

// ---- API / API 接口 ----

export const api = {
  login(password: string) { return request<{ ok: boolean }>('/login', { method: 'POST', body: JSON.stringify({ password }) }) },
  logout() { return request<{ ok: boolean }>('/logout', { method: 'POST' }) },
  getSession() { return request<{ authenticated: boolean }>('/session') },
  getStatus() { return request<GatewayStatus>('/status') },
  getConfig() { return request<GatewayConfigResponse>('/config') },
  saveConfig(config: unknown) { return request<ConfigSaveResult>('/config', { method: 'PUT', body: JSON.stringify(config) }) },

  // Devices / 设备管理
  getDevices(params?: { appId?: string; status?: string; search?: string; offset?: number; limit?: number }) {
    const q = new URLSearchParams()
    if (params?.appId) q.set('appId', params.appId)
    if (params?.status) q.set('status', params.status)
    if (params?.search) q.set('search', params.search)
    if (params?.offset != null) q.set('offset', String(params.offset))
    if (params?.limit != null) q.set('limit', String(params.limit))
    return request<DeviceListResult>(`/devices?${q.toString()}`)
  },
  blockDevice(appId: string, deviceId: string) { return request<{ ok: boolean }>(`/devices/${appId}/${deviceId}/block`, { method: 'POST' }) },
  unblockDevice(appId: string, deviceId: string) { return request<{ ok: boolean }>(`/devices/${appId}/${deviceId}/unblock`, { method: 'POST' }) },
  updateDeviceNote(appId: string, deviceId: string, note: string) { return request<{ ok: boolean }>(`/devices/${appId}/${deviceId}/note`, { method: 'PUT', body: JSON.stringify({ note }) }) },

  // Upstream models / 上游模型列表
  getUpstreamModels() { return request<{ ok: boolean; models?: string[]; error?: string }>('/upstream-models') },
}
