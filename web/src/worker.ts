import 'regenerator-runtime/runtime'
import 'core-js/stable'

import { ChannelType } from './types'

self.onmessage = (e: any) => {
  if (e.data.type === ChannelType.RUN_DOWNLOAD) {
    startDownload(data => self.postMessage({type: ChannelType.DOWNLOAD_TEST, data}))
  }
}

function *downloadThread(): Generator<[number, number], [number, number], boolean> {
  const xhr = new XMLHttpRequest()
  const startTime = performance.now()
  let start = 0
  let progressTime = performance.now()
  let progresses: Array<{
    size: number,
    duration: number
  }> = []
  let loaded = 0
  let finished = false
  const getResult = (): [number, number] => {
    let totalTime = 0
    let totalSize = 0
    let i = progresses.length - 1
    for (i = 0; i < progresses.length; i++) {
      totalTime += progresses[i].duration
      totalSize += progresses[i].size
    }
    progresses = []

    return [totalSize, totalTime]
  }
  xhr.onloadstart = () => {
    start = performance.now()
  }
  xhr.onprogress = (ev) => {
    progresses.push({
      size: ev.loaded - loaded,
      duration: performance.now() - progressTime
    })
    loaded = ev.loaded
    progressTime = performance.now()
  }
  xhr.onload = () => {
    finished = true
    console.log(performance.now() - startTime)
    console.log(performance.now() - start)
    console.log(progressTime - start)
  }
  xhr.onerror = () => {
    finished = true
  }
  xhr.open('GET', 'http://localhost:3300/download?count=1024000&size=1024')
  xhr.send()

  let ret = true
  do {
    if (finished) {
      return getResult()
    }
    ret = yield getResult()
  } while(ret)

  return [0, 0] as [number, number]
}

function startDownload(onProgress: (progress: [number, number]) => void) {
  const maxDuration = 5000
  const now = performance.now()
  const threads = [downloadThread(), downloadThread(), downloadThread()]

  let usedTime = 0

  function wait() {
    usedTime = performance.now() - now

    let totalSize = 0
    let totalTime = 0
    for (let i = 0; i < threads.length; i++) {
      const thread = threads[i]
      const { value, done } = thread.next(true)
      if (!value) { continue }
      if (done) {
        if (usedTime < maxDuration) {
          threads[i] = downloadThread()
        } else {
          threads[i] = undefined as any
        }
      }
      const [size, time] = value
      totalSize += size
      totalTime += time
    }

    onProgress([totalSize, totalTime])

    if (usedTime < maxDuration) {
      setTimeout(wait, 100)
    } else {
      requestDone()
    }
  }

  function requestDone() {
    for (const thread of threads) {
      if (thread) {
        thread.next(false)
      }
    }
  }

  setTimeout(wait, 100)
}
