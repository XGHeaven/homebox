const byteUnit = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s']
const bitUnit = ['bps', 'Kbps', 'Mbps', 'Gbps', 'Tbps']
const rateBase = 1024

export function parseByteRate(rate: number) {
  let level = 0
  while (rate > rateBase) {
    rate = rate / rateBase
    level ++
  }

  return `${rate.toFixed(2)} ${byteUnit[level]}`
}

export function parseBitRate(rate: number) {
  let level = 0
  while (rate > rateBase) {
    rate = rate / rateBase
    level ++
  }

  return `${rate.toFixed(2)} ${bitUnit[level]}`
}
