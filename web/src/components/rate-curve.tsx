import { css } from '@emotion/react'
import { memo, useContext, useId, useMemo } from 'react'
import { ConfigContext, I18nContext } from '../context'
import { rateFormatters } from '../utils'

const WIDTH = 320
const HEIGHT = 116
const PADDING_X = 12
const PADDING_Y = 14
export const MAX_RATE_POINTS = 60

export function appendRatePoint(rates: number[], rate: number) {
  return [...rates.slice(-(MAX_RATE_POINTS - 1)), rate]
}

export const RateCurve = memo(function RateCurve({
  rates,
  running = false,
  formatter: formatValue,
}: {
  rates: number[]
  running?: boolean
  formatter?: (rate: number) => string
}) {
  const id = useId()
  const { unit } = useContext(ConfigContext)
  const t = useContext(I18nContext)
  const formatter = formatValue ?? rateFormatters[unit]
  const points = rates.slice(-MAX_RATE_POINTS)
  const maxRate = Math.max(...points, 0)
  const { linePath, areaPath } = useMemo(() => {
    if (points.length < 2 || maxRate <= 0) {
      return { linePath: '', areaPath: '' }
    }

    const innerWidth = WIDTH - PADDING_X * 2
    const innerHeight = HEIGHT - PADDING_Y * 2
    const line = points
      .map((rate, index) => {
        const x = PADDING_X + (index / (points.length - 1)) * innerWidth
        const y = PADDING_Y + innerHeight - (rate / maxRate) * innerHeight
        return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
      })
      .join(' ')

    return {
      linePath: line,
      areaPath: `${line} L ${WIDTH - PADDING_X} ${HEIGHT - PADDING_Y} L ${PADDING_X} ${HEIGHT - PADDING_Y} Z`,
    }
  }, [maxRate, points])
  const currentRate = points[points.length - 1]
  const strokeColor = running ? '#2f8f46' : '#137cbd'
  const sanitizedId = id.replace(/:/g, '')
  const gradientId = `rate-curve-${sanitizedId}`
  const titleId = `rate-curve-title-${sanitizedId}`
  const currentLabel = points.length ? formatter(currentRate) : '--'
  const peakLabel = maxRate > 0 ? formatter(maxRate) : '--'

  return (
    <div
      css={css`
        margin-top: 12px;
        padding: 10px 12px 8px;
        border: 1px solid rgba(127, 127, 127, 0.18);
        border-radius: 8px;
        background: rgba(127, 127, 127, 0.06);
      `}
    >
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role='img'
        aria-labelledby={titleId}
        css={css`
          display: block;
          width: 100%;
          height: ${HEIGHT}px;
          color: currentColor;
        `}
      >
        <title id={titleId}>
          {t('chart.title')}: {currentLabel}, {t('chart.peak')} {peakLabel}
        </title>
        <defs>
          <linearGradient id={gradientId} x1='0' x2='0' y1='0' y2='1'>
            <stop offset='0%' stopColor={strokeColor} stopOpacity='0.28' />
            <stop offset='100%' stopColor={strokeColor} stopOpacity='0.02' />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((scale) => {
          const y = PADDING_Y + (HEIGHT - PADDING_Y * 2) * scale
          return (
            <line
              key={scale}
              x1={PADDING_X}
              y1={y}
              x2={WIDTH - PADDING_X}
              y2={y}
              stroke='currentColor'
              strokeOpacity='0.08'
              strokeDasharray='3 5'
            />
          )
        })}
        <line
          x1={PADDING_X}
          y1={HEIGHT - PADDING_Y}
          x2={WIDTH - PADDING_X}
          y2={HEIGHT - PADDING_Y}
          stroke='currentColor'
          strokeOpacity='0.16'
        />
        {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
        {linePath ? (
          <>
            <path
              d={linePath}
              fill='none'
              stroke='rgba(255, 255, 255, 0.45)'
              strokeWidth='5'
              strokeLinecap='round'
              strokeLinejoin='round'
              opacity='0.28'
            />
            <path
              d={linePath}
              fill='none'
              stroke={strokeColor}
              strokeWidth='2.75'
              strokeLinecap='round'
              strokeLinejoin='round'
            />
          </>
        ) : (
          <text x={WIDTH / 2} y={HEIGHT / 2 + 4} textAnchor='middle' fill='currentColor' opacity='0.45' fontSize='13'>
            --
          </text>
        )}
      </svg>
      <div
        css={css`
          display: flex;
          justify-content: space-between;
          gap: 12px;
          font-size: 12px;
          line-height: 1.3;
        `}
      >
        <span
          css={css`
            min-width: 0;
            color: ${strokeColor};
            font-weight: 600;
          `}
        >
          {currentLabel}
        </span>
        <span
          css={css`
            min-width: 0;
            opacity: 0.68;
          `}
        >
          {t('chart.peak')} {peakLabel}
        </span>
      </div>
    </div>
  )
})
