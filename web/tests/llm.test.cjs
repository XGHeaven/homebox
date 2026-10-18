const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homebox-llm-'))
const compiled = path.join(dir, 'benchmark.cjs')
fs.writeFileSync(compiled, ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/llm/benchmark.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText)
const { StreamParser, defaultConfig, resolveEndpoint, buildRequest, validateConfig, runRequest, runBenchmark, summarize } = require(compiled)
fs.rmSync(dir, { recursive: true })
const config = { ...defaultConfig, endpoint: 'http://localhost:11434/v1', model: 'test-model' }
const sse = (obj) => `data: ${JSON.stringify(obj)}\r\n\r\n`
const delta = (content) => sse({ choices: [{ delta: { content } }] })
const usage = (tokens) => sse({ choices: [], usage: { completion_tokens: tokens } })

test('normalizes base and complete endpoint URLs, rejects credentials and non-HTTP schemes', () => {
  assert.equal(resolveEndpoint('http://localhost:11434', 'ollama'), 'http://localhost:11434/api/chat')
  assert.equal(resolveEndpoint('https://example.com/v1/', 'openai'), 'https://example.com/v1/chat/completions')
  assert.equal(resolveEndpoint('https://example.com/proxy/v1/messages', 'anthropic'), 'https://example.com/proxy/v1/messages')
  assert.throws(() => resolveEndpoint('file:///tmp/test', 'openai'))
  assert.throws(() => resolveEndpoint('https://key@example.com', 'openai'))
  assert.throws(() => validateConfig({ ...config, concurrency: NaN }))
})

test('builds protocol-specific streaming requests and optional usage', () => {
  assert.deepEqual(buildRequest(config).body.stream_options, { include_usage: true })
  assert.equal(buildRequest({ ...config, includeUsage: false }).body.stream_options, undefined)
  assert.equal(buildRequest({ ...config, tokenParameter: 'max_completion_tokens' }).body.max_completion_tokens, 512)
  assert.equal(buildRequest({ ...config, protocol: 'anthropic' }).body.max_tokens, 512)
  assert.deepEqual(buildRequest({ ...config, protocol: 'ollama' }).body.options, { num_predict: 512 })
})

test('SSE parses arbitrary byte boundaries, CRLF, comments, metadata and usage-only tail', () => {
  let content = 0
  const parser = new StreamParser('openai', () => content++)
  const source = ': ping\r\n\r\n' + sse({ choices: [{ delta: { role: 'assistant' } }] }) + delta('你好') + delta('world') + usage(42) + 'data: [DONE]\r\n\r\n'
  const decoder = new TextDecoder()
  for (const byte of new TextEncoder().encode(source)) parser.push(decoder.decode(new Uint8Array([byte]), { stream: true }))
  parser.push(decoder.decode(), true)
  assert.equal(content, 2)
  assert.equal(parser.outputTokens, 42)
  assert.equal(parser.done, true)
})

test('multi-line SSE data and final event without trailing newline', () => {
  const parser = new StreamParser('openai', () => {})
  parser.push('data: {"usage":\ndata: {"completion_tokens":9}}\n\ndata: [DONE]', true)
  assert.equal(parser.outputTokens, 9)
  assert.equal(parser.done, true)
})

test('Anthropic usage is cumulative, ping is not content', () => {
  let content = 0
  const parser = new StreamParser('anthropic', () => content++)
  parser.push(sse({ type: 'message_start', message: { usage: { output_tokens: 1 } } }) + sse({ type: 'ping' }))
  parser.push(sse({ type: 'content_block_delta', delta: { thinking: 'thinking' } }))
  parser.push(sse({ type: 'message_delta', usage: { output_tokens: 12 } }))
  parser.push(sse({ type: 'message_stop' }))
  assert.equal(parser.outputTokens, 12)
  assert.equal(content, 1)
  assert.equal(parser.done, true)
})

test('Ollama NDJSON uses final eval_count, not chunks', () => {
  const parser = new StreamParser('ollama', () => {})
  parser.push('{"message":{"content":"hello"},"done":false}\n{"done":true,"eval_count":18}', true)
  assert.equal(parser.outputTokens, 18)
  assert.equal(parser.done, true)
})

test('missing usage stays unknown and provider errors are redacted', () => {
  const parser = new StreamParser('openai', () => {})
  parser.push(delta('hello') + 'data: [DONE]\n\n')
  assert.equal(parser.outputTokens, undefined)
  assert.throws(() => new StreamParser('anthropic', () => {}).push(sse({ type: 'error', error: { message: 'SECRET' } })), { message: 'Provider returned a stream error.' })
})

function mockFetch(chunks, { status = 200, delay = 8, hang = false } = {}) {
  return async (_url, { signal }) => new Response(new ReadableStream({
    async start(controller) {
      signal.addEventListener('abort', () => { try { controller.error(new DOMException('Aborted', 'AbortError')) } catch {} })
      for (const chunk of chunks) {
        await new Promise((resolve) => setTimeout(resolve, delay))
        if (signal.aborted) return
        controller.enqueue(new TextEncoder().encode(chunk))
      }
      if (!hang) controller.close()
    },
  }), { status, headers: { 'content-type': 'text/event-stream' } })
}

test('request separates byte/content arrival and measures usage-based TPS', async (t) => {
  t.mock.method(global, 'fetch', mockFetch([': ping\n\n', delta('a'), delta('b'), usage(11) + 'data: [DONE]\n\n']))
  const result = await runRequest(config, 0, new AbortController().signal)
  assert.equal(result.status, 'success')
  assert.ok(result.ttft > result.ttfb)
  assert.ok(result.tps > 0)
  assert.equal(result.endToEndTps, result.outputTokens * 1000 / result.duration)
  assert.ok(result.endToEndTps < result.tps)
  assert.equal(result.outputTokens, 11)
})

test('truncated streams and HTTP failures are failures, single event has no decode TPS', async (t) => {
  const mocked = t.mock.method(global, 'fetch', mockFetch([delta('a')]))
  assert.equal((await runRequest(config, 0, new AbortController().signal)).status, 'error')
  mocked.mock.mockImplementation(mockFetch([], { status: 401 }))
  assert.equal((await runRequest(config, 0, new AbortController().signal)).error, 'HTTP 401')
  mocked.mock.mockImplementation(mockFetch([delta('a') + delta('b') + usage(5) + 'data: [DONE]\n\n']))
  assert.equal((await runRequest(config, 0, new AbortController().signal)).tps, undefined)
})

test('timeout and manual cancellation are distinct', async (t) => {
  t.mock.method(global, 'fetch', mockFetch([], { hang: true }))
  const timeout = await runRequest({ ...config, timeoutSeconds: 0.01 }, 0, new AbortController().signal)
  assert.equal(timeout.error, 'Request timed out.')
  const controller = new AbortController()
  const pending = runRequest(config, 1, controller.signal)
  controller.abort()
  assert.equal((await pending).status, 'cancelled')
})

test('dynamic benchmark completes at least three rounds with bounded concurrency', async () => {
  let active = 0; let peak = 0
  const ids = []; const results = []
  await runBenchmark({ ...config, requests: 7, concurrency: 3 }, new AbortController().signal, (result) => results.push(result), async (_config, id) => {
    ids.push(id); active++; peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active--
    return { id, status: id === 2 ? 'error' : 'success' }
  }, {minDurationMs:0,maxDurationMs:1000,minRounds:3})
  assert.equal(peak, 3)
  assert.deepEqual(ids.sort(), [0, 1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(results.filter((r) => r.status === 'success').length, 8)
})

test('stop prevents queued requests from starting', async () => {
  const controller = new AbortController()
  let launched = 0
  const results = []
  await runBenchmark({ ...config, requests: 5, concurrency: 1 }, controller.signal, (result) => results.push(result), async (_config, id) => {
    launched++; controller.abort(); return { id, status: 'cancelled' }
  })
  assert.equal(launched, 1)
  assert.equal(results.filter((r) => r.status === 'cancelled').length, 1)
})

test('TTFT and TPS average completed valid requests and ignore in-flight or failed ones', () => {
  const results = [
    {id:0,status:'success',ttft:100,tps:20},
    {id:1,status:'success',ttft:300,tps:40},
    {id:2,status:'success',ttft:800},
    {id:3,status:'running',ttft:999,tps:999},
    {id:4,status:'error',ttft:999,tps:999},
  ]
  const stats = summarize(results)
  assert.equal(stats.ttft, 400)
  assert.equal(stats.tps, 30)
  assert.equal(summarize([]).ttft, undefined)
  assert.equal(summarize([{id:0,status:'success'}]).tps, undefined)
})

test('publishes content, character counts and reported usage before completion', { timeout: 2000 }, async (t) => {
  let stream
  let resolveProgress
  const progress = new Promise((resolve) => { resolveProgress = resolve })
  t.mock.method(global, 'fetch', async () => new Response(new ReadableStream({
    start(controller) { stream = controller },
  }), { headers: { 'content-type': 'text/event-stream' } }))
  const pending = runRequest(config, 0, new AbortController().signal, (snapshot) => {
    if (snapshot.outputCharacters) resolveProgress(snapshot)
  })
  await Promise.resolve()
  stream.enqueue(new TextEncoder().encode(delta('你好🌐')))
  const snapshot = await progress
  assert.equal(snapshot.status, 'running')
  assert.equal(snapshot.outputCharacters, 3)
  assert.equal(snapshot.outputPreview, '你好🌐')
  assert.equal(snapshot.outputTokens, undefined)
  assert.ok(snapshot.duration > 0)
  assert.ok(snapshot.ttft >= snapshot.ttfb)
  stream.enqueue(new TextEncoder().encode(delta('world') + usage(15) + 'data: [DONE]\n\n'))
  stream.close()
  const result = await pending
  assert.equal(result.status, 'success')
  assert.equal(result.outputTokens, 15)
  assert.equal(result.outputCharacters, 8)
  assert.equal(snapshot.outputCharacters, 3, 'progress snapshots must not mutate')
})

test('live token counts come only from provider usage, preview is bounded in Unicode characters', { timeout: 2000 }, async (t) => {
  let stream
  let resolveProgress
  const progress = new Promise((resolve) => { resolveProgress = resolve })
  t.mock.method(global, 'fetch', async () => new Response(new ReadableStream({ start(controller) { stream = controller } }), { headers: { 'content-type': 'text/event-stream' } }))
  const pending = runRequest(config, 0, new AbortController().signal, (snapshot) => {
    if (snapshot.outputTokens !== undefined) resolveProgress(snapshot)
  })
  await Promise.resolve()
  stream.enqueue(new TextEncoder().encode(delta('🌐'.repeat(3000)) + usage(750)))
  const snapshot = await progress
  assert.equal(snapshot.outputCharacters, 3000)
  assert.equal(Array.from(snapshot.outputPreview).length, 2000)
  assert.equal(snapshot.outputTokens, 750)
  stream.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
  stream.close()
  await pending
})

test('batch scheduler forwards per-request live snapshots', async () => {
  const states = []
  await runBenchmark(config, new AbortController().signal, (state) => states.push(state), async (_config, id, _signal, onProgress) => {
    onProgress({ id, status: 'running', outputCharacters: 42 })
    return { id, status: 'success', outputCharacters: 42 }
  }, {minDurationMs:0,maxDurationMs:1000,minRounds:3})
  assert.ok(states.some((state) => state.status === 'running' && state.outputCharacters === 42))
  assert.equal(states.at(-1).status, 'success')
})

test('prompt length constraint follows token limit for every protocol without mutating input', () => {
  for (const protocol of ['openai', 'anthropic', 'ollama']) {
    const input = { ...config, protocol, maxTokens: 128, prompt: 'Explain networks.' }
    const content = buildRequest(input).body.messages[0].content
    assert.ok(content.startsWith('Explain networks.\n\n'))
    assert.ok(content.includes('approximately 128 output tokens'))
    assert.equal(input.prompt, 'Explain networks.')
    assert.equal(content.match(/Response length requirement/g).length, 1)
    assert.equal(buildRequest({ ...input, constrainPrompt: false }).body.messages[0].content, input.prompt)
  }
})

test('a connection-only profile cannot start a benchmark without a model', () => {
  assert.throws(() => validateConfig({ ...config, model: '' }), /Model/)
})

test('output usage sums provider counts once per request, including failed requests, and marks missing usage', () => {
  const results = [{id:0,status:'success',outputTokens:100}, {id:1,status:'running'}, {id:2,status:'queued'}]
  assert.equal(summarize(results).outputTokens, 100)
  assert.equal(summarize(results).outputTokensIncomplete, true)
  results[1] = {id:1,status:'error',outputTokens:20}
  assert.equal(summarize(results).outputTokens, 120)
  assert.equal(summarize(results).outputTokensIncomplete, false)
  assert.equal(summarize([{id:0,status:'success',outputTokens:0}]).outputTokens, 0)
  assert.equal(summarize([{id:0,status:'success'}]).outputTokens, undefined)
})

test('parses total usage without double counting cumulative or cached tokens', () => {
  const openai = new StreamParser('openai', () => {})
  openai.push(sse({usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}))
  openai.push(sse({usage:{prompt_tokens:10,completion_tokens:20,total_tokens:30}}))
  assert.equal(openai.totalTokens,30)
  assert.equal(openai.inputTokens,10)
  const anthropic = new StreamParser('anthropic', () => {})
  anthropic.push(sse({type:'message_start',message:{usage:{input_tokens:10,cache_creation_input_tokens:20,cache_read_input_tokens:30,output_tokens:1}}}))
  anthropic.push(sse({type:'message_delta',usage:{output_tokens:15}}))
  assert.equal(anthropic.inputTokens,60)
  assert.equal(anthropic.totalTokens,75)
  const ollama = new StreamParser('ollama', () => {})
  ollama.push(JSON.stringify({done:true,prompt_eval_count:12,eval_count:8})+'\n')
  assert.equal(ollama.totalTokens,20)
})

test('total usage includes input and output with partial usage marked incomplete', () => {
  const result = summarize([{id:0,status:'success',inputTokens:10,outputTokens:20,totalTokens:30},{id:1,status:'error',outputTokens:5}])
  assert.equal(result.totalTokens,35)
  assert.equal(result.totalTokensIncomplete,true)
  assert.equal(summarize([{id:0,status:'success',inputTokens:0,outputTokens:0}]).totalTokens,0)
  assert.equal(summarize([{id:0,status:'success',totalTokens:40}]).totalTokensIncomplete,false)
  assert.equal(summarize([]).totalTokens,undefined)
})


test('dynamic benchmark continues after three rounds until minimum duration', async () => {
  let calls = 0
  const oldNow = performance.now.bind(performance)
  // Real request latency exercises both duration and round conditions.
  const started = oldNow()
  await runBenchmark(config, new AbortController().signal, () => {}, async (_, id) => {
    calls++
    await new Promise(resolve => setTimeout(resolve, 15))
    return {id,status:'success'}
  }, {minDurationMs:250,maxDurationMs:1000,minRounds:3})
  assert.ok(calls >= 3)
  assert.ok(oldNow()-started >= 250)
})

test('hard deadline aborts active requests even before three rounds finish', async () => {
  let calls = 0
  const results = []
  const start = performance.now()
  await runBenchmark({...config,concurrency:2}, new AbortController().signal, r=>results.push(r), async (_,id,signal) => {
    calls++
    await new Promise(resolve=>signal.addEventListener('abort',resolve,{once:true}))
    return {id,status:'cancelled'}
  }, {minDurationMs:20,maxDurationMs:50,minRounds:3})
  assert.equal(calls,2)
  assert.equal(results.filter(r=>r.status==='cancelled').length,2)
  assert.ok(performance.now()-start < 500)
})

 test('end-to-end TPS averages only completed successful measurements', () => {
  assert.equal(summarize([
    {id:0,status:'success',endToEndTps:10},
    {id:1,status:'success',endToEndTps:30},
    {id:2,status:'running',endToEndTps:999},
    {id:3,status:'error',endToEndTps:999},
    {id:4,status:'success'},
  ]).endToEndTps,20)
 })
