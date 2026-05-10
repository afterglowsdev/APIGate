import type { UsageWindow } from '../types/usage.js'

export function nowMs(): number {
  return Date.now()
}

export function isoTimestamp(): string {
  return new Date().toISOString()
}

export function windowStart(window: UsageWindow): number {
  const now = new Date()
  switch (window) {
    case 'minute':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes()).getTime()
    case 'hour':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()).getTime()
    case 'day':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    case 'month':
      return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  }
}

export function windowKey(prefix: string, window: UsageWindow): string {
  const ws = windowStart(window)
  return `${prefix}:${window}:${ws}`
}

export function nowInTimezone(timezone: string): Date {
  const now = new Date()
  const str = now.toLocaleString('en-US', { timeZone: timezone })
  return new Date(str)
}

export function isWithinTimeRange(
  timezone: string,
  start: string, // HH:mm
  end: string, // HH:mm
): boolean {
  const now = nowInTimezone(timezone)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const [startH, startM] = start.split(':').map(Number)
  const [endH, endM] = end.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = endH * 60 + endM

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes
  }
  // Overnight range, e.g. 22:00 - 06:00
  return currentMinutes >= startMinutes || currentMinutes <= endMinutes
}
