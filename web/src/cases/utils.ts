import { Observable, interval, Subscription } from 'rxjs'

export interface ProgressStat {
  size: number
  duration: number
}

export type CaseCreator = (count?: number) => Generator<ProgressStat, ProgressStat, boolean>

export interface StatObservableOptions {
  duration?: number
  interval?: number
  parallel?: number
  packCount?: number
  setupDelay?: number
}

export function createStat(caseCreator: CaseCreator) {
  return ({
    duration: maxDuration = 5000,
    interval: checkInterval = 200,
    parallel = 3,
    // 64M
    packCount = 64,
    setupDelay = 50,
  }: StatObservableOptions): Observable<number> =>
    new Observable<number>((sub) => {
      const maxCount = Math.floor(maxDuration / checkInterval)
      let finished = false
      let timerSub: Subscription | undefined
      let count = 0
      if (parallel <= 1) {
        parallel = 1
      }

      const timer = interval(checkInterval)

      const threads: ReturnType<CaseCreator>[] = new Array(parallel).fill(null).map(() => {
        return caseCreator(packCount)
      })

      function next() {
        if (finished) {
          return
        }
        if (count++ >= maxCount) {
          return complete()
        }
        let rate = 0
        for (let i = 0; i < parallel; i++) {
          const thread = threads[i]

          if (!thread) {
            return
          }

          const { value, done } = thread.next(true)
          if (done) {
            threads[i] = null as any
            if (finished) {
              continue
            }
            const { duration } = value
            const delay = duration < setupDelay ? setupDelay - duration : (duration - setupDelay) * Math.random()
            setTimeout(() => {
              threads[i] = caseCreator(packCount)
              threads[i].next(true)
            }, delay)
          }
          const { size, duration } = value
          if (duration !== 0) {
            rate += (size / duration) * 1000
          }
        }

        sub.next(rate)
      }

      function complete() {
        stop()

        sub.complete()
      }

      function setup(i: number) {
        if (i >= parallel) {
          timerSub = timer.subscribe({ next })
          return
        }

        if (setupDelay === 0) {
          threads[i].next(true)
          setup(i + 1)
        } else {
          setTimeout(() => {
            threads[i].next(true)
            setup(i + 1)
          }, setupDelay)
        }
      }

      function stop() {
        finished = true
        if (timerSub) {
          timerSub.unsubscribe()
          timerSub = undefined
        }
        for (const thread of threads) {
          thread.next(false)
        }
      }

      setup(0)

      sub.add(stop)
    })
}
