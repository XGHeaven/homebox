import { createFiber, createFiberGroup } from './utils'
import { BASE_URL } from '../const'
import { Observable } from 'rxjs'

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

export function* xhrDownload(count: number = 10): Generator<DownloadProgressStat, DownloadProgressStat, boolean> {
  const xhr = new XMLHttpRequest()
  let start = 0
  let progressTime = performance.now()
  let progresses: Array<{
    size: number
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
    const current = performance.now()
    progresses.push({
      size: ev.loaded - loaded,
      duration: current - progressTime,
    })
    loaded = ev.loaded
    total = ev.lengthComputable ? ev.total : -1
    progressTime = current
  }

  xhr.onload = () => {
    finished = true
    try {
      xhr.abort()
    } catch (e) {}
    console.log(performance.now() - start, progressTime - start)
  }

  xhr.onerror = () => {
    try {
      xhr.abort()
    } catch (e) {}
    finished = true
  }

  xhr.open('GET', `${BASE_URL}/download?count=${count}`)
  xhr.send()

  let ret = true
  do {
    if (finished) {
      return getStat()
    }
    ret = yield getStat()
  } while (ret)

  // TODO: 要处理强制停止的情况
  try {
    xhr.abort()
  } catch (e) {}

  // 这里无关紧要
  return {} as any
}

export const fiberDownload = createFiber((count = 16) => {
  return new Observable((sub) => {
    const abort = new AbortController()
    fetch(`${BASE_URL}/download?count=${count}`, {
      method: 'get',
      signal: abort.signal,
    })
      .then(async (resp) => {
        // IMPROVE
        if (!resp.body) {
          return Promise.reject(new Error('request body is empty'))
        }
        const reader = resp.body.getReader()
        sub.next(-1)
        for (;;) {
          const data = await reader.read()
          const { value, done } = data

          sub.next(value?.length ?? 0)

          if (done) {
            break
          }
        }
      })
      .then(() => {
        sub.complete()
      })
      .catch((e) => {
        sub.error(e)
      })

    sub.add({
      unsubscribe() {
        abort.abort()
      },
    })
  })
})

export const download = createFiberGroup(fiberDownload)
