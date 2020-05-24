import { Config, SpeedMode, RateUnit } from "./types"

export const BASE_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3300'

export const DEFAULT_CONFIG: Config = {
  duration: 10 * 1000,
  threadCount: 1,
  speedMode: SpeedMode.LOW,
  packCount: 64,
  parallel: 3,
  unit: RateUnit.BIT
}
