import { createFiber, createFiberGroup } from './utils'
import { BASE_URL } from '../const'
import { Observable } from 'rxjs'

const blob1M = new Blob([new ArrayBuffer(1024 * 1024)])
let blobCache: Blob
let blobCacheCount: number

const fiberUpload = createFiber(
  (count = 64) =>
    new Observable((sub) => {
      const xhr = new XMLHttpRequest()
      if (!blobCache || blobCacheCount !== count) {
        blobCacheCount = count
        blobCache = new Blob(new Array(count).fill(blob1M))
      }
      const data = blobCache
      let loaded = 0

      xhr.open('POST', `${BASE_URL}/upload`)

      xhr.upload.onloadstart = () => {
        sub.next(-1)
      }

      xhr.upload.onprogress = (e) => {
        const size = e.loaded - loaded
        loaded = e.loaded
        sub.next(size)
      }

      xhr.upload.onloadend = () => {
        sub.complete()
      }

      xhr.upload.onerror = (e) => sub.error(e)
      xhr.onerror = (e) => sub.error(e)

      sub.add({
        unsubscribe() {
          xhr.abort()
        },
      })

      xhr.send(data)
    }),
)

export const upload = createFiberGroup(fiberUpload)
