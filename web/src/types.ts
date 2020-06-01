export enum ChannelType {
  START,
  ERROR,
  PING_TEST,
  UPLOAD_TEST,
  DOWNLOAD_TEST,
  RUN_DOWNLOAD,
}

export enum RunningMode {
  // 单次测速
  ONCE = 'once',
  // 持续测速
  CONTINUE = 'continue',
}

export enum SpeedMode {
  LOW = 'low',
  HIGH = 'high',
}

export enum CampactMode {
  NO_COMPACT = 'no-compact',
  COMPACT = 'compact',
}

export enum RateUnit {
  BIT = 'bit',
  BYTE = 'byte',
}

export interface Config {
  speedMode: SpeedMode
  threadCount: number
  packCount: number
  unit: RateUnit
  duration: number
  parallel: number
  theme: Theme
}

export enum Theme {
  Light = 'light',
  Dark = 'dark',
}
