import { Observable, Subscription } from 'rxjs'

type WorkerExportedModule = Record<any, (...args: any[]) => any>

export class HostChannel<Module extends WorkerExportedModule> {
  private id = 1
  private listeners: Record<number, (...args: any[]) => any> = {}

  constructor(public worker: Worker) {
    worker.onmessage = this.onmessage
    worker.onerror = this.onerror
  }

  async call<K extends keyof Module>(name: K, ...args: Parameters<Module[K]>): Promise<ReturnType<Module[K]>> {
    const id = this.id++
    let resolve: any
    let reject: any
    const promise = new Promise<any>((res, rej) => {
      resolve = res
      reject = rej
    })

    this.listeners[id] = ({ error, value }: any) => {
      if (error) {
        reject(value)
      } else {
        resolve(value)
      }

      delete this.listeners[id]
    }

    this.worker.postMessage({
      type: 'call',
      id,
      args,
      name,
    })

    return promise
  }

  observe<K extends keyof Module>(name: K, ...args: Parameters<Module[K]>): ReturnType<Module[K]> {
    const obs = new Observable((sub) => {
      const id = this.id++
      this.listeners[id] = (name: 'next' | 'error' | 'complete', value) => {
        sub[name](value)
        if (name === 'complete') {
          delete this.listeners[id]
        }
      }

      this.worker.postMessage({
        type: 'observe',
        id,
        name,
        args,
      })

      sub.add({
        unsubscribe: () => {
          this.worker.postMessage({
            type: 'unobserve',
            id,
          })
        },
      })
    })

    return obs as any
  }

  terminate() {
    this.worker.terminate()
  }

  private onmessage = ({ data }: MessageEvent) => {
    const { type, id } = data
    const callback = this.listeners[id]
    if (!callback) {
      console.warn('Cannot found callback for id ' + id)
      return
    }
    if (type === 'call') {
      callback({
        error: data.error,
        value: data.value,
      })
    } else if (type === 'observe') {
      callback(data.name, data.value)
    }
  }

  private onerror = () => {
    // TODO
  }
}

export class WorkerChannel<Module extends WorkerExportedModule> {
  private subs: Record<any, Subscription> = {}
  constructor(private mod: Module) {
    self.onmessage = this.onmessage
  }

  private onmessage = ({ data }: MessageEvent) => {
    const { type, id } = data

    if (type === 'call') {
      const { args, name } = data
      Promise.resolve(this.mod[name](...args))
        .then((v) => {
          self.postMessage({
            type: 'call',
            id,
            error: false,
            value: v,
          })
        })
        .catch((e) => {
          self.postMessage({
            type: 'call',
            id,
            error: true,
            value: e,
          })
        })
    } else if (type === 'observe') {
      const { name, args, id } = data
      console.log(name, args, id)
      const obs = this.mod[name](...args) as Observable<any>
      this.subs[id] = obs.subscribe({
        next: (v) => {
          self.postMessage({ type: 'observe', id, name: 'next', value: v })
        },
        error: (e) => {
          self.postMessage({ type: 'observe', id, name: 'error', value: e })
        },
        complete: () => {
          self.postMessage({ type: 'observe', id, name: 'complete' })
        },
      })
    } else if (type === 'unobserve') {
      const { id } = data
      this.subs[id].unsubscribe()
      delete this.subs[id]
    }
  }
}
