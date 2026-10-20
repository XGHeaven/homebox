const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const ts = require('typescript')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'homebox-models-'))
for (const name of ['benchmark', 'models']) fs.writeFileSync(path.join(dir, name + '.js'), ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/llm', name + '.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)
const { resolveModelsEndpoint, fetchModels } = require(path.join(dir, 'models.js'))
fs.rmSync(dir, { recursive: true })
const config = { endpoint: 'https://example.com', protocol: 'openai', key: 'test-key' }
test('models endpoints preserve prefixes and queries for base and full endpoints', () => {
  for (const [protocol, endpoint, expected] of [
    ['openai', '', '/v1/models'], ['openai', '/prefix/v1/chat/completions/', '/prefix/v1/models'],
    ['anthropic', '/prefix/v1/messages', '/prefix/v1/models'], ['anthropic', '/v1', '/v1/models'],
    ['ollama', '', '/api/tags'], ['ollama', '/api/chat', '/api/tags'], ['ollama', '/api', '/api/tags'],
  ]) assert.equal(resolveModelsEndpoint({ ...config, protocol, endpoint: 'https://example.com' + endpoint + '?region=test' }), 'https://example.com' + expected + '?region=test')
  assert.throws(() => resolveModelsEndpoint({ ...config, endpoint: 'file:///tmp/models' }))
})
test('model lookup authenticates via proxy, deduplicates and handles pagination and errors', async (t) => {
  let requests = []
  let pages = []
  t.mock.method(global, 'fetch', async (url, options) => {
    assert.equal(url, '/api/llm/models')
    assert.equal(options.headers['X-Homebox-LLM'], '1')
    assert.ok(options.signal)
    requests.push(JSON.parse(options.body))
    return new Response(JSON.stringify(pages.shift()))
  })
  const signal = new AbortController().signal
  pages = [{ data: [{ id: 'b' }, { id: 'a' }, { id: 'a' }] }]
  assert.deepEqual(await fetchModels(config, signal), ['a', 'b'])
  assert.equal(requests[0].key, 'test-key')
  pages = [{ models: [{ name: 'local:latest' }, { model: 'fallback' }] }]
  assert.deepEqual(await fetchModels({ ...config, protocol: 'ollama' }, signal), ['fallback', 'local:latest'])
  requests = []
  pages = [{ data: [{ id: 'first' }], has_more: true, last_id: 'first' }, { data: [{ id: 'last' }], has_more: false }]
  assert.deepEqual(await fetchModels({ ...config, protocol: 'anthropic' }, signal), ['first', 'last'])
  assert.equal(new URL(requests[1].url).searchParams.get('after_id'), 'first')
  pages = [{ data: [] }]
  assert.deepEqual(await fetchModels(config, signal), [])
  for (const invalid of [{ error: 'bad' }, { data: [{}] }, { data: [], has_more: true }]) {
    pages = [invalid]
    await assert.rejects(fetchModels({ ...config, protocol: 'anthropic' }, signal))
  }
  t.mock.method(global, 'fetch', async () => new Response('', { status: 401 }))
  await assert.rejects(fetchModels(config, signal), /HTTP 401/)
})

test('model lookup trims keys for all protocols without changing saved configuration', async (t) => {
  const requests = []
  t.mock.method(global, 'fetch', async (_, options) => {
    const body = JSON.parse(options.body)
    requests.push(body)
    return new Response(JSON.stringify(body.protocol === 'ollama' ? {models:[]} : {data:[]}))
  })
  for (const protocol of ['openai','anthropic','ollama']) {
    for (const key of [' \n test-key\r\n ', ' \n ']) {
      const connection = {...config,protocol,key}
      await fetchModels(connection,new AbortController().signal)
      assert.equal(requests.at(-1).key,key.trim())
      assert.equal(connection.key,key)
    }
  }
})
