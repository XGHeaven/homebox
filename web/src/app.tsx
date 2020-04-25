import React, { useCallback } from 'react'
import { useState, useRef } from 'react'
import { HostChannel } from './channel'
import type { ChannelModule } from './worker'
import styled from '@emotion/styled'
import { Global, css } from '@emotion/core'

import '@blueprintjs/core/lib/css/blueprint.css'
import { ChannelContext, RateFormatterContext } from './context'
import { CaseRunner } from './components/download-case'
import { Button } from '@blueprintjs/core'
import { RateFormatterType as RateUnit, rateFormatters } from './utils'
import { RunningMode } from './types'

const CContainer = styled.div`
  padding: 12px 24px;
  max-width: 864px;
  margin: auto;
  height: 100%;
`

const CHeader = styled.div`
  display: flex;
  justify-content: space-between;
`

export function App() {
  const [unit, setUnit] = useState<RateUnit>('bit')
  const [mode, setMode] = useState<RunningMode>(RunningMode.ONCE)
  const channelRef = useRef<HostChannel<any> | null>(null)
  const createChannel = useCallback(async () => {
    if (channelRef.current) {
      return channelRef.current
    }

    const worker = new Worker('./worker.ts')
    channelRef.current = new HostChannel<ChannelModule>(worker)
    return channelRef.current
  }, [])

  return (
    <ChannelContext.Provider value={createChannel}>
      <RateFormatterContext.Provider value={rateFormatters[unit]}>
      <Global
        styles={css`
          html, body {
            padding: 0;
            margin: 0;
          }
        `}
      />
      <CContainer>
        <CHeader>
          <div>
            <Button minimal={true} intent={mode === RunningMode.ONCE ? 'success' : 'none'} onClick={() => setMode(RunningMode.ONCE)}>单次测速</Button>
            <Button minimal={true} intent={mode === RunningMode.CONTINUE ? 'success' : 'none'} onClick={() => setMode(RunningMode.CONTINUE)}>持续压测</Button>
          </div>
          <div>
            <Button minimal={true} intent={unit === 'bit' ? 'success' : 'none'} onClick={() => setUnit('bit')}>Bit Unit</Button>
            <Button minimal={true} intent={unit === 'byte' ? 'success' : 'none'} onClick={() => setUnit('byte')}>Byte Unit</Button>
          </div>
        </CHeader>
        <div css={css`
          display: flex;
        `}>
          <CaseRunner title="Download" name="download" mode={mode}/>
          <CaseRunner title="Upload" name="upload" mode={mode}/>
        </div>
      </CContainer>
      </RateFormatterContext.Provider>
    </ChannelContext.Provider>
  )
}
