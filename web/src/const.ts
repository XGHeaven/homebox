import { Config, SpeedMode, RateUnit, Theme } from './types'

export const BASE_URL = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3300'
export const CONFIG_STORAGE_KEY = 'homebox:config'

const systemTheme = (() => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    const ret = window.matchMedia('(prefers-color-scheme: dark)')
    if (ret.matches) {
      return Theme.Dark
    }
    return Theme.Light
  }

  return Theme.Light
})()

export const DEFAULT_CONFIG: Config = {
  duration: 10 * 1000,
  threadCount: 1,
  speedMode: SpeedMode.LOW,
  packCount: 64,
  parallel: 3,
  unit: RateUnit.BIT,
  theme: systemTheme,
}
