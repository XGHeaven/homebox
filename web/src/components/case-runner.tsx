import React, { useContext, useEffect, useRef, useState } from 'react'
import { Button } from '@blueprintjs/core'
import { ChannelsContext, ConfigContext, I18nContext } from '../context'
import { css } from '@emotion/react'
import { SpeedIndicator } from './speed-indicator'
import { appendRatePoint, RateCurve } from './rate-curve'
import { Subscription, zip } from 'rxjs'

export function CaseRunner(props: { name: 'upload' | 'download'; title: string }) {
  const createChannels = useContext(ChannelsContext)
  const t = useContext(I18nContext)
  const { duration, packCount, parallel } = useContext(ConfigContext)
  const [rate, setRate] = useState(-1)
  const [rates, setRates] = useState<number[]>([])
  const [running, setRunning] = useState(false)
  const sub = useRef<Subscription | null>(null)
  const runIdRef = useRef(0)

  useEffect(
    () => () => {
      runIdRef.current += 1
      sub.current?.unsubscribe()
      sub.current = null
    },
    [],
  )

  const onClick = async () => {
    if (running) {
      runIdRef.current += 1
      sub.current?.unsubscribe()
      sub.current = null
      setRunning(false)
      return
    }
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    setRate(-1)
    setRates([])
    setRunning(true)
    const channels = await createChannels()
    if (runIdRef.current !== runId) {
      return
    }
    sub.current = zip(
      ...channels.map((channel) =>
        channel.observe(props.name, {
          packCount,
          duration,
          interval: 300,
          parallel,
        }),
      ),
    ).subscribe({
      next(rate) {
        if (runIdRef.current !== runId) {
          return
        }
        const nextRate = rate.reduce((a, b) => a + b, 0)
        setRate(nextRate)
        setRates((prevRates) => appendRatePoint(prevRates, nextRate))
      },
      error(e) {
        console.error(e)
        if (runIdRef.current === runId) {
          setRunning(false)
          sub.current = null
        }
      },
      complete() {
        if (runIdRef.current === runId) {
          setRunning(false)
          sub.current = null
        }
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
      <RateCurve rates={rates} running={running} />
      <Button
        css={css`
          margin-top: 12px;
        `}
        onClick={onClick}
      >
        {!running ? t('action.start') : t('action.stop')}
      </Button>
    </div>
  )
}
