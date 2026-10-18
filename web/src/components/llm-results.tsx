import { useContext, useRef, useState } from 'react'
import { Button, Callout, Dialog, HTMLSelect } from '@blueprintjs/core'
import { toPng } from 'html-to-image'
import { ConfigContext } from '../context'
import { Theme } from '../types'
import { BenchmarkConfig, RequestResult, summarize } from '../llm/benchmark'
import { SpeedSample, TpsSample } from '../llm/speed'
import { LlmMetrics } from './llm-metrics'
import { LlmSpeedChart } from './llm-speed-chart'

export interface SavedResult {
  id: string
  config?: Omit<BenchmarkConfig, 'key'>
  elapsedMs: number
  results: RequestResult[]
  speedSamples: SpeedSample[]
  tpsSamples: TpsSample[]
}
const storageKey = 'homebox:llm-results:v1'
function download(url: string, name: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
}
export function LlmResults({
  record,
  running,
  open,
  onClose,
}: {
  record: SavedResult
  running: boolean
  open: boolean
  onClose: () => void
}) {
  const { locale, theme } = useContext(ConfigContext)
  const zh = locale === 'zh'
  const [error, setError] = useState('')
  const [saved, setSaved] = useState<SavedResult[]>(() => {
    try {
      const data = JSON.parse(localStorage.getItem(storageKey) || '[]')
      return Array.isArray(data)
        ? data.filter(
            (r) =>
              typeof r.id === 'string' &&
              Array.isArray(r.results) &&
              Array.isArray(r.speedSamples) &&
              Array.isArray(r.tpsSamples),
          )
        : []
    } catch {
      return []
    }
  })
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const capture = useRef<HTMLDivElement>(null)
  const historyCapture = useRef<HTMLDivElement>(null)
  const hasCurrent = !running && record.results.length > 0
  const active = saved.find((r) => r.id === selected) ?? (hasCurrent ? record : saved[0])
  const alreadySaved = saved.some((r) => r.id === record.id)
  function deleteResult() {
    if (!active) return
    try {
      const next = saved.filter((r) => r.id !== active.id)
      localStorage.setItem(storageKey, JSON.stringify(next))
      setSaved(next)
      setSelected(hasCurrent ? '' : next[0]?.id ?? '')
      setError('')
    } catch {
      setError(zh ? '删除失败，请重试。' : 'Unable to delete. Please retry.')
    }
  }
  function save() {
    try {
      const next = [record, ...saved.filter((r) => r.id !== record.id)]
      localStorage.setItem(storageKey, JSON.stringify(next))
      setSaved(next)
      setError('')
    } catch {
      setError(zh ? '保存失败，浏览器存储空间可能不足。' : 'Unable to save. Browser storage may be full.')
    }
  }
  function exportJson(value: SavedResult) {
    const blob = new Blob([JSON.stringify({ ...value, summary: summarize(value.results) }, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    download(url, 'homebox-llm-result.json')
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function screenshot(node: HTMLDivElement | null) {
    if (!node) return
    setBusy(true)
    try {
      download(
        await toPng(node, {
          pixelRatio: 2,
          filter: (node) => !(node instanceof HTMLElement && node.tagName === 'BUTTON'),
        }),
        'homebox-llm-result.png',
      )
      setError('')
    } catch {
      setError(zh ? '截图导出失败，请重试。' : 'Screenshot export failed. Please retry.')
    } finally {
      setBusy(false)
    }
  }
  const report = (value: SavedResult) => (
    <>
      <h3 style={{ marginTop: 0, overflowWrap: 'anywhere' }}>Homebox · {value.config?.model || 'LLM'}</h3>
      <p>
        {value.id ? new Date(value.id).toLocaleString() : ''} · {(value.elapsedMs / 1000).toFixed(1)} s
      </p>
      <LlmMetrics results={value.results} />
      <LlmSpeedChart samples={value.speedSamples} tpsSamples={value.tpsSamples} />
    </>
  )
  const reportStyle = {
    padding: 24,
    background: theme === Theme.Dark ? '#10181b' : '#fff',
    color: theme === Theme.Dark ? '#eee' : '#182026',
  }
  return (
    <>
      {error && <Callout intent='danger'>{error}</Callout>}
      {hasCurrent && (
        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Button icon='floppy-disk' disabled={alreadySaved} onClick={save}>
            {alreadySaved ? (zh ? '已保存' : 'Saved') : zh ? '保存结果' : 'Save result'}
          </Button>
          <Button
            icon='camera'
            loading={busy}
            onClick={() => {
              screenshot(capture.current)
            }}
          >
            {zh ? '导出截图' : 'Export image'}
          </Button>
          <Button icon='download' onClick={() => exportJson(record)}>
            {zh ? '导出结果' : 'Export result'}
          </Button>
        </div>
      )}
      {hasCurrent && (
        <div
          style={{ position: 'fixed', left: -10000, top: 0, width: 760, pointerEvents: 'none' }}
          aria-hidden='true'
          ref={(node) => node?.setAttribute('inert', '')}
        >
          <div ref={capture} style={reportStyle}>
            {report(record)}
          </div>
        </div>
      )}
      <Dialog
        isOpen={open}
        onClose={onClose}
        title={zh ? '结果记录' : 'Results'}
        className={theme === Theme.Dark ? 'bp5-dark' : ''}
        style={{ width: 800, maxWidth: 'calc(100vw - 24px)' }}
      >
        <div style={{ padding: 12, maxHeight: '75vh', overflowY: 'auto' }}>
          {error && <Callout intent='danger'>{error}</Callout>}
          {active ? (
            <>
              <HTMLSelect
                fill
                value={selected || (hasCurrent ? '' : saved[0]?.id)}
                onChange={(e) => setSelected(e.target.value)}
                style={{ marginBottom: 16 }}
              >
                {hasCurrent && <option value=''>{zh ? '当前结果' : 'Current result'}</option>}
                {saved.map((r) => (
                  <option key={r.id} value={r.id}>
                    {new Date(r.id).toLocaleString()} · {r.config?.model}
                  </option>
                ))}
              </HTMLSelect>
              <div ref={historyCapture} style={reportStyle}>
                {report(active)}
              </div>
              <Button
                icon='camera'
                loading={busy}
                onClick={() => {
                  screenshot(historyCapture.current)
                }}
              >
                {zh ? '导出截图' : 'Export image'}
              </Button>
              <Button icon='download' onClick={() => exportJson(active)}>
                {zh ? '导出结果' : 'Export result'}
              </Button>
              {saved.some((r) => r.id === active.id) && (
                <Button minimal intent='danger' icon='trash' onClick={deleteResult}>
                  {zh ? '删除结果' : 'Delete result'}
                </Button>
              )}
            </>
          ) : (
            <p>{zh ? '暂无结果' : 'No results yet'}</p>
          )}
        </div>
      </Dialog>
    </>
  )
}
