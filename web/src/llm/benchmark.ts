export type Protocol = 'openai' | 'anthropic' | 'ollama'
export interface BenchmarkConfig {
  endpoint: string
  key: string
  protocol: Protocol
  model: string
  prompt: string
  maxTokens: number
  concurrency: number
  timeoutSeconds: number
  includeUsage: boolean
  constrainPrompt?: boolean
  tokenParameter: 'max_tokens' | 'max_completion_tokens'
}
export interface RequestResult {
  id: number
  status: 'queued' | 'running' | 'success' | 'error' | 'cancelled'
  ttfb?: number
  ttft?: number
  duration?: number
  inputTokens?: number
  totalTokens?: number
  outputTokens?: number
  outputCharacters?: number
  outputPreview?: string
  tps?: number
  endToEndTps?: number
  error?: string
}
export const defaultConfig: BenchmarkConfig = {
  endpoint: '',
  key: '',
  protocol: 'openai',
  model: '',
  prompt: 'Briefly explain how a computer network works.',
  maxTokens: 512,
  concurrency: 1,
  timeoutSeconds: 300,
  includeUsage: true,
  constrainPrompt: true,
  tokenParameter: 'max_tokens',
}

export function resolveEndpoint(endpoint: string, protocol: Protocol): string {
  const url = new URL(endpoint.trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) {
    throw new Error('Use an HTTP(S) URL without embedded credentials or a fragment.')
  }
  const path = url.pathname.replace(/\/+$/, '')
  const suffix = { openai: '/chat/completions', anthropic: '/messages', ollama: '/chat' }[protocol]
  if (!path.endsWith(suffix)) {
    url.pathname = path + (path ? '' : protocol === 'ollama' ? '/api' : '/v1') + suffix
  }
  return url.toString()
}

export function validateConfig(config: BenchmarkConfig, requireModel = true) {
  resolveEndpoint(config.endpoint, config.protocol)
  if ((requireModel && !config.model.trim()) || !config.prompt.trim()) throw new Error('Model and prompt are required.')
  for (const [name, value, max] of [
    ['concurrency', config.concurrency, 32],
    ['maxTokens', config.maxTokens, 131072],
    ['timeoutSeconds', config.timeoutSeconds, 600],
  ] as const) {
    if (!Number.isInteger(value) || value < 1 || value > max) throw new Error(`${name}: 1–${max}`)
  }
}

export function responseLengthInstruction(maxTokens: number): string {
  return `Response length requirement: Keep your answer concise and within approximately ${maxTokens} output tokens. Prioritize the essential points, avoid repetition and unnecessary examples, and finish promptly. Do not try to fill the token budget.`
}

export function buildRequest(config: BenchmarkConfig) {
  const prompt =
    config.constrainPrompt === false
      ? config.prompt
      : `${config.prompt}\n\n${responseLengthInstruction(config.maxTokens)}`
  const body: Record<string, unknown> = {
    model: config.model.trim(),
    messages: [{ role: 'user', content: prompt }],
    stream: true,
  }
  if (config.protocol === 'ollama') body.options = { num_predict: config.maxTokens }
  else body[config.protocol === 'openai' ? config.tokenParameter : 'max_tokens'] = config.maxTokens
  if (config.protocol === 'openai' && config.includeUsage) body.stream_options = { include_usage: true }
  return {
    url: resolveEndpoint(config.endpoint, config.protocol),
    protocol: config.protocol,
    key: config.key.trim(),
    body,
    timeout_seconds: config.timeoutSeconds,
  }
}

// A stream chunk can contain multiple tokens, partial UTF-8 or multiple events.
// Only provider usage counts are used for token metrics.
function validTokenCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

export class StreamParser {
  private buffer = ''
  private data: string[] = []
  done = false
  inputTokens?: number
  totalTokens?: number
  outputTokens?: number
  constructor(
    private protocol: Protocol,
    private onContent: (content: string) => void,
  ) {}

  push(text: string, final = false) {
    this.buffer += text
    if (this.buffer.length > 1024 * 1024) throw new Error('Stream event exceeds 1 MiB.')
    let match: RegExpExecArray | null
    while ((match = /\r\n|\n|\r/.exec(this.buffer))) {
      // A CRLF pair may be split between reads.
      if (!final && match[0] === '\r' && match.index === this.buffer.length - 1) break
      const line = this.buffer.slice(0, match.index)
      this.buffer = this.buffer.slice(match.index + match[0].length)
      this.line(line)
    }
    if (final) {
      if (this.buffer) this.line(this.buffer)
      this.buffer = ''
      this.dispatch()
    }
  }
  private line(line: string) {
    if (this.protocol === 'ollama') {
      if (line.trim()) this.event(line)
    } else if (!line) this.dispatch()
    else if (line.startsWith('data:')) this.data.push(line.slice(5).replace(/^ /, ''))
  }
  private dispatch() {
    if (!this.data.length) return
    const data = this.data.join('\n')
    this.data = []
    this.event(data)
  }
  private event(data: string) {
    if (this.done) return
    if (data.trim() === '[DONE]' && this.protocol === 'openai') {
      this.done = true
      return
    }
    const event = JSON.parse(data)
    // Do not echo provider errors: they can contain credentials or request contents.
    if (event.error || event.type === 'error') throw new Error('Provider returned a stream error.')
    let input: unknown
    let total: unknown
    let count: unknown
    let content: unknown
    if (this.protocol === 'openai') {
      input = event.usage?.prompt_tokens
      total = event.usage?.total_tokens
      count = event.usage?.completion_tokens
      const delta = event.choices?.[0]?.delta
      content = delta?.content || delta?.reasoning_content || delta?.refusal
    } else if (this.protocol === 'anthropic') {
      if (event.type === 'message_start') {
        const usage = event.message?.usage
        if (validTokenCount(usage?.input_tokens)) {
          input =
            usage.input_tokens +
            (validTokenCount(usage.cache_creation_input_tokens) ? usage.cache_creation_input_tokens : 0) +
            (validTokenCount(usage.cache_read_input_tokens) ? usage.cache_read_input_tokens : 0)
        }
        count = usage?.output_tokens
      }
      if (event.type === 'message_delta') count = event.usage?.output_tokens
      if (event.type === 'content_block_delta') content = event.delta?.text || event.delta?.thinking
      if (event.type === 'message_stop') this.done = true
    } else {
      content = event.message?.content || event.message?.thinking
      if (event.done === true) {
        input = event.prompt_eval_count
        count = event.eval_count
        this.done = true
      }
    }
    if (typeof content === 'string' && content.length) this.onContent(content)
    if (validTokenCount(input)) this.inputTokens = input
    if (validTokenCount(count)) this.outputTokens = count
    if (validTokenCount(total)) this.totalTokens = total
    else if (
      (validTokenCount(input) || validTokenCount(count)) &&
      this.inputTokens !== undefined &&
      this.outputTokens !== undefined
    )
      this.totalTokens = this.inputTokens + this.outputTokens
  }
}

export async function runRequest(
  config: BenchmarkConfig,
  id: number,
  signal: AbortSignal,
  onProgress?: (result: RequestResult) => void,
): Promise<RequestResult> {
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, config.timeoutSeconds * 1000)
  const result: RequestResult = { id, status: 'running', outputCharacters: 0, outputPreview: '' }
  const start = performance.now()
  // Publish immutable snapshots at most five times per second, including while waiting for headers.
  const progressTimer = onProgress
    ? setInterval(() => {
        onProgress({ ...result, duration: performance.now() - start })
      }, 200)
    : undefined
  let lastContent: number | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Homebox-LLM': '1' },
      body: JSON.stringify(buildRequest(config)),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const contentType = response.headers.get('content-type') || ''
    if (config.protocol !== 'ollama' && !contentType.includes('text/event-stream')) {
      throw new Error('Expected a streaming SSE response.')
    }
    if (!response.body) throw new Error('Streaming responses are not supported by this browser.')
    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let arrival = 0
    const parser = new StreamParser(config.protocol, (content) => {
      const now = arrival
      result.ttft ??= now
      lastContent = now
      result.outputCharacters! += Array.from(content).length
      result.outputPreview = Array.from(result.outputPreview + content)
        .slice(-2000)
        .join('')
    })
    while (!parser.done) {
      const { value, done } = await reader.read()
      arrival = performance.now() - start
      if (done) {
        parser.push(decoder.decode(), true)
        result.inputTokens = parser.inputTokens
        result.totalTokens = parser.totalTokens
        result.outputTokens = parser.outputTokens
        break
      }
      if (value.length) result.ttfb ??= arrival
      parser.push(decoder.decode(value, { stream: true }))
      result.inputTokens = parser.inputTokens
      result.totalTokens = parser.totalTokens
      result.outputTokens = parser.outputTokens
    }
    if (controller.signal.aborted) throw new Error('Aborted')
    if (!parser.done) throw new Error('Stream ended before its completion marker.')
    result.inputTokens = parser.inputTokens
    result.totalTokens = parser.totalTokens
    result.outputTokens = parser.outputTokens
    // Approximate decode throughput; the first content event can contain >1 token.
    if (
      result.outputTokens !== undefined &&
      result.outputTokens > 1 &&
      result.ttft !== undefined &&
      lastContent !== undefined &&
      lastContent > result.ttft
    ) {
      result.tps = ((result.outputTokens - 1) * 1000) / (lastContent - result.ttft)
    }
    result.status = 'success'
  } catch (error) {
    result.status = signal.aborted ? 'cancelled' : 'error'
    result.error = signal.aborted
      ? undefined
      : timedOut
      ? 'Request timed out.'
      : error instanceof TypeError
      ? 'Connection failed. Check the address and server connectivity.'
      : error instanceof SyntaxError
      ? 'Invalid JSON in response stream.'
      : error instanceof Error
      ? error.message
      : 'Request failed.'
  } finally {
    result.duration = performance.now() - start
    if (result.status === 'success' && result.outputTokens !== undefined && result.duration > 0) {
      result.endToEndTps = (result.outputTokens * 1000) / result.duration
    }
    clearTimeout(timer)
    clearInterval(progressTimer)
    signal.removeEventListener('abort', abort)
    if (reader) {
      await reader.cancel().catch(() => {})
      reader.releaseLock()
    } else controller.abort()
  }
  return result
}

export const BENCHMARK_LIMITS = { minDurationMs: 30000, maxDurationMs: 60000, minRounds: 3 }

export async function runBenchmark(
  config: BenchmarkConfig,
  signal: AbortSignal,
  onResult: (result: RequestResult) => void,
  request = runRequest,
  limits = BENCHMARK_LIMITS,
) {
  validateConfig(config)
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  const start = performance.now()
  const deadline = setTimeout(abort, limits.maxDurationMs)
  let next = 0
  let rounds = 0
  try {
    while (!controller.signal.aborted && performance.now() - start < limits.maxDurationMs) {
      if (rounds >= limits.minRounds && performance.now() - start >= limits.minDurationMs) break
      const roundStart = performance.now()
      await Promise.all(
        Array.from({ length: config.concurrency }, async () => {
          if (controller.signal.aborted) return
          const id = next++
          onResult({ id, status: 'running' })
          onResult(await request(config, id, controller.signal, onResult))
        }),
      )
      if (controller.signal.aborted) break
      rounds++
      if (rounds >= limits.minRounds && performance.now() - start >= limits.minDurationMs) break
      // Yield between immediate failures to avoid a tight retry loop.
      const delay = Math.min(100 - (performance.now() - roundStart), limits.maxDurationMs - (performance.now() - start))
      if (delay > 0)
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer)
            controller.signal.removeEventListener('abort', finish)
            resolve()
          }
          const timer = setTimeout(finish, delay)
          controller.signal.addEventListener('abort', finish, { once: true })
          if (controller.signal.aborted) finish()
        })
    }
    return performance.now() - start
  } finally {
    clearTimeout(deadline)
    signal.removeEventListener('abort', abort)
    controller.abort()
  }
}

export function summarize(results: RequestResult[]) {
  const successes = results.filter((r) => r.status === 'success')
  const mean = (key: 'ttft' | 'tps' | 'endToEndTps') => {
    const values = successes
      .map((r) => r[key])
      .filter((value): value is number => value !== undefined && Number.isFinite(value))
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined
  }
  const reported = results.filter(
    (r) => r.outputTokens !== undefined && Number.isFinite(r.outputTokens) && r.outputTokens >= 0,
  )
  const outputTokens = reported.length ? reported.reduce((sum, r) => sum + r.outputTokens!, 0) : undefined
  const outputTokensIncomplete = results.some(
    (r) => r.status !== 'queued' && !(r.status === 'cancelled' && r.duration === undefined) && !reported.includes(r),
  )
  const consumed = results.filter(
    (r) => validTokenCount(r.totalTokens) || validTokenCount(r.inputTokens) || validTokenCount(r.outputTokens),
  )
  const totalTokens = consumed.length
    ? consumed.reduce(
        (sum, r) =>
          sum + (validTokenCount(r.totalTokens) ? r.totalTokens : (r.inputTokens ?? 0) + (r.outputTokens ?? 0)),
        0,
      )
    : undefined
  const totalTokensIncomplete = results.some(
    (r) =>
      r.status !== 'queued' &&
      !(r.status === 'cancelled' && r.duration === undefined) &&
      ((!validTokenCount(r.totalTokens) && !(validTokenCount(r.inputTokens) && validTokenCount(r.outputTokens))) ||
        r.status === 'running'),
  )
  return {
    successes: successes.length,
    errors: results.filter((r) => r.status === 'error').length,
    cancelled: results.filter((r) => r.status === 'cancelled').length,
    outputTokens,
    outputTokensIncomplete,
    totalTokens,
    totalTokensIncomplete,
    ttft: mean('ttft'),
    tps: mean('tps'),
    endToEndTps: mean('endToEndTps'),
  }
}
