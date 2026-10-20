import { BenchmarkConfig, resolveEndpoint } from './benchmark'

type Connection = Pick<BenchmarkConfig, 'endpoint' | 'protocol' | 'key'>

export function resolveModelsEndpoint({ endpoint, protocol }: Connection): string {
  const url = new URL(resolveEndpoint(endpoint, protocol))
  const suffix = { openai: '/chat/completions', anthropic: '/messages', ollama: '/chat' }[protocol]
  url.pathname =
    url.pathname.replace(/\/+$/, '').slice(0, -suffix.length) + (protocol === 'ollama' ? '/tags' : '/models')
  return url.toString()
}

export async function fetchModels(connection: Connection, signal: AbortSignal): Promise<string[]> {
  const url = new URL(resolveModelsEndpoint(connection))
  const models = new Set<string>()
  const cursors = new Set<string>()
  for (let page = 0; page < 100; page++) {
    const response = await fetch('/api/llm/models', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Homebox-LLM': '1' },
      body: JSON.stringify({ url: url.toString(), protocol: connection.protocol, key: connection.key.trim() }),
      signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const data = await response.json()
    const items = connection.protocol === 'ollama' ? data?.models : data?.data
    if (!Array.isArray(items)) throw new Error('Invalid model list')
    for (const item of items) {
      const id = connection.protocol === 'ollama' ? item?.name || item?.model : item?.id
      if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid model ID')
      models.add(id)
    }
    if (connection.protocol !== 'anthropic' || !data.has_more) return [...models].sort()
    if (typeof data.last_id !== 'string' || !data.last_id || cursors.has(data.last_id)) {
      throw new Error('Invalid pagination cursor')
    }
    cursors.add(data.last_id)
    url.searchParams.set('after_id', data.last_id)
  }
  throw new Error('Too many model pages')
}
