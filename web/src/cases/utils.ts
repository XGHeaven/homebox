import { Observable, interval, Subscription } from 'rxjs'

// tcp 大约会损耗 3%
const fixFactor = 1.03

export interface ProgressStat {
  size: number
  duration: number
}

export interface FiberOptions {
  count?: number
  delay?: number
}

export type CaseCreator = (count?: number) => Generator<ProgressStat, any, boolean>
export type FiberCreator = (options?: FiberOptions) => Observable<ProgressStat>

export interface StatObservableOptions {
  duration?: number
  interval?: number
  parallel?: number
  packCount?: number
  setupDelay?: number
  statCount?: number
}

function countUpStats(stats: ProgressStat[]): ProgressStat {
  let duration = 0
  let size = 0
  for (const stat of stats) {
    duration += stat.duration
    size += stat.size
  }

  return { size, duration }
}

function getRateOfStats(stats: ProgressStat[]): number {
  return (
    stats.map(({ duration, size }) => (size / (duration + 0.00001)) * 1000).reduce((acc, rate) => acc + rate, 0) /
    stats.length
  )
}

export function createFiber(request: (count?: number) => Observable<number>): FiberCreator {
  return function ({ delay = 0, count }: FiberOptions = {}) {
    const observer = request(count)

    function randomDelay() {
      return Math.floor(delay * (0.5 + 0.5 * Math.random()))
    }

    return new Observable<ProgressStat>((sub) => {
      let subscription: Subscription
      let finished = false
      let timer: any = null
      let now = performance.now()
      let isFirst = true
      function requestNext() {
        subscription = observer.subscribe({
          next(reciveSize) {
            const newNow = performance.now()
            if (isFirst) {
              isFirst = false
            } else {
              sub.next({
                size: reciveSize,
                duration: newNow - now,
              })
            }
            now = newNow
          },
          error(e) {
            sub.error(e)
            finished = true
            clearTimeout(timer)
          },
          complete() {
            if (!finished) {
              timer = setTimeout(requestNext, randomDelay())
            }
          },
        })
      }

      timer = setTimeout(requestNext, randomDelay())

      sub.add({
        unsubscribe() {
          finished = true
          clearTimeout(timer)
          subscription.unsubscribe()
          sub.complete()
        },
      })
    })
  }
}

export function createFiberGroup(fiberCreator: FiberCreator) {
  return ({
    duration: maxDuration = 5000,
    interval: checkInterval = 200,
    parallel = 3,
    packCount = 64,
    setupDelay = 50,
    statCount = 10,
  }: StatObservableOptions): Observable<number> =>
    new Observable((sub) => {
      const fiber = fiberCreator({ delay: setupDelay, count: packCount })
      const maxCount = Math.floor(maxDuration / checkInterval)
      let count = 0
      if (parallel <= 1) {
        parallel = 1
      }

      const timer = interval(checkInterval)
      const fiberInfos = new Array(parallel).fill(0).map((_, i) => {
        const stats: ProgressStat[] = []
        const rets: ProgressStat[] = []
        const subscription = fiber.subscribe({
          next(stat) {
            stats.push(stat)
          },
          error() {
            // TODO: 收集并展示错误
          },
        })
        return {
          stats,
          subscription,
          calc: () => {
            rets.push(countUpStats(stats))
            stats.splice(0)
            if (rets.length > statCount) {
              rets.shift()
            }

            const rate = getRateOfStats(rets)
            return rate
          },
        }
      })

      const timerSub = timer.subscribe({
        next() {
          sub.next(fiberInfos.map((info) => info.calc()).reduce((acc, rate) => acc + rate, 0) * fixFactor)
          if (count++ >= maxCount) {
            unsubscribe()
          }
        },
      })

      sub.add({
        unsubscribe() {
          unsubscribe()
        },
      })

      function unsubscribe() {
        timerSub.unsubscribe()
        for (const info of fiberInfos) {
          info.subscription.unsubscribe()
        }
        sub.complete()
      }
    })
}
