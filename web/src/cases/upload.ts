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
      let loadedBytes = 0
      let loaded = false

      xhr.open('POST', `${BASE_URL}/upload`)

      xhr.upload.onloadstart = () => {
        sub.next(-1)
      }

      xhr.upload.onprogress = (e) => {
        const size = e.loaded - loadedBytes
        loadedBytes = e.loaded
        sub.next(size)
      }

      xhr.upload.onloadend = () => {
        loaded = true
        sub.complete()
      }

      xhr.upload.onerror = (e) => (sub.error(e), console.log(e))
      xhr.onerror = (e) => (sub.error(e), console.log(e))

      sub.add({
        unsubscribe() {
          if (!loaded) {
            xhr.abort()
          }
        },
      })

      xhr.send(data)
    }),
)

export const upload = createFiberGroup(fiberUpload)
