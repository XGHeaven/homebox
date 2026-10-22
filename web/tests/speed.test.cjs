const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const path = require('node:path')
const moduleCode = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/llm/speed.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
const output = { exports: {} }
new Function('exports', moduleCode)(output.exports)
const { sampleSpeed } = output.exports

test('speed uses elapsed wall time and character deltas, including idle and final partial intervals', () => {
  const initial = { time: 0, characters: 0, rate: 0 }
  const first = sampleSpeed(initial, 1250, 100)
  assert.equal(first.rate, 80)
  const idle = sampleSpeed(first, 2250, 100)
  assert.equal(idle.rate, 0)
  assert.equal(sampleSpeed(idle, 2500, 150).rate, 200)
  assert.equal(sampleSpeed(idle, 2250, 150).rate, 0)
  assert.equal(sampleSpeed(idle, 3250, 0).rate, 0)
})

test('TPS points use the completed request rate, not cumulative throughput', () => {
  const { sampleRequestTps } = output.exports
  assert.deepEqual(sampleRequestTps({id:0,status:'success',tps:50}, 2000), {time:2000,rate:50})
  assert.equal(sampleRequestTps({id:1,status:'success',tps:80}, 6000).rate,80)
  for (const status of ['running','error','cancelled']) assert.equal(sampleRequestTps({id:2,status,tps:999},7000).rate,undefined)
  assert.equal(sampleRequestTps({id:3,status:'success'},8000).rate,undefined)
})
