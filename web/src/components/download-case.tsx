import React, { useContext, useRef } from 'react'
import { useState } from "react"
import { Button } from '@blueprintjs/core'
import { ChannelContext } from '../context'
import { css } from '@emotion/core'
import { SpeedIndicator } from './speed-indicator'

export function CaseRunner(props: {
  name: string,
  title: string,
}) {
  const createChannel = useContext(ChannelContext)
  const [rates, setRates] = useState<number[]>([])
  const rate = rates.reduce((a, r) => a + r, 0) / (rates.length + Number.MIN_VALUE)
  const rateRef = useRef(rates)
  rateRef.current = rates

  return (
    <div css={css`
      width: 100%;
      flex: auto;
      text-align: center;
      padding: 0 12px;
    `}>
      <h3>{props.title}</h3>
      <SpeedIndicator speed={rates.length ? rate : undefined}/>
      <Button onClick={async () => {
        const channel = await createChannel()
        setRates([])
        channel.observe(props.name as any, {packCount: 64, duration: 10 * 1000, interval: 200, parallel: 3}).subscribe((rate: number) => {
          const newRates = [...rateRef.current, rate]
          // 用 4s 的平均值
          if (newRates.length > 20) {
            newRates.shift()
          }

          setRates(newRates)
        }, (v: any) => console.log(v, 'done'))
        // TODO: 这个函数似乎就没成功调用过
      }}>Start</Button>
    </div>
  )
}
