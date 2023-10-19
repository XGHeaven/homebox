import { ProgressBar, ProgressBarProps, Tag } from '@blueprintjs/core'
import { css } from '@emotion/react'
import { memo, useContext } from 'react'
import { ConfigContext } from '../context'
import { rateFormatters } from '../utils'

const K = 1024
const SPEED_SPANS = [64, 128, 256, 512, 1024, 2 * K, 4 * K, 8 * K, 16 * K, 32 * K, 1024 * K].map((v) => v * K)
const SPAN_PERCENT = 1 / SPEED_SPANS.length

export const SpeedIndicator = memo(function SpeedIndicator({
  speed,
  running = false,
}: {
  speed?: number
  running?: boolean
}) {
  const { unit } = useContext(ConfigContext)
  const formatter = rateFormatters[unit]
  const pbp: ProgressBarProps = {}
  if (typeof speed === 'number') {
    const i = SPEED_SPANS.findIndex((v) => v >= speed)
    if (i === -1) {
      pbp.value = 1
    } else if (i === 0) {
      pbp.value = (speed / SPEED_SPANS[0]) * SPAN_PERCENT
    } else {
      pbp.value =
        i * SPAN_PERCENT + ((speed - SPEED_SPANS[i - 1]) / (SPEED_SPANS[i] - SPEED_SPANS[i - 1])) * SPAN_PERCENT
    }

    if (pbp.value < 0.1) {
      pbp.intent = 'danger'
    } else if (pbp.value < 0.3) {
      pbp.intent = 'warning'
    } else if (pbp.value < 0.5) {
      pbp.intent = 'primary'
    } else {
      pbp.intent = 'success'
    }
  }
  return (
    <div
      css={css`
        display: flex;
        align-items: center;
      `}
    >
      <ProgressBar css={css``} {...pbp} animate={running} />
      <Tag
        round={true}
        css={css`
          flex: none;
          margin-left: 8px;
        `}
        intent={pbp.intent}
      >
        {speed !== undefined ? formatter(speed) : 'Waiting...'}
      </Tag>
    </div>
  )
})
