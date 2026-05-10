import type { DeviceRecord, DeviceListQuery, DeviceListResult, DeviceUsageIncrement, DeviceStatus } from '../types/device.js'

export interface IDeviceStore {
  getDevice(appId: string, deviceId: string): Promise<DeviceRecord | null>
  upsertDevice(record: DeviceRecord): Promise<void>
  updateDeviceUsage(appId: string, deviceId: string, usage: DeviceUsageIncrement): Promise<void>
  setDeviceStatus(appId: string, deviceId: string, status: DeviceStatus): Promise<void>
  listDevices(query: DeviceListQuery): Promise<DeviceListResult>
}
