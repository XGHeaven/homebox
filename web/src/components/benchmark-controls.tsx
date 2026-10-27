import { ReactNode, useContext } from 'react'
import { Button, ButtonGroup, Collapse, Dialog } from '@blueprintjs/core'
import styled from '@emotion/styled'
import { useMediaQuery } from '../hooks'
import { ConfigContext, I18nContext } from '../context'
import { Theme } from '../types'
import { ThemeVar, Var } from '../styles/variable'

export const BenchmarkToolbar = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
`
const Panel = styled.div`
  padding: 24px;
  background: ${Var(ThemeVar.ConfigPanelBgColor)};
  margin-bottom: 24px;
`
export function AdvancedSettingsButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const t = useContext(I18nContext)
  return (
    <ButtonGroup>
      <Button type='button' icon='settings' intent={open ? 'success' : 'none'} aria-expanded={open} onClick={onToggle}>
        {t('config.advanced.title')}
      </Button>
    </ButtonGroup>
  )
}
export function AdvancedSettings({
  open,
  onClose,
  children,
}: {
  open: boolean
  onClose: () => void
  children: (mobile: boolean) => ReactNode
}) {
  const isMobile = useMediaQuery('(max-width: 719px)')
  const { theme } = useContext(ConfigContext)
  const t = useContext(I18nContext)
  return (
    <>
      {!isMobile && (
        <Collapse isOpen={open}>
          <Panel>{children(false)}</Panel>
        </Collapse>
      )}
      <Dialog
        className={theme === Theme.Dark ? 'bp5-dark' : undefined}
        isOpen={isMobile && open}
        onClose={onClose}
        title={t('config.advanced.title')}
        style={{ width: 'min(calc(100vw - 32px), 420px)', margin: 0 }}
      >
        <div style={{ maxHeight: 'calc(100vh - 144px)', overflow: 'auto', padding: '16px 18px 20px' }}>
          {children(true)}
        </div>
      </Dialog>
    </>
  )
}
