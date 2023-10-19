import { css } from '@emotion/react'
import { Var, ThemeVar } from './variable'
import { LightTheme } from './theme'

export const $globalStyle = css`
  html,
  body {
    padding: 0;
    margin: 0;
    background: ${Var(ThemeVar.BackendColor)};
    font-variant-numeric: tabular-nums;
  }

  body {
    ${css(LightTheme)}
  }
`
