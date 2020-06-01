import { createContext } from 'react'
import { HostChannel } from './channel'
import type { ChannelModule } from './worker'
import { Config } from './types'
import { DEFAULT_CONFIG } from './const'

export const ChannelsContext = createContext<() => Promise<HostChannel<ChannelModule>[]>>(null as any)

export const ConfigContext = createContext<Config>(DEFAULT_CONFIG)
