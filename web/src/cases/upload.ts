import { CaseCreator, ProgressStat, createStat } from "./utils";
import { BASE_URL } from "../const";

let buffer: ArrayBuffer

export const xhrUpload: CaseCreator = function*(count = 64) {
  const xhr = new XMLHttpRequest()
  if (!buffer) {
    buffer = new ArrayBuffer(1024 * 1024) // 1M
  }
  const data = new Blob(new Array(count).fill(buffer))
  let finished = false
  let processes: Array<ProgressStat> = []
  let loaded = 0
  let time = 0
  const total = count * 1024 * 1024

  function getRate() {
    let size = 0
    let duration = 0
    for (const pg of processes) {
      size += pg.size
      duration += pg.duration
    }

    processes = []

    return {size, duration, loaded, total}
  }

  xhr.open('POST', `${BASE_URL}/upload`)

  xhr.upload.onloadstart = () => {
    time = performance.now()
  }
  xhr.upload.onprogress = e => {
    console.log(e.loaded, e.lengthComputable, e.total)
    const size = e.loaded - loaded
    const now = performance.now()
    const duration = now - time
    processes.push({size, duration})
    loaded = e.loaded
    time = now
  }
  xhr.upload.onloadend = () => {
    finished = true
  }

  xhr.send(data)

  while (true) {
    if (finished) {
      return getRate()
    }

    const ret = yield getRate()
    if (!ret) {
      break
    }
  }

  return {} as any
}

export const upload = createStat(xhrUpload)
