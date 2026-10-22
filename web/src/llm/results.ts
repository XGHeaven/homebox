import type { BenchmarkConfig, RequestResult } from './benchmark'
import type { SpeedSample, TpsSample } from './speed'

export interface SavedResult {
  id: string
  config?: Omit<BenchmarkConfig, 'key'>
  elapsedMs: number
  results: RequestResult[]
  speedSamples: SpeedSample[]
  tpsSamples: TpsSample[]
}
export const legacyResultsKey = 'homebox:llm-results:v1'
export const resultPrefix = 'homebox:llm-result:v2:'
type ResultStorage = Pick<Storage, 'getItem' | 'setItem' | 'key' | 'length'>

export function snapshotConfig(config: Omit<BenchmarkConfig, 'key'> & { key?: string }): Omit<BenchmarkConfig, 'key'> {
  const { key: _key, ...safe } = config
  try {
    const url = new URL(safe.endpoint)
    url.search = ''
    url.hash = ''
    url.username = ''
    url.password = ''
    safe.endpoint = url.toString()
  } catch {
    safe.endpoint = ''
  }
  return safe
}
export function sanitizeResult(value: SavedResult): SavedResult {
  return {
    id: value.id,
    config: value.config ? snapshotConfig(value.config) : undefined,
    elapsedMs: value.elapsedMs,
    results: value.results.map(({ outputPreview: _preview, ...result }) => result),
    speedSamples: value.speedSamples,
    tpsSamples: value.tpsSamples,
  }
}
function isResult(value: any): value is SavedResult {
  return (
    value &&
    typeof value.id === 'string' &&
    Array.isArray(value.results) &&
    Array.isArray(value.speedSamples) &&
    Array.isArray(value.tpsSamples)
  )
}
export function readResults(storage: ResultStorage): SavedResult[] {
  const records = new Map<string, SavedResult>()
  const legacy = JSON.parse(storage.getItem(legacyResultsKey) || '[]')
  if (Array.isArray(legacy))
    for (const record of legacy) {
      if (isResult(record)) records.set(record.id, sanitizeResult(record))
    }
  // Each record has its own atomic storage key. Concurrent writes to different
  // records never replace a cached shared list. Tombstones also hide legacy rows.
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i)
    if (!key?.startsWith(resultPrefix)) continue
    const id = key.slice(resultPrefix.length)
    const value = JSON.parse(storage.getItem(key) || 'null')
    if (value === null) records.delete(id)
    else if (isResult(value) && value.id === id) records.set(id, sanitizeResult(value))
  }
  return [...records.values()].sort((a, b) => b.id.localeCompare(a.id))
}
export function saveResult(storage: ResultStorage, record: SavedResult) {
  storage.setItem(resultPrefix + record.id, JSON.stringify(sanitizeResult(record)))
}
export function removeResult(storage: ResultStorage, id: string) {
  storage.setItem(resultPrefix + id, 'null')
}
