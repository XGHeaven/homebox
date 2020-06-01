import { RateUnit } from './types'

const byteUnit = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
const bitUnit = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps']
const rateBase = 1024

export function formatByteRate(rate: number) {
  let level = 0
  while (rate > rateBase) {
    rate = rate / rateBase
    level++
  }

  return `${rate.toFixed(2)} ${byteUnit[level]}`
}

export function formatBitRate(rate: number) {
  let level = 0
  while (rate > rateBase) {
    rate = rate / rateBase
    level++
  }

  return `${rate.toFixed(2)} ${bitUnit[level]}`
}

export type RateFormatter = (rate: number) => string

export const rateFormatters: Record<RateUnit, RateFormatter> = {
  // rate mul 8 since rate unit it byte
  bit: (rate) => formatBitRate(rate * 8),
  byte: formatByteRate,
}
