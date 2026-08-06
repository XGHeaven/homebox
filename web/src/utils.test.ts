import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { formatBitRate, formatByteRate, rateFormatters } from './utils'

describe('formatBitRate', () => {
  const cases: Array<[number, string]> = [
    [1_000, '1.00 Kbps'],
    [1_000_000, '1.00 Mbps'],
    [1_000_000_000, '1.00 Gbps'],
  ]

  for (const [rate, expected] of cases) {
    it(`formats ${rate} bits per second using SI units`, () => {
      assert.equal(formatBitRate(rate), expected)
    })
  }
})

describe('formatByteRate', () => {
  const cases: Array<[number, string]> = [
    [1_000, '1.00 KB/s'],
    [1_000_000, '1.00 MB/s'],
    [1_000_000_000, '1.00 GB/s'],
  ]

  for (const [rate, expected] of cases) {
    it(`formats ${rate} bytes per second using SI units`, () => {
      assert.equal(formatByteRate(rate), expected)
    })
  }
})

describe('rateFormatters', () => {
  it('converts bytes per second to bits per second by a factor of eight', () => {
    assert.equal(rateFormatters.byte(125_000), '125.00 KB/s')
    assert.equal(rateFormatters.bit(125_000), '1.00 Mbps')
  })
})
