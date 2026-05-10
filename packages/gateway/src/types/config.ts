// ============================================================
// Core config types for the LLM API Gateway
// ============================================================

export interface WeightedModel {
  name: string
  weight: number
}

export interface ModelProfile {
  enabled: boolean
  description?: string
  models: WeightedModel[]
  max_tokens: number
  temperature: number
}

export interface AllowedHours {
  enabled: boolean
  timezone: string
  start: string // HH:mm
  end: string // HH:mm
}

export interface ClientConfig {
  id: string
  name: string
  token: string
  enabled: boolean
  allowedProfiles: string[]
  dailyQuota: number
  monthlyQuota: number
  rateLimitPerMinute: number
  allowedHours?: AllowedHours
}

export interface GatewayConfig {
  defaultProfile: string
  debug: boolean
  timeoutMs: number
  requestBodyLimitBytes: number
  profiles: Record<string, ModelProfile>
  clients: ClientConfig[]
}

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  defaultProfile: 'app-fast',
  debug: false,
  timeoutMs: 30000,
  requestBodyLimitBytes: 1048576, // 1MB
  profiles: {
    'app-fast': {
      enabled: true,
      description: 'Fast affordable models',
      models: [
        { name: 'gpt-4o-mini', weight: 50 },
        { name: 'deepseek-chat', weight: 50 },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    },
    'app-smart': {
      enabled: true,
      description: 'High quality models',
      models: [
        { name: 'claude-3-5-sonnet-latest', weight: 70 },
        { name: 'gpt-4o', weight: 30 },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    },
  },
  clients: [
    {
      id: 'desktop-app',
      name: 'Desktop App',
      token: 'client-test-token',
      enabled: true,
      allowedProfiles: ['app-fast', 'app-smart'],
      dailyQuota: 1000,
      monthlyQuota: 30000,
      rateLimitPerMinute: 30,
    },
  ],
}
