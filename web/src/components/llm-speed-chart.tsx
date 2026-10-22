import { MetricHelp } from './metric-help'
import { llmMessages } from '../llm/messages'
import { useContext } from 'react'
import styled from '@emotion/styled'
import { ConfigContext } from '../context'
import { SpeedSample, TpsSample } from '../llm/speed'

const Chart = styled.div`
  margin: 16px 0;
  padding: 12px;
  border: 1px solid rgba(127, 127, 127, 0.18);
  border-radius: 8px;
  background: rgba(127, 127, 127, 0.06);
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 20px;
    font-size: 12px;
    margin-bottom: 8px;
  }
  .legend > span {
    display: inline-flex;
    align-items: center;
    white-space: pre;
  }
  > svg {
    display: block;
    width: 100%;
    height: 190px;
  }
`

export function LlmSpeedChart({ samples, tpsSamples }: { samples: SpeedSample[]; tpsSamples: TpsSample[] }) {
  const { locale } = useContext(ConfigContext)
  const zh = locale === 'zh'
  const t = llmMessages[locale]
  const latestTps = tpsSamples[tpsSamples.length - 1]?.rate
  const characterMax = Math.max(1, ...samples.map((s) => s.rate))
  const tpsMax = Math.max(1, ...tpsSamples.map((s) => s.rate ?? 0))
  const from = samples[0]?.time ?? 0
  const to = Math.max(
    from + 1000,
    samples[samples.length - 1]?.time ?? 0,
    tpsSamples?.[tpsSamples.length - 1]?.time ?? 0,
  )
  const y = (rate: number) => 154 - (rate / characterMax) * 130
  const tpsY = (rate: number) => 154 - (rate / tpsMax) * 130
  const path = samples
    .map((s, i) => `${i ? 'L' : 'M'} ${48 + ((s.time - from) / (to - from)) * 500} ${y(s.rate)}`)
    .join(' ')
  const visibleTps = (tpsSamples ?? []).filter((point) => point.time >= from)
  const x = (time: number) => 48 + ((time - from) / (to - from)) * 500
  const tpsPath = visibleTps
    .map((point, index) =>
      point.rate === undefined
        ? ''
        : `${index > 0 && visibleTps[index - 1].rate !== undefined ? 'L' : 'M'} ${x(point.time)} ${tpsY(point.rate)}`,
    )
    .join(' ')
  return (
    <Chart>
      <div className='legend'>
        <span style={{ color: '#2f8f46' }}>
          ━ {zh ? '字符速度' : 'Character speed'} · {samples[samples.length - 1]?.rate.toFixed(1) ?? '—'}{' '}
          {zh ? '字符/s' : 'char/s'}
          <MetricHelp label={zh ? '字符速度' : 'Character speed'} description={t.characterSpeedHelp} />
        </span>
        <span style={{ color: '#137cbd' }}>
          ┄ {t.tps} · {latestTps?.toFixed(2) ?? '—'} tok/s
          <MetricHelp label={t.tps} description={t.tpsCurveHelp} />
        </span>
      </div>
      <svg viewBox='0 0 600 185' role='img' aria-label={zh ? '字符速度与 TPS 曲线' : 'Character speed and TPS chart'}>
        <text x='48' y='12' fill='#2f8f46' fontSize='11'>
          {zh ? '字符/s' : 'char/s'}
        </text>
        <text x='548' y='12' textAnchor='end' fill='#137cbd' fontSize='11'>
          TPS
        </text>
        {[0, 0.5, 1].map((n) => (
          <g key={n}>
            <line
              x1='48'
              x2='548'
              y1={y(characterMax * n)}
              y2={y(characterMax * n)}
              stroke='currentColor'
              strokeOpacity='.12'
              strokeDasharray='3 5'
            />
            <text x='40' y={y(characterMax * n) + 4} textAnchor='end' fill='#2f8f46' fontSize='11'>
              {(characterMax * n).toFixed(characterMax < 10 ? 1 : 0)}
            </text>
            <text x='556' y={tpsY(tpsMax * n) + 4} fill='#137cbd' fontSize='11'>
              {(tpsMax * n).toFixed(tpsMax < 10 ? 1 : 0)}
            </text>
          </g>
        ))}
        <path d={path} fill='none' stroke='#2f8f46' strokeWidth='2.5' strokeLinejoin='round' />
        <>
          <path d={tpsPath} fill='none' stroke='#137cbd' strokeWidth='2' strokeDasharray='6 4' />
          {visibleTps.map((point, index) =>
            point.rate === undefined ? null : (
              <circle key={index} cx={x(point.time)} cy={tpsY(point.rate)} r='3' fill='#137cbd'>
                <title>
                  {(point.time / 1000).toFixed(2)} s · {point.rate.toFixed(2)} tok/s
                </title>
              </circle>
            ),
          )}
        </>
        <text x='48' y='178' fill='currentColor' fontSize='11'>
          {(from / 1000).toFixed(1)} s
        </text>
        <text x='548' y='178' textAnchor='end' fill='currentColor' fontSize='11'>
          {(to / 1000).toFixed(1)} s
        </text>
      </svg>
    </Chart>
  )
}
