import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { DeviceRecord, DeviceListQuery, DeviceListResult, DeviceUsageIncrement, DeviceStatus } from '../../types/device.js'
import type { IDeviceStore } from '../../interfaces/device-store.js'

interface DeviceData {
  devices: Record<string, DeviceRecord>
}

export class FileDeviceStore implements IDeviceStore {
  private filePath: string

  constructor(filePath: string) {
    this.filePath = filePath
  }

  private async readData(): Promise<DeviceData> {
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      return JSON.parse(raw) as DeviceData
    } catch {
      return { devices: {} }
    }
  }

  private async writeData(data: DeviceData): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true })
    const tempPath = this.filePath + '.tmp'
    await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8')
    await rename(tempPath, this.filePath)
  }

  private key(appId: string, deviceId: string): string {
    return `${appId}:${deviceId}`
  }

  async getDevice(appId: string, deviceId: string): Promise<DeviceRecord | null> {
    const data = await this.readData()
    return data.devices[this.key(appId, deviceId)] || null
  }

  async upsertDevice(record: DeviceRecord): Promise<void> {
    const data = await this.readData()
    data.devices[this.key(record.appId, record.deviceId)] = record
    await this.writeData(data)
  }

  async updateDeviceUsage(appId: string, deviceId: string, _usage: DeviceUsageIncrement): Promise<void> {
    const data = await this.readData()
    const device = data.devices[this.key(appId, deviceId)]
    if (device) {
      device.lastSeenAt = new Date().toISOString()
      await this.writeData(data)
    }
  }

  async setDeviceStatus(appId: string, deviceId: string, status: DeviceStatus): Promise<void> {
    const data = await this.readData()
    const device = data.devices[this.key(appId, deviceId)]
    if (device) {
      device.status = status
      await this.writeData(data)
    }
  }

  async listDevices(query: DeviceListQuery): Promise<DeviceListResult> {
    const data = await this.readData()
    let devices = Object.values(data.devices)

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
