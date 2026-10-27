import { useContext, useEffect, useId, useRef, useState } from 'react'
import { Button, Dialog, Tooltip } from '@blueprintjs/core'
import { ConfigContext } from '../context'
import { useMediaQuery } from '../hooks'
import { Theme } from '../types'

export function MetricHelp({ label, description }: { label: string; description: string }) {
  const { theme, locale } = useContext(ConfigContext)
  const mobile = useMediaQuery('(max-width: 719px)')
  const [open, setOpen] = useState(false)
  const id = useId()
  const interaction = useRef({ button: false, content: false, focused: false })
  const closeTimer = useRef<ReturnType<typeof setTimeout>>()
  const enter = (part: keyof typeof interaction.current) => {
    if (mobile) return
    clearTimeout(closeTimer.current)
    interaction.current[part] = true
    setOpen(true)
  }
  const leave = (part: keyof typeof interaction.current) => {
    interaction.current[part] = false
    clearTimeout(closeTimer.current)
    // Allow the pointer to cross the gap between the button and the tooltip.
    closeTimer.current = setTimeout(() => {
      if (!Object.values(interaction.current).some(Boolean)) setOpen(false)
    }, 150)
  }
  useEffect(() => {
    setOpen(false)
    interaction.current = { button: false, content: false, focused: false }
    return () => clearTimeout(closeTimer.current)
  }, [mobile])
  useEffect(() => {
    if (mobile || !open) return
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        interaction.current.content = false
        setOpen(false)
      }
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [mobile, open])
  const button = (
    <Button
      type='button'
      minimal
      small
      icon={
        <svg
          width='16'
          height='16'
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='1.75'
          strokeLinecap='round'
          strokeLinejoin='round'
          aria-hidden='true'
        >
          <circle cx='12' cy='12' r='9' />
          <path d='M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.5-2.5 2-2.5 3.5M12 16h.01' />
        </svg>
      }
      aria-label={`${label}${locale === 'zh' ? '说明' : ' help'}`}
      aria-haspopup={mobile ? 'dialog' : undefined}
      aria-expanded={open}
      aria-describedby={!mobile && open ? id : undefined}
      onMouseEnter={() => enter('button')}
      onMouseLeave={() => leave('button')}
      onFocus={() => enter('focused')}
      onBlur={() => leave('focused')}
      onClick={() => setOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false)
          event.stopPropagation()
        }
      }}
      style={{ marginLeft: 4, verticalAlign: 'middle' }}
    />
  )
  return (
    <>
      {mobile ? (
        button
      ) : (
        <Tooltip
          isOpen={open}
          content={
            <span
              id={id}
              onMouseEnter={() => enter('content')}
              onMouseLeave={() => leave('content')}
              style={{ display: 'block', maxWidth: 280, lineHeight: 1.6 }}
            >
              {description}
            </span>
          }
          placement='top'
        >
          {button}
        </Tooltip>
      )}
      <Dialog
        className={theme === Theme.Dark ? 'bp5-dark' : undefined}
        isOpen={mobile && open}
        onClose={() => setOpen(false)}
        title={label}
        style={{ width: 'min(calc(100vw - 32px), 420px)', margin: 0 }}
      >
        <div style={{ padding: '16px 18px 20px', lineHeight: 1.7, maxHeight: '60vh', overflowY: 'auto' }}>
          {description}
        </div>
      </Dialog>
    </>
  )
}
