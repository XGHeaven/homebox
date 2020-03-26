import { Observable, interval } from "rxjs"
import { take } from "rxjs/operators"

export interface ProgressStat {
  size: number
  duration: number
}

export type CaseCreator = (count?: number) => Generator<ProgressStat, ProgressStat, boolean>

export interface StatObservableOptions {
  duration?: number,
  interval?: number,
  parallel?: number,
  packCount?: number,
  packSize?: number,
  setupDelay?: number
}

export function createStat(caseCreator: CaseCreator) {
  return ({
    duration: maxDuration = 5000,
  interval: checkInterval = 200,
  parallel = 3,
  // 64M
  packCount = 64,
  packSize = 1024,
  setupDelay = 50
  }: StatObservableOptions): Observable<number> => new Observable<number>(sub => {
    if (parallel <= 1) {
      parallel = 1
    }

    const timer = interval(checkInterval).pipe(take(Math.floor(maxDuration / checkInterval)))

    const threads: ReturnType<CaseCreator>[] = new Array(parallel).fill(null).map(() => {
      return caseCreator(packCount)
    })

    function next() {
      let rate = 0
      for (let i = 0; i < parallel; i++) {
        const thread = threads[i]
        const { value, done } = thread.next(true)
        if (done) {
          threads[i] = caseCreator(packCount)
          threads[i].next(true)
        }
        if (!value) { continue }
        const {size, duration} = value
        rate += size / (duration + 0.001) * 1000
      }

      sub.next(rate)
    }

    function complete() {
      for (const thread of threads) {
        if (thread) {
          thread.next(false)
        }
      }
    }

    function setup(i: number) {
      if (i >= parallel) {
        timer.subscribe({next, complete})
        return;
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

    setup(0)
  })
}
