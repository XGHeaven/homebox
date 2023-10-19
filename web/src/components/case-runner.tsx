import React, { useContext, useRef, useState } from 'react'
import { Button } from '@blueprintjs/core'
import { ChannelsContext, ConfigContext } from '../context'
import { css } from '@emotion/react'
import { SpeedIndicator } from './speed-indicator'
import { Subscription, zip } from 'rxjs'

export function CaseRunner(props: { name: 'upload' | 'download'; title: string }) {
  const createChannels = useContext(ChannelsContext)
  const { duration, packCount, parallel } = useContext(ConfigContext)
  const [rate, setRate] = useState(-1)
  const [running, setRunning] = useState(false)
  const sub = useRef<Subscription | null>(null)

  const onClick = async () => {
    if (running) {
      sub.current?.unsubscribe()
      sub.current = null
      setRunning(false)
      return
    }
    setRunning(true)
    const channels = await createChannels()
    sub.current = zip(
      ...channels.map((channel) => channel.observe(props.name, { packCount, duration, interval: 300, parallel })),
    ).subscribe({
      next(rate) {
        setRate(rate.reduce((a, b) => a + b, 0))
      },
      error(e) {
        console.error(e)
        setRunning(false)
        sub.current = null
      },
      complete() {
        setRunning(false)
        sub.current = null
      },
    })
  }

  return (
    <div
      css={css`
        width: 100%;
        flex: auto;
        text-align: center;
        padding: 0 12px;
      `}
    >
      <h3>{props.title}</h3>
      <SpeedIndicator speed={rate === -1 ? undefined : rate} running={running} />
      <Button onClick={onClick}>{!running ? 'Start' : 'Stop'}</Button>
    </div>
  )
}
