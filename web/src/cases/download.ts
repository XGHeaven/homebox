import { interval, Observable } from 'rxjs'
import { take } from 'rxjs/operators'

export interface DownloadProgressStat {
  // 当前分片下载的大小
  size: number
  // 当前持续的时间
  duration: number
  // 已经下载的数量
  loaded: number
  // 总共的数量，-1 表示长度无法提前得知
  total: number
}

export function *downloadThread(count: number = 10240, size: number = 2048): Generator<DownloadProgressStat, DownloadProgressStat, boolean> {
  const xhr = new XMLHttpRequest()
  let start = 0
  let progressTime = performance.now()
  let progresses: Array<{
    size: number,
    duration: number
  }> = []
  let loaded = 0
  let total = -1
  let finished = false

  const getStat = (): DownloadProgressStat => {
    let totalTime = 0
    let totalSize = 0
    let i = progresses.length - 1
    for (i = 0; i < progresses.length; i++) {
      totalTime += progresses[i].duration
      totalSize += progresses[i].size
    }
    progresses = []

    return {
      size: totalSize,
      duration: totalTime,
      total,
      loaded,
    }
  }

  xhr.responseType = 'arraybuffer'

  xhr.onloadstart = () => {
    start = performance.now()
  }

  xhr.onprogress = (ev) => {
    progresses.push({
      size: ev.loaded - loaded,
      duration: performance.now() - progressTime
    })
    loaded = ev.loaded
    total = ev.lengthComputable ? ev.total : -1
    progressTime = performance.now()
  }
  xhr.onload = () => {
    finished = true
    console.log(performance.now() - start, progressTime - start)
  }
  xhr.onerror = () => {
    finished = true
  }

  xhr.open('GET', `http://localhost:3300/download?count=${count}&size=${size}`)
  xhr.send()

  let ret = true
  do {
    if (finished) {
      return getStat()
    }
    ret = yield getStat()
  } while(ret)

  // TODO: 要处理强制停止的情况
  xhr.abort()

  // 这里无关紧要
  return {} as any
}

export function download({
  duration: maxDuration = 5000,
  interval: checkInterval = 100,
  parallel = 3,
  // 20M
  packCount = 20480,
  packSize = 1024,
}: {
  duration?: number,
  interval?: number,
  parallel?: number,
  packCount?: number,
  packSize?: number
} = {
}) {
  return new Observable<number>(sub => {
    const timer = interval(checkInterval).pipe(take(Math.floor(maxDuration / checkInterval)))
    const now = performance.now()
    const threads: ReturnType<typeof downloadThread>[] = new Array(parallel).fill(null).map(() => {
      const thread = downloadThread(packCount, packSize)
      thread.next(true)
      return thread;
    })

    let usedTime = 0

    function next() {
      usedTime = performance.now() - now

      let totalSize = 0
      let totalTime = 0
      for (let i = 0; i < parallel; i++) {
        const thread = threads[i]
        const { value, done } = thread.next(true)
        if (!value) { continue }
        if (done) {
          if (usedTime < maxDuration) {
            threads[i] = downloadThread(packCount, packSize)
            threads[i].next(true)
          } else {
            threads[i] = undefined as any
          }
        }
        const {size, duration} = value
        totalSize += size
        totalTime += duration
      }

      sub.next(totalSize / (totalTime + 0.01) * 1000)
    }

    function complete() {
      for (const thread of threads) {
        if (thread) {
          thread.next(false)
        }
      }
    }

    timer.subscribe({
      next,
      complete
    })
  })
}
