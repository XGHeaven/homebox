import styled from '@emotion/styled'
import { MetricHelp } from './metric-help'
import { summarize, RequestResult } from '../llm/benchmark'
import { llmMessages } from '../llm/messages'
import { useContext } from 'react'
import { ConfigContext } from '../context'
const Stats = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  @media (max-width: 719px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  > div {
    flex: 1;
    text-align: center;
    min-width: 0;
  }
  strong {
    display: block;
    font-size: 24px;
    font-weight: bold;
  }
  .metric-label {
    display: inline-flex;
    align-items: center;
    white-space: nowrap;
  }
`
const format = (n: number | undefined, unit = '') => (n === undefined ? '—' : n.toFixed(2) + unit)
const seconds = (n: number | undefined) => format(n === undefined ? undefined : n / 1000, ' s')
export function LlmMetrics({ results }: { results: RequestResult[] }) {
  const { locale } = useContext(ConfigContext)
  const t = llmMessages[locale]
  const summary = summarize(results)
  return (
    <Stats>
      <div>
        <span className='metric-label'>
          {t.ttft}
          <MetricHelp label={t.ttft} description={t.ttftHelp} />
        </span>
        <strong>{seconds(summary.ttft)}</strong>
      </div>
      <div>
        <span className='metric-label'>
          {t.tps}
          <MetricHelp label={t.tps} description={t.tpsHelp} />
        </span>
        <strong>{format(summary.tps, ' tok/s')}</strong>
      </div>
      <div>
        <span className='metric-label'>
          {t.endToEndTps}
          <MetricHelp label={t.endToEndTps} description={t.endToEndTpsHelp} />
        </span>
        <strong>{format(summary.endToEndTps, ' tok/s')}</strong>
      </div>
      <div>
        <span className='metric-label'>
          {t.tokens}
          <MetricHelp label={t.tokens} description={t.tokensHelp} />
        </span>
        <strong>
          {summary.totalTokens === undefined
            ? '—'
            : `${summary.totalTokensIncomplete ? '≥ ' : ''}${summary.totalTokens.toLocaleString()}`}
        </strong>
      </div>
    </Stats>
  )
}
