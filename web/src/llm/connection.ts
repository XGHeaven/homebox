import type { BenchmarkConfig } from './benchmark'

export const CONNECTION_STORAGE_KEY = 'homebox:llm-connection:v1'
export type Connection = Pick<BenchmarkConfig, 'endpoint' | 'protocol' | 'key'>
export function readConnection(storage: Pick<Storage, 'getItem'>): Connection | undefined {
  const raw = storage.getItem(CONNECTION_STORAGE_KEY)
  if (!raw) return undefined
  const value = JSON.parse(raw)
  if (
    !value ||
    typeof value.endpoint !== 'string' ||
    !['openai', 'anthropic', 'ollama'].includes(value.protocol) ||
    (value.rememberKey !== undefined && typeof value.rememberKey !== 'boolean') ||
    (value.key !== undefined && typeof value.key !== 'string')
  )
    throw new Error('Invalid saved connection')
  return {
    endpoint: value.endpoint,
    protocol: value.protocol,
    key: value.rememberKey === false ? '' : value.key ?? '',
  }
}
export function writeConnection(
  storage: Pick<Storage, 'setItem'>,
  config: Pick<BenchmarkConfig, 'endpoint' | 'protocol' | 'key'>,
) {
  storage.setItem(
    CONNECTION_STORAGE_KEY,
    JSON.stringify({
      endpoint: config.endpoint,
      protocol: config.protocol,
      ...(config.key ? { key: config.key } : {}),
    }),
  )
}
