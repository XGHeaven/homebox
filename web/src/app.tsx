import '@blueprintjs/core/lib/css/blueprint.css'

import React, { useCallback, useMemo, useState, useRef } from 'react'
import { HostChannel } from './channel'
import styled from '@emotion/styled'
import { Global, css } from '@emotion/react'
import { ChannelsContext, ConfigContext } from './context'
import { CaseRunner } from './components/case-runner'
import { CaseConfig } from './components/case-config'
import { DEFAULT_CONFIG, CONFIG_STORAGE_KEY } from './const'
import { RunCaseOnce } from './components/run-case-once'
import { LightTheme, DarkTheme } from './styles/theme'
import { $globalStyle } from './styles/global'
import { Theme, Config } from './types'
import { Footer } from './components/footer'

const $Container = styled.div`
  padding: 12px 24px;
  max-width: 864px;
  margin: auto;
  height: 100%;
`
function createWorker() {
  return new Worker(new URL('./worker.ts', import.meta.url), {
    name: 'speedtest-worker'
  })
}

export function App() {
  const channelsRef = useRef<HostChannel<any>[] | null>(null)
  const storageConfig = useMemo(() => {
    const data = localStorage.getItem(CONFIG_STORAGE_KEY)
    try {
      const parsedConfig = Object.assign({}, DEFAULT_CONFIG, JSON.parse(data || '{}'))
      if (parsedConfig.duration === null) {
        parsedConfig.duration = Infinity
      }
      return parsedConfig
    } catch (e) {
      return DEFAULT_CONFIG
    }
  }, [])
  const [config, setConfig] = useState(storageConfig)
  const createChannels = useCallback(async () => {
    const { threadCount } = config
    if (channelsRef.current) {
      const channels = channelsRef.current!
      if (channels.length > threadCount) {
        for (let i = threadCount; i < channels.length; i++) {
          channels[i].terminate()
        }
        channels.splice(threadCount)
      } else if (channels.length < threadCount) {
        for (let i = channels.length; i < threadCount; i++) {
          channels.push(new HostChannel(createWorker()))
        }
      }
      return channels
    }

    channelsRef.current = new Array(config.threadCount).fill(0).map(() => new HostChannel(createWorker()))
    return channelsRef.current
  }, [config.threadCount])
  const $theme = useMemo(() => css(config.theme === Theme.Dark ? DarkTheme : LightTheme), [config.theme])

  function handleConfigChange(newConfig: Config) {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig))
    setConfig(newConfig)
  }

  return (
    <ChannelsContext.Provider value={createChannels}>
      <ConfigContext.Provider value={config}>
        <Global
          styles={[
            $globalStyle,
            css`
              body {
                ${$theme}
              }
            `,
          ]}
        />
        <$Container className={config.theme === Theme.Dark ? 'bp5-dark' : ''}>
          <CaseConfig defaultValue={config} onChange={handleConfigChange} />
          {config.duration !== Infinity ? (
            <RunCaseOnce />
          ) : (
            <div
              css={css`
                display: flex;
              `}
            >
              <CaseRunner title='Download' name='download' />
              <CaseRunner title='Upload' name='upload' />
            </div>
          )}
          <Footer />
        </$Container>
      </ConfigContext.Provider>
    </ChannelsContext.Provider>
  )
}
