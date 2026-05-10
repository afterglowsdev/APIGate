// ============================================================
// Device types — auto-discovered, not manually created
// 设备类型 — 自动发现，非手动创建
// ============================================================

export type DeviceStatus = 'active' | 'blocked'

export interface DeviceRecord {
  appId: string
  deviceId: string
  status: DeviceStatus
  firstSeenAt: string   // ISO timestamp
  lastSeenAt: string    // ISO timestamp
  appVersion?: string
  platform?: string
  ipHash?: string
  note?: string          // admin note / 管理员备注
}

export interface DeviceListQuery {
  appId?: string
  status?: DeviceStatus
  search?: string        // search deviceId or note / 搜索设备ID或备注
  offset?: number
  limit?: number
}

export interface DeviceListResult {
  devices: DeviceRecord[]
  total: number
}

export interface DeviceUsageIncrement {
  requests: number
}
