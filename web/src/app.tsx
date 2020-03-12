import { h } from 'preact'
import { ChannelType } from './types'

export function App() {
  return (
    <div>
      <button onClick={() => {
    const xhr = new XMLHttpRequest()
    const startTime = performance.now()
    let start = 0
    let progressTime = performance.now()
    const progresses: Array<{
      size: number,
      duration: number
    }> = []
    let loaded = 0
    const calc = () => {
      let totalTime = 0
      let totalSize = 0
      let i = progresses.length - 1
      for (; i >= 0; i--) {
        totalTime += progresses[i].duration
        totalSize += progresses[i].size
        if (totalTime >= 2) {
          break
        }
      }
      while (i >= 0) {
        progresses.shift()
        i--
      }
      console.log(totalSize, totalTime)
      console.log(totalSize / totalTime * 1000, 'B/s')
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
      calc()
    }
    xhr.onload = () => {
      console.log(performance.now() - startTime)
      console.log(performance.now() - start)
      console.log(progressTime - start)
    }
    xhr.open('GET', 'http://localhost:3300/download?count=1024000&size=1024')
    xhr.send()
  }}>Start</button>
  <button onClick={() => {
    const worker = new Worker('./worker.js', {
      name: 'speedtest'
    })
    worker.onmessage = e => {
      if (e.data.type === ChannelType.DOWNLOAD_TEST) {
        console.log(e.data.data[0] / (e.data.data[1] + 1) * 1000)
      }
    }
    worker.onerror = console.error
    worker.postMessage({type: ChannelType.RUN_DOWNLOAD})
    console.log(worker)
  }}>Worker</button>
    </div>
  )
}
