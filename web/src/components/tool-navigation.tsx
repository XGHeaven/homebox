import { Icon } from '@blueprintjs/core'
import styled from '@emotion/styled'
import { Locale } from '../types'
import { ThemeVar, Var } from '../styles/variable'

export type Tool = 'network' | 'llm'
const TOOL_STORAGE_KEY = 'homebox:last-tool'

export function readTool(): Tool {
  if (location.hash.split('?')[0] === '#/llm') return 'llm'
  if (location.hash.split('?')[0] === '#/network') return 'network'
  try {
    return localStorage.getItem(TOOL_STORAGE_KEY) === 'llm' ? 'llm' : 'network'
  } catch {
    return 'network'
  }
}

export function rememberTool(tool: Tool) {
  if (location.hash.split('?')[0] !== `#/${tool}`) history.replaceState(null, '', `#/${tool}`)
  try {
    localStorage.setItem(TOOL_STORAGE_KEY, tool)
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
}

const Navigation = styled.nav`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  width: 320px;
  max-width: 100%;
  gap: 4px;
  padding: 4px;
  margin: 0;
  border-radius: 9px;
  background: rgba(120, 135, 140, 0.12);

  @media (max-width: 540px) {
    width: auto;
    flex: 1 1 220px;
  }
`

const Link = styled.a`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-width: 0;
  min-height: 36px;
  padding: 0 12px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  text-decoration: none;
  transition:
    background 150ms,
    color 150ms;

  && {
    color: ${Var(ThemeVar.FrontendColor)};
    text-decoration: none;
  }

  &:hover {
    background: rgba(120, 135, 140, 0.1);
  }

  &:focus-visible {
    outline: 2px solid #238577;
    outline-offset: 2px;
  }

  &&[aria-current='page'] {
    background: #fff;
    color: #08705a;
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  .bp5-dark &&[aria-current='page'] {
    background: #2a3a3b;
    color: #8ce5c9;
  }

  &[aria-disabled='true'] {
    opacity: 0.5;
    cursor: not-allowed;
  }

  @media (max-width: 540px) {
    min-height: 44px;
    padding: 0 8px;
    .tool-icon {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
  }
`

export function ToolNavigation({ tool, locale, running }: { tool: Tool; locale: Locale; running: boolean }) {
  const zh = locale === Locale.Zh
  const entries = [
    {
      id: 'network',
      icon: 'globe',
      title: zh ? '网络测速' : 'Network test',
    },
    {
      id: 'llm',
      icon: 'chat',
      title: zh ? 'LLM 测速' : 'LLM benchmark',
    },
  ] as const
  return (
    <Navigation aria-label={zh ? '测速工具' : 'Benchmark tools'}>
      {entries.map((entry) => {
        const disabled = running && entry.id !== tool
        return (
          <Link
            key={entry.id}
            href={`#/${entry.id}`}
            aria-current={tool === entry.id ? 'page' : undefined}
            aria-disabled={disabled || undefined}
            onClick={(event) => {
              if (disabled) event.preventDefault()
            }}
          >
            <span className='tool-icon'>
              <Icon icon={entry.icon} size={16} />
            </span>
            <span>{entry.title}</span>
          </Link>
        )
      })}
    </Navigation>
  )
}
