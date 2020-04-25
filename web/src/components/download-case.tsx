import React, { useContext, useRef } from 'react'
import { useState } from "react"
import { Button } from '@blueprintjs/core'
import { ChannelContext } from '../context'
import { css } from '@emotion/core'
import { SpeedIndicator } from './speed-indicator'
import { Subscription } from 'rxjs'
import { RunningMode } from '../types'

export function CaseRunner(props: {
  name: 'upload' | 'download',
  title: string,
  mode?: RunningMode
}) {
  const createChannel = useContext(ChannelContext)
  const [rates, setRates] = useState<number[]>([])
  const [running, setRunning] = useState(false)
  const rate = rates.reduce((a, r) => a + r, 0) / (rates.length + Number.MIN_VALUE)
  const rateRef = useRef(rates)
  const sub = useRef<Subscription | null>(null)
  rateRef.current = rates

  return (
    <div css={css`
      width: 100%;
      flex: auto;
      text-align: center;
      padding: 0 12px;
    `}>
      <h3>{props.title}</h3>
      <SpeedIndicator speed={rates.length ? rate : undefined} running={running}/>
      <Button onClick={async () => {
        if (running) {
          if (sub.current) {
            sub.current.unsubscribe()
            sub.current = null
          }
          setRunning(false)
          return;
        }
        setRates([])
        setRunning(true)
        const channel = await createChannel()
        sub.current = channel.observe(props.name, {packCount: 64, duration: props.mode === RunningMode.CONTINUE ? Infinity : 10 * 1000, interval: 300, parallel: 3}).subscribe((rate: number) => {
          const newRates = [...rateRef.current, rate]
          // 用 4s 的平均值
          if (newRates.length > 20) {
            newRates.shift()
          }

          setRates(newRates)
        }, (e) => {
          console.error(e);
          setRunning(false)
          sub.current = null
        }, () => {
          setRunning(false)
          sub.current = null
        })
      }}>{!running ? 'Start' : 'Stop'}</Button>
    </div>
  )
}
