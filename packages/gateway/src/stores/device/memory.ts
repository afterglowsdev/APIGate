import type { DeviceRecord, DeviceListQuery, DeviceListResult, DeviceUsageIncrement, DeviceStatus } from '../../types/device.js'
import type { IDeviceStore } from '../../interfaces/device-store.js'

export class MemoryDeviceStore implements IDeviceStore {
  private devices = new Map<string, DeviceRecord>()

  private key(appId: string, deviceId: string): string {
    return `${appId}:${deviceId}`
  }

  async getDevice(appId: string, deviceId: string): Promise<DeviceRecord | null> {
    return this.devices.get(this.key(appId, deviceId)) || null
  }

  async upsertDevice(record: DeviceRecord): Promise<void> {
    this.devices.set(this.key(record.appId, record.deviceId), { ...record })
  }

  async updateDeviceUsage(_appId: string, _deviceId: string, _usage: DeviceUsageIncrement): Promise<void> {
    // Memory store does not persist usage; UsageStore handles that separately
    const key = this.key(_appId, _deviceId)
    const device = this.devices.get(key)
    if (device) {
      device.lastSeenAt = new Date().toISOString()
    }
  }

  async setDeviceStatus(appId: string, deviceId: string, status: DeviceStatus): Promise<void> {
    const device = this.devices.get(this.key(appId, deviceId))
    if (device) {
      device.status = status
    }
  }

  async listDevices(query: DeviceListQuery): Promise<DeviceListResult> {
    let devices = Array.from(this.devices.values())

    if (query.appId) {
      devices = devices.filter((d) => d.appId === query.appId)
    }
    if (query.status) {
      devices = devices.filter((d) => d.status === query.status)
    }
    if (query.search) {
      const s = query.search.toLowerCase()
      devices = devices.filter(
        (d) => d.deviceId.toLowerCase().includes(s) || d.note?.toLowerCase().includes(s),
      )
    }

    const total = devices.length
    const offset = query.offset ?? 0
    const limit = query.limit ?? 50

    return {
      devices: limit <= 0 ? [] : devices.slice(offset, offset + limit),
      total,
    }
  }
}
