const { test } = require('node:test')
const assert = require('node:assert/strict')
const ts = require('typescript')
const fs = require('node:fs')
const path = require('node:path')
const output = {}
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/llm/connection.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(output)
const { readConnection, writeConnection } = output

test('autosaves connection and key; clearing key removes it from storage', () => {
  let raw
  const storage = {getItem:()=>raw, setItem:(_,value)=>{raw=value}}
  const config = {endpoint:'http://localhost:1234/v1',protocol:'openai',key:'secret',model:'not-saved'}
  assert.equal(readConnection(storage), undefined)
  writeConnection(storage, config)
  assert.equal(raw.includes('model'), false)
  assert.equal(readConnection(storage).endpoint, config.endpoint)
  assert.equal(readConnection(storage).key, 'secret')
  writeConnection(storage, {...config,key:''})
  assert.equal(readConnection(storage).key, '')
  assert.equal(Object.hasOwn(JSON.parse(raw), 'key'), false)
  raw=JSON.stringify({...config,rememberKey:true})
  assert.equal(readConnection(storage).key, 'secret')
  raw=JSON.stringify({...config,rememberKey:false})
  assert.equal(readConnection(storage).key, '')
  raw='{"endpoint":3}'
  assert.throws(()=>readConnection(storage))
  assert.throws(()=>writeConnection({setItem(){throw Error('quota')}},config))
})
