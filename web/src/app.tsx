import '@blueprintjs/core/lib/css/blueprint.css'

import React, { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { HostChannel } from './channel'
import styled from '@emotion/styled'
import { Global, css } from '@emotion/react'
import { ChannelsContext, ConfigContext, I18nContext } from './context'
import { CaseRunner } from './components/case-runner'
import { CaseConfig } from './components/case-config'
import { DEFAULT_CONFIG, CONFIG_STORAGE_KEY } from './const'
import { RunCaseOnce } from './components/run-case-once'
import { LightTheme, DarkTheme } from './styles/theme'
import { $globalStyle } from './styles/global'
import { Theme, Config, Locale } from './types'
import { Footer } from './components/footer'
import { createTranslator } from './i18n'
import { Button, HTMLSelect } from '@blueprintjs/core'
import { LlmBenchmark } from './components/llm-benchmark'
import { ToolNavigation, readTool, rememberTool } from './components/tool-navigation'

const $Container = styled.div`
  padding: 12px 24px;
  max-width: 864px;
  margin: auto;
  height: 100%;
`
const TopBar = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 4px 0 20px;
  .preferences {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: auto;
  }
  @media (max-width: 540px) {
    gap: 8px;
    .preferences .bp5-button,
    .preferences select {
      min-height: 44px;
    }
  }
`

function createWorker() {
  return new Worker(new URL('./worker.ts', import.meta.url), {
    name: 'speedtest-worker',
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
  const [config, setConfig] = useState<Config>(storageConfig)
  const [tool, setTool] = useState(readTool)
  const [llmRunning, setLlmRunning] = useState(false)
  useEffect(() => {
    const syncRoute = () => {
      const nextTool = readTool()
      rememberTool(nextTool)
      setTool(nextTool)
      // Browser history can navigate away during a run; unmount aborts that run.
      setLlmRunning(false)
    }
    rememberTool(readTool())
    window.addEventListener('hashchange', syncRoute)
    return () => window.removeEventListener('hashchange', syncRoute)
  }, [])
  const { threadCount } = config
  const createChannels = useCallback(async () => {
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

    channelsRef.current = new Array(threadCount).fill(0).map(() => new HostChannel(createWorker()))
    return channelsRef.current
  }, [threadCount])
  const $theme = useMemo(() => css(config.theme === Theme.Dark ? DarkTheme : LightTheme), [config.theme])
  const t = useMemo(() => createTranslator(config.locale), [config.locale])

  function handleConfigChange(newConfig: Config) {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(newConfig))
    setConfig(newConfig)
  }

  return (
    <ChannelsContext.Provider value={createChannels}>
      <ConfigContext.Provider value={config}>
        <I18nContext.Provider value={t}>
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
            <TopBar>
              {(new URLSearchParams(location.search).get('alone') ??
                new URLSearchParams(location.hash.split('?')[1]).get('alone')) !== 'true' && (
                <ToolNavigation tool={tool} locale={config.locale} running={llmRunning} />
              )}
              <div className='preferences'>
                <HTMLSelect
                  aria-label={t('config.language')}
                  title={t('config.language')}
                  value={config.locale}
                  minimal
                  onChange={(e) => handleConfigChange({ ...config, locale: e.target.value as Locale })}
                >
                  <option value={Locale.Zh}>中文</option>
                  <option value={Locale.En}>EN</option>
                </HTMLSelect>
                <Button
                  aria-label={config.locale === Locale.Zh ? '切换亮暗主题' : 'Toggle theme'}
                  title={config.locale === Locale.Zh ? '切换亮暗主题' : 'Toggle theme'}
                  icon={config.theme === Theme.Light ? 'moon' : 'flash'}
                  onClick={() =>
                    handleConfigChange({ ...config, theme: config.theme === Theme.Light ? Theme.Dark : Theme.Light })
                  }
                  minimal
                />
              </div>
            </TopBar>
            {tool === 'llm' ? (
              <LlmBenchmark onRunningChange={setLlmRunning} />
            ) : (
              <>
                <CaseConfig defaultValue={config} onChange={handleConfigChange} />
                {config.duration !== Infinity ? (
                  <RunCaseOnce />
                ) : (
                  <div
                    css={css`
                      display: flex;
                    `}
                  >
                    <CaseRunner title={t('app.download')} name='download' />
                    <CaseRunner title={t('app.upload')} name='upload' />
                  </div>
                )}
              </>
            )}
            {tool === 'network' && <Footer />}
          </$Container>
        </I18nContext.Provider>
      </ConfigContext.Provider>
    </ChannelsContext.Provider>
  )
}
