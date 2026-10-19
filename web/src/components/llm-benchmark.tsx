import { LlmMetrics } from './llm-metrics'
import { LlmResults, SavedResult } from './llm-results'
import { AdvancedSettings, AdvancedSettingsButton, BenchmarkToolbar } from './benchmark-controls'
import { readConnection, writeConnection } from '../llm/connection'
import { LlmSpeedChart } from './llm-speed-chart'
import { sampleSpeed, SpeedSample, sampleRequestTps, TpsSample } from '../llm/speed'
import { LlmModelInput } from './llm-model-input'
import { useContext, useEffect, useRef, useState } from 'react'
import { Button, Callout, Checkbox, FormGroup, HTMLSelect, InputGroup, ProgressBar, TextArea } from '@blueprintjs/core'
import styled from '@emotion/styled'
import { ConfigContext, I18nContext } from '../context'
import {
  BenchmarkConfig,
  BENCHMARK_LIMITS,
  defaultConfig,
  RequestResult,
  resolveEndpoint,
  responseLengthInstruction,
  runBenchmark,
  validateConfig,
} from '../llm/benchmark'
import { llmMessages } from '../llm/messages'

const Layout = styled.section`
  .test-actions {
    text-align: center;
    margin-top: 16px;
  }
  .test-actions > button + button {
    margin-left: 8px;
  }
  summary {
    cursor: pointer;
  }
`
const ConfigSection = styled.details`
  &,
  & * {
    box-sizing: border-box;
  }
  margin: 0 0 24px;
  summary {
    cursor: pointer;
    font-weight: 600;
    line-height: 1.6;
  }
  .section-caption {
    font-weight: 400;
    font-size: 12px;
    opacity: 0.7;
    margin-left: 12px;
    overflow-wrap: anywhere;
  }
  .section-content {
    padding-top: 16px;
  }
  .bp5-form-helper-text {
    overflow-wrap: anywhere;
  }
  @media (max-width: 540px) {
    .section-caption {
      display: block;
      margin-left: 0;
      margin-top: 4px;
    }
  }
`
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0 18px;
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`
const Notes = styled.p`
  font-size: 12px;
  line-height: 1.6;
  opacity: 0.8;
`
const format = (value: number | undefined, unit = '') => (value === undefined ? '—' : `${value.toFixed(2)}${unit}`)

const seconds = (ms: number | undefined, unit = ' s') => format(ms === undefined ? undefined : ms / 1000, unit)

export function LlmBenchmark({ onRunningChange }: { onRunningChange: (running: boolean) => void }) {
  const { locale } = useContext(ConfigContext)
  const common = useContext(I18nContext)
  const t = llmMessages[locale]
  const [savedConnection] = useState(() => {
    try {
      return { value: readConnection(localStorage), failed: false }
    } catch {
      return { value: undefined, failed: true }
    }
  })
  const [config, setConfig] = useState<BenchmarkConfig>(() => ({
    ...defaultConfig,
    concurrency: 1,
    ...(savedConnection.value
      ? {
          endpoint: savedConnection.value.endpoint,
          protocol: savedConnection.value.protocol,
          key: savedConnection.value.key,
        }
      : {}),
  }))
  const [storageError, setStorageError] = useState(savedConnection.failed)
  const firstSave = useRef(true)
  useEffect(() => {
    if (firstSave.current) {
      firstSave.current = false
      return
    }
    try {
      writeConnection(localStorage, { endpoint: config.endpoint, protocol: config.protocol, key: config.key })
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [config.endpoint, config.protocol, config.key])
  const [connectionOpen, setConnectionOpen] = useState(true)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [results, setResults] = useState<RequestResult[]>([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [runId, setRunId] = useState('')
  const [running, setRunning] = useState(false)
  const [speedSamples, setSpeedSamples] = useState<SpeedSample[]>([])
  const [tpsSamples, setTpsSamples] = useState<TpsSample[]>([])
  const liveResults = useRef<RequestResult[]>([])
  const lastSample = useRef<SpeedSample>({ time: 0, characters: 0, rate: 0 })
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const controller = useRef<AbortController>()
  const snapshot = useRef<Omit<BenchmarkConfig, 'key'> & { key?: never }>()
  useEffect(() => () => controller.current?.abort(), [])
  const update = <K extends keyof BenchmarkConfig>(key: K, value: BenchmarkConfig[K]) => {
    setConfig((current) => ({ ...current, [key]: value }))
  }
  let connectionLabel = t.connectionEmpty
  try {
    connectionLabel = `${new URL(config.endpoint).host} · ${config.protocol}`
  } catch {
    /* Not configured yet. */
  }

  async function start() {
    if (controller.current) return
    const runConfig = { ...config }
    try {
      validateConfig(runConfig)
    } catch (err) {
      try {
        resolveEndpoint(config.endpoint, config.protocol)
      } catch {
        setConnectionOpen(true)
      }
      if (
        !config.prompt.trim() ||
        [config.maxTokens, config.timeoutSeconds, config.concurrency].some(
          (value) => !Number.isInteger(value) || value < 1,
        ) ||
        config.maxTokens > 131072 ||
        config.timeoutSeconds > 600 ||
        config.concurrency > 32
      )
        setAdvancedOpen(true)
      setError(err instanceof Error ? err.message : 'Invalid configuration')
      return
    }
    const abortController = new AbortController()
    controller.current = abortController
    const { key: _key, ...safeConfig } = runConfig
    snapshot.current = safeConfig
    setError('')
    setRunId(new Date().toISOString())
    setElapsed(0)
    setResults([])
    liveResults.current = []
    lastSample.current = { time: 0, characters: 0, rate: 0 }
    setSpeedSamples([lastSample.current])
    setTpsSamples([])
    setRunning(true)
    onRunningChange(true)
    const startTime = performance.now()
    const collectSpeed = (force = false) => {
      const now = performance.now() - startTime
      setElapsed(now)
      if (now - lastSample.current.time < (force ? 1 : 1000)) return
      const sample = sampleSpeed(
        lastSample.current,
        now,
        liveResults.current.reduce((sum, r) => sum + (r.outputCharacters ?? 0), 0),
      )
      lastSample.current = sample
      setSpeedSamples((previous) => [...previous.slice(-1199), sample])
    }
    const timer = setInterval(collectSpeed, 200)
    try {
      const duration = await runBenchmark(runConfig, abortController.signal, (result) => {
        const previousStatus = liveResults.current[result.id]?.status
        liveResults.current[result.id] = result
        if (result.status === 'error') setError(result.error || (locale === 'zh' ? '请求失败' : 'Request failed'))
        if (['success', 'error', 'cancelled'].includes(result.status) && previousStatus !== result.status) {
          const point = sampleRequestTps(result, performance.now() - startTime)
          setTpsSamples((previous) => [...previous, point])
        }
        setResults((previous) => {
          const next = [...previous]
          next[result.id] = result
          return next
        })
      })
      setElapsed(duration)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Benchmark failed')
    } finally {
      clearInterval(timer)
      collectSpeed(true)
      controller.current = undefined
      setRunning(false)
      onRunningChange(false)
    }
  }
  const record: SavedResult = {
    id: runId,
    config: snapshot.current,
    elapsedMs: elapsed,
    results: results.map(({ outputPreview: _preview, ...result }) => result),
    speedSamples,
    tpsSamples,
  }
  const numberFields = [
    ['maxTokens', t.maxTokens, 131072],
    ['concurrency', t.concurrency, 32],
    ['timeoutSeconds', t.timeout, 600],
  ] as const
  const advancedFields = (
    <fieldset disabled={running} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
      <Grid>
        {numberFields
          .filter(([key]) => key === 'concurrency')
          .map(([key, label, max]) => (
            <FormGroup key={key} label={label} labelFor={`llm-${key}`}>
              <InputGroup
                id={`llm-${key}`}
                type='number'
                min={1}
                max={max}
                step={1}
                value={String(config[key])}
                onChange={(e) => update(key, Number(e.target.value))}
              />
            </FormGroup>
          ))}
      </Grid>
      <FormGroup label={t.prompt} labelFor='llm-prompt'>
        <TextArea
          id='llm-prompt'
          fill
          rows={3}
          value={config.prompt}
          onChange={(e) => update('prompt', e.target.value)}
        />
      </FormGroup>
      <Grid>
        {numberFields
          .filter(([key]) => key === 'maxTokens' || key === 'timeoutSeconds')
          .map(([key, label, max]) => (
            <FormGroup key={key} label={label} labelFor={`llm-${key}`}>
              <InputGroup
                id={`llm-${key}`}
                type='number'
                min={1}
                max={max}
                step={1}
                value={String(config[key])}
                onChange={(e) => update(key, Number(e.target.value))}
              />
            </FormGroup>
          ))}
      </Grid>
      <FormGroup>
        <Checkbox
          checked={config.constrainPrompt !== false}
          label={t.constrainPrompt}
          onChange={(event) => update('constrainPrompt', event.currentTarget.checked)}
        />
        {config.constrainPrompt !== false && (
          <details>
            <summary>{t.sentInstruction}</summary>
            <Notes>{responseLengthInstruction(config.maxTokens)}</Notes>
          </details>
        )}
      </FormGroup>
      {config.protocol === 'openai' && (
        <>
          <FormGroup label={t.tokenParameter} labelFor='llm-token-parameter'>
            <HTMLSelect
              id='llm-token-parameter'
              value={config.tokenParameter}
              onChange={(e) => update('tokenParameter', e.target.value as BenchmarkConfig['tokenParameter'])}
            >
              <option value='max_tokens'>max_tokens</option>
              <option value='max_completion_tokens'>max_completion_tokens</option>
            </HTMLSelect>
          </FormGroup>
          <Checkbox
            checked={config.includeUsage}
            label={t.usage}
            onChange={(e) => update('includeUsage', e.currentTarget.checked)}
          />
        </>
      )}
    </fieldset>
  )
  return (
    <Layout>
      <BenchmarkToolbar>
        <Button minimal icon='history' onClick={() => setHistoryOpen(true)}>
          {locale === 'zh' ? '结果记录' : 'Results'}
        </Button>
        <AdvancedSettingsButton open={advancedOpen} onToggle={() => setAdvancedOpen(!advancedOpen)} />
      </BenchmarkToolbar>
      <AdvancedSettings open={advancedOpen} onClose={() => setAdvancedOpen(false)}>
        {() => advancedFields}
      </AdvancedSettings>
      <ConfigSection open={connectionOpen} onToggle={(event) => setConnectionOpen(event.currentTarget.open)}>
        <summary>
          {t.connection}
          <span className='section-caption'>{connectionLabel}</span>
        </summary>
        <div className='section-content'>
          <fieldset disabled={running} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <FormGroup label={t.endpoint} labelFor='llm-endpoint'>
              <InputGroup
                id='llm-endpoint'
                value={config.endpoint}
                placeholder='http://localhost:11434/v1'
                autoComplete='off'
                onChange={(e) => update('endpoint', e.target.value)}
              />
            </FormGroup>

            <Grid>
              <FormGroup label={t.protocol} labelFor='llm-protocol'>
                <HTMLSelect
                  id='llm-protocol'
                  fill
                  value={config.protocol}
                  onChange={(e) => update('protocol', e.target.value as BenchmarkConfig['protocol'])}
                >
                  <option value='openai'>OpenAI Chat Completions</option>
                  <option value='anthropic'>Anthropic Messages</option>
                  <option value='ollama'>Ollama Chat</option>
                </HTMLSelect>
              </FormGroup>

              <FormGroup label={t.key} labelFor='llm-key'>
                <InputGroup
                  id='llm-key'
                  placeholder={t.optionalKey}
                  type='password'
                  autoComplete='new-password'
                  value={config.key}
                  onChange={(e) => update('key', e.target.value)}
                />
              </FormGroup>
            </Grid>
            {storageError && (
              <span className='bp5-form-helper-text' role='alert'>
                {t.autosaveFailed}
              </span>
            )}
          </fieldset>
        </div>
      </ConfigSection>
      <div>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            start()
          }}
        >
          <fieldset disabled={running} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
            <FormGroup label={t.model} labelFor='llm-model'>
              <LlmModelInput config={config} disabled={running} onChange={(value) => update('model', value)} t={t} />
            </FormGroup>
          </fieldset>
        </form>
      </div>
      <LlmMetrics results={results} />
      {error && <Callout intent='danger'>{error}</Callout>}
      {results.length > 0 && (
        <>
          <div aria-live='polite'>
            {running ? t.running : t.finished} · {seconds(elapsed)}
          </div>
          <ProgressBar
            value={running ? Math.min(elapsed / BENCHMARK_LIMITS.maxDurationMs, 1) : 1}
            animate={running}
            stripes={running}
            intent={error ? 'danger' : 'success'}
          />

          <LlmSpeedChart samples={speedSamples} tpsSamples={tpsSamples} />
        </>
      )}
      <div className='test-actions'>
        <Button type='button' onClick={() => (running ? controller.current?.abort() : start())}>
          {common(running ? 'action.stop' : results.length ? 'action.restart' : 'action.start')}
        </Button>
      </div>
      <LlmResults record={record} running={running} open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </Layout>
  )
}
