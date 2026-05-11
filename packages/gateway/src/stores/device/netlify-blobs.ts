/**
 * Netlify Blobs DeviceStore — persistent device storage native to Netlify
 * 使用 Netlify Blobs 实现设备数据持久化
 */

import type { DeviceRecord, DeviceListQuery, DeviceListResult, DeviceUsageIncrement, DeviceStatus } from '../../types/device.js'
import type { IDeviceStore } from '../../interfaces/device-store.js'

async function getBlobStore(storeName: string) {
  const { getStore } = await import('@netlify/blobs')
  return getStore(storeName)
}

function deviceKey(appId: string, deviceId: string): string {
  return `device:${appId}:${deviceId}`
}

export class NetlifyBlobsDeviceStore implements IDeviceStore {
  private storeName: string

  constructor(storeName = 'gateway-devices') {
    this.storeName = storeName
  }

  async getDevice(appId: string, deviceId: string): Promise<DeviceRecord | null> {
    try {
      const store = await getBlobStore(this.storeName)
      return await store.get(deviceKey(appId, deviceId), { type: 'json' }) as DeviceRecord | null
    } catch {
      return null
    }
  }

  async upsertDevice(record: DeviceRecord): Promise<void> {
    const store = await getBlobStore(this.storeName)
    await store.set(deviceKey(record.appId, record.deviceId), JSON.stringify(record))
  }

  async updateDeviceUsage(appId: string, deviceId: string, _usage: DeviceUsageIncrement): Promise<void> {
    const device = await this.getDevice(appId, deviceId)
    if (device) {
      device.lastSeenAt = new Date().toISOString()
      await this.upsertDevice(device)
    }
  }

  async setDeviceStatus(appId: string, deviceId: string, status: DeviceStatus): Promise<void> {
    const device = await this.getDevice(appId, deviceId)
    if (device) {
      device.status = status
      await this.upsertDevice(device)
    }
  }

  async listDevices(query: DeviceListQuery): Promise<DeviceListResult> {
    try {
      const store = await getBlobStore(this.storeName)
      const prefix = query.appId ? `device:${query.appId}:` : 'device:'
      const result = await store.list({ prefix })

      let devices: DeviceRecord[] = []
      for (const { key } of result.blobs) {
        try {
          const device = await store.get(key, { type: 'json' }) as DeviceRecord | null
          if (device) devices.push(device)
        } catch { /* skip corrupt entries */ }
      }

      // Filter in-memory (Netlify Blobs list only supports prefix, not full query)
      if (query.status) {
        devices = devices.filter(d => d.status === query.status)
      }
      if (query.search) {
        const s = query.search.toLowerCase()
        devices = devices.filter(
          d => d.deviceId.toLowerCase().includes(s) || (d.note || '').toLowerCase().includes(s)
        )
      }

      const total = devices.length
      const offset = query.offset ?? 0
      const limit = query.limit ?? 50
      return { devices: limit <= 0 ? [] : devices.slice(offset, offset + limit), total }
    } catch {
      return { devices: [], total: 0 }
    }
  }
}
