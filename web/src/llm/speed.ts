import type { RequestResult } from './benchmark'

export interface SpeedSample {
  time: number
  characters: number
  rate: number
}

export function sampleSpeed(previous: SpeedSample, time: number, characters: number): SpeedSample {
  const duration = time - previous.time
  return {
    time,
    characters,
    rate: duration > 0 ? (Math.max(0, characters - previous.characters) * 1000) / duration : 0,
  }
}

export interface TpsSample {
  time: number
  rate?: number
}

export function sampleRequestTps(result: RequestResult, time: number): TpsSample {
  return { time, rate: result.status === 'success' ? result.tps : undefined }
}
