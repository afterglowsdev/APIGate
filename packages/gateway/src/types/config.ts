// ============================================================
// Core config types for the LLM API Gateway / 网关核心配置类型
// ============================================================

export interface WeightedModel {
  name: string
  weight: number
}

// ---- Auth identifiers — admin configures which headers to use / 管理员自由配置识别码 ----

export type IdentifierType = 'app' | 'device' | 'user' | 'custom'

export interface AuthIdentifier {
  /** HTTP header name to look for, e.g. "X-Device-Id", "user_id" / Header 名称 */
  header: string
  /** What this identifier represents / 标识类型 */
  type: IdentifierType
  /** If true, request is rejected when this header is missing / 是否必填 */
  required: boolean
  /** The header value is used for rate-limit/usage tracking / 是否用于跟踪（限流、额度） */
  track: boolean
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

/**
 * AppConfig — an application registered to use the gateway.
 * Apps are manually configured by the admin. Devices are auto-discovered.
 * AppConfig — 管理员手动配置的应用接入。设备由系统自动发现。
 */
export interface AppConfig {
  appId: string
  name: string
  enabled: boolean

  /** Optional shared secret for basic access control / 可选的接入密钥 */
  appSecret?: string
  /** If true, requests must carry X-App-Secret or Authorization Bearer / 是否强制要求密钥 */
  requireAppSecret: boolean

  /**
   * Configurable auth identifiers — admin chooses which headers to use for
   * device/user identification and in what priority order.
   * 管理员自由配置识别码 — 选择用哪些 Header 做识别、用途类型、优先级顺序。
   *
   * Example / 示例：
   *   [
   *     { header: "X-Device-Id", type: "device", required: true, track: true },
   *     { header: "user_id",      type: "user",   required: false, track: true },
   *     { header: "X-App-Version", type: "custom", required: false, track: false },
   *   ]
   */
  identifiers: AuthIdentifier[]

  /** If true, unknown devices are auto-registered on first request / 是否自动注册新设备 */
  autoRegisterDevices: boolean
  /** If true, unregistered devices can still pass / 是否允许匿名设备 */
  allowAnonymousDevices: boolean

  /** Fallback profile when the request doesn't specify one / 请求未指定档位时的默认选择 */
  defaultProfile: string
  /** Profiles this app is allowed to use / 该应用允许使用的档位列表 */
  allowedProfiles: string[]

  /** Per-device daily request limit / 每设备每日请求数限制 */
  perDeviceDailyQuota: number
  /** Per-device monthly request limit / 每设备每月请求数限制 */
  perDeviceMonthlyQuota: number
  /** Per-device per-minute rate limit / 每设备每分钟请求数限制 */
  perDeviceRateLimitPerMinute: number
  /** Per-IP per-minute rate limit / 每 IP 每分钟请求数限制 */
  perIpRateLimitPerMinute: number
  /** Global per-minute rate limit across all devices / 该应用全局每分钟请求数限制 */
  globalRateLimitPerMinute: number

  /** Minimum required app version (semver string, optional) / 最低 App 版本要求 */
  minAppVersion?: string

  /** Time window during which the app is allowed to make requests / 允许请求的时间窗口 */
  allowedHours?: AllowedHours
}

export interface GatewayConfig {
  defaultProfile: string
  debug: boolean
  timeoutMs: number
  requestBodyLimitBytes: number
  profiles: Record<string, ModelProfile>
  apps: AppConfig[]
}

export const DEFAULT_GATEWAY_CONFIG: GatewayConfig = {
  defaultProfile: 'app-fast',
  debug: false,
  timeoutMs: 30000,
  requestBodyLimitBytes: 1048576, // 1MB
  profiles: {
    'app-fast': {
      enabled: true,
      description: 'Fast affordable models / 快速便宜模型',
      models: [
        { name: 'gpt-4o-mini', weight: 50 },
        { name: 'deepseek-chat', weight: 50 },
      ],
      max_tokens: 2048,
      temperature: 0.7,
    },
    'app-smart': {
      enabled: true,
      description: 'High quality models / 高质量模型',
      models: [
        { name: 'claude-3-5-sonnet-latest', weight: 70 },
        { name: 'gpt-4o', weight: 30 },
      ],
      max_tokens: 4096,
      temperature: 0.7,
    },
  },
  apps: [
    {
      appId: 'desktop-app',
      name: 'Desktop App',
      enabled: true,
      requireAppSecret: false,
      appSecret: '',
      identifiers: [
        { header: 'X-App-Id', type: 'app', required: true, track: false },
        { header: 'X-Device-Id', type: 'device', required: true, track: true },
        { header: 'user_id', type: 'user', required: false, track: true },
        { header: 'X-App-Version', type: 'custom', required: false, track: false },
        { header: 'X-Platform', type: 'custom', required: false, track: false },
      ],
      allowAnonymousDevices: true,
      autoRegisterDevices: true,
      defaultProfile: 'app-fast',
      allowedProfiles: ['app-fast', 'app-smart'],
      perDeviceDailyQuota: 1000,
      perDeviceMonthlyQuota: 30000,
      perDeviceRateLimitPerMinute: 30,
      perIpRateLimitPerMinute: 60,
      globalRateLimitPerMinute: 300,
    },
  ],
}
