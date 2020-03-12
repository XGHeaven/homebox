export class TestController {
  worker: Worker

  constructor() {
    this.worker = new Worker('worker.ts', {
      name: 'speedtest-worker'
    })
  }
}
