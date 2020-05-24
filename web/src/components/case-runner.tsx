import React, { useContext, useRef } from 'react'
import { useState } from "react"
import { Button } from '@blueprintjs/core'
import { ChannelsContext, ConfigContext } from '../context'
import { css } from '@emotion/core'
import { SpeedIndicator } from './speed-indicator'
import { Subscription, zip } from 'rxjs'

export function CaseRunner(props: {
  name: 'upload' | 'download',
  title: string
}) {
  const createChannels = useContext(ChannelsContext)
  const { duration, packCount, parallel } = useContext(ConfigContext)
  const [rates, setRates] = useState<number[]>([])
  const [running, setRunning] = useState(false)
  const rate = rates.reduce((a, r) => a + r, 0) / (rates.length + Number.MIN_VALUE)
  const rateRef = useRef(rates)
  const sub = useRef<Subscription | null>(null)
  rateRef.current = rates

  const onMultiClick = async () => {
    setRates([])
    const channels = await createChannels()
    let count = 0
    sub.current = zip(...channels.map(channel => channel.observe(props.name, {packCount, duration, interval: 300, parallel}))).subscribe({
      next(rate) {
        // console.log(...rate, ++count)
        const newRates = [...rateRef.current, rate.reduce((a,b) => a + b, 0)]
        if (newRates.length > 20) {
          newRates.shift()
        }

        setRates(newRates)
      },
      error(e) {
        console.error(e);
        setRunning(false)
        sub.current = null
      },
      complete() {
        setRunning(false)
        sub.current = null
      }
    })
  }

  return (
    <div css={css`
      width: 100%;
      flex: auto;
      text-align: center;
      padding: 0 12px;
    `}>
      <h3>{props.title}</h3>
      <SpeedIndicator speed={rates.length ? rate : undefined} running={running}/>
      <Button onClick={onMultiClick}>{!running ? 'Start' : 'Stop'}</Button>
    </div>
  )
}
