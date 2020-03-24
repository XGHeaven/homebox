import { h } from 'preact'
import { useMemo, useState, useRef } from 'preact/hooks'
import { HostChannel } from './channel'
import type { ChannelModule } from './worker'
import { parseByteRate, parseBitRate } from './utils'

export function App() {
  const channel = useMemo(() => new HostChannel<ChannelModule>(new Worker('./worker.ts')), [])
  const [rates, setRates] = useState<number[]>([])
  const rateRef = useRef(rates)
  rateRef.current = rates
  return (
    <div>
  <button onClick={() => {
    setRates([])
    channel.observe('download', {packCount: 64, duration: 10 * 1000, interval: 200, parallel: 3}).subscribe(rate => {
      const newRates = [...rateRef.current, rate]
      // 用 4s 的平均值
      if (newRates.length > 20) {
        newRates.shift()
      }

      // console.log(newRates)
      setRates(newRates)
    }, v => console.log(v, 'done'))
  }}>Download</button>
  <button onClick={() => {
    setRates([])
    channel.observe('upload', {packCount: 64, duration: 10 * 1000, interval: 200, parallel: 3}).subscribe(rate => {
      const newRates = [...rateRef.current, rate]
      // 用 4s 的平均值
      if (newRates.length > 20) {
        newRates.shift()
      }

      // console.log(newRates)
      setRates(newRates)
    }, v => console.log(v, 'done'))
  }}>Upload</button>
  {parseByteRate(rates.reduce((a, b) => a + b, 0) / rates.length)}
  {parseBitRate(rates.reduce((a, b) => a + b, 0) / rates.length * 8)}
    </div>
  )
}
