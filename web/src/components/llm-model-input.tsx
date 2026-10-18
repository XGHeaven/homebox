import { useEffect, useId, useRef, useState } from 'react'
import { Button, InputGroup } from '@blueprintjs/core'
import styled from '@emotion/styled'
import { BenchmarkConfig } from '../llm/benchmark'
import { fetchModels } from '../llm/models'
import { ThemeVar, Var } from '../styles/variable'
import { llmMessages } from '../llm/messages'

const Row = styled.div`
  display: flex;
  gap: 8px;
  .bp5-input-group {
    flex: 1;
    min-width: 0;
  }
  .bp5-button {
    flex-shrink: 0;
  }
  @media (max-width: 540px) {
    .bp5-button,
    input {
      min-height: 44px;
    }
  }
`

const Combo = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  .options {
    position: absolute;
    z-index: 20;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    padding: 4px;
    border: 1px solid rgba(120, 135, 140, 0.3);
    border-radius: 6px;
    background: ${Var(ThemeVar.BackendColor)};
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
  }
  .option {
    padding: 8px 10px;
    min-height: 36px;
    cursor: pointer;
    border-radius: 4px;
    overflow-wrap: anywhere;
  }
  .option[data-active='true'] {
    background: rgba(35, 133, 119, 0.15);
  }
  .option[aria-selected='true'] {
    font-weight: 600;
  }
  @media (max-width: 540px) {
    .option {
      min-height: 44px;
    }
  }
`

export function LlmModelInput({
  config,
  disabled,
  onChange,
  t,
}: {
  config: BenchmarkConfig
  disabled: boolean
  onChange: (value: string) => void
  t: (typeof llmMessages)[keyof typeof llmMessages]
}) {
  const [models, setModels] = useState<string[]>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const listId = useId()
  const input = useRef<HTMLInputElement>(null)
  const filtered = (models ?? []).filter((model) => model.toLowerCase().includes(query.toLowerCase()))
  function showOptions() {
    setQuery('')
    setActive(-1)
    setOpen(true)
  }
  function choose(model: string) {
    onChange(model)
    setOpen(false)
    input.current?.focus()
  }
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open, listId])
  const controller = useRef<AbortController>()
  useEffect(() => {
    controller.current?.abort()
    controller.current = undefined
    setLoading(false)
    setModels(undefined)
    setOpen(false)
    setError('')
    return () => controller.current?.abort()
  }, [config.endpoint, config.protocol, config.key])
  useEffect(() => {
    if (disabled) {
      setOpen(false)
      controller.current?.abort()
      controller.current = undefined
      setLoading(false)
    }
  }, [disabled])
  async function load() {
    controller.current?.abort()
    const request = new AbortController()
    controller.current = request
    setLoading(true)
    setError('')
    setModels(undefined)
    const timeout = setTimeout(() => request.abort(), 30000)
    try {
      const result = await fetchModels(config, request.signal)
      if (controller.current === request) {
        setModels(result)
        if (result.length) {
          showOptions()
          input.current?.focus()
        }
      }
    } catch (err) {
      if (controller.current === request) {
        setError(
          request.signal.aborted
            ? t.modelsTimeout
            : `${t.modelsFailed} (${err instanceof Error ? err.message : 'Error'})`,
        )
      }
    } finally {
      clearTimeout(timeout)
      if (controller.current === request) {
        controller.current = undefined
        setLoading(false)
      }
    }
  }
  return (
    <>
      <Row>
        <Combo
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false)
          }}
        >
          <InputGroup
            id='llm-model'
            inputRef={input}
            value={config.model}
            placeholder='model-id'
            disabled={disabled}
            autoComplete='off'
            spellCheck={false}
            role='combobox'
            aria-autocomplete='list'
            aria-expanded={open && filtered.length > 0}
            aria-controls={open && filtered.length > 0 ? listId : undefined}
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            onClick={() => {
              if (!open && models?.length) showOptions()
            }}
            onChange={(e) => {
              onChange(e.target.value)
              setQuery(e.target.value)
              setActive(-1)
              setOpen(true)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setOpen(false)
              }
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault()
                if (!open) {
                  showOptions()
                  return
                }
                setActive((previous) =>
                  filtered.length
                    ? previous < 0
                      ? e.key === 'ArrowDown'
                        ? 0
                        : filtered.length - 1
                      : (previous + (e.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length
                    : -1,
                )
              }
              if (e.key === 'Enter' && open) {
                e.preventDefault()
                if (active >= 0 && filtered[active]) choose(filtered[active])
                else setOpen(false)
              }
            }}
            rightElement={
              models?.length ? (
                <Button
                  type='button'
                  minimal
                  icon='chevron-down'
                  disabled={disabled}
                  aria-label={t.selectModel}
                  onClick={() => {
                    if (open) setOpen(false)
                    else showOptions()
                    input.current?.focus()
                  }}
                />
              ) : undefined
            }
          />
          {open && !disabled && filtered.length > 0 && (
            <div className='options' id={listId} role='listbox' aria-label={t.selectModel}>
              {filtered.map((model, index) => (
                <div
                  className='option'
                  key={model}
                  id={`${listId}-${index}`}
                  role='option'
                  aria-selected={config.model === model}
                  data-active={active === index}
                  onMouseEnter={() => setActive(index)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(model)}
                >
                  {model}
                </div>
              ))}
            </div>
          )}
        </Combo>
        <Button type='button' loading={loading} disabled={disabled || !config.endpoint.trim()} onClick={load}>
          {models?.length ? t.refreshModels : t.fetchModels}
        </Button>
      </Row>
      <div className='bp5-form-helper-text' role='status'>
        {error || (models?.length === 0 ? t.modelsEmpty : '')}
      </div>
    </>
  )
}
