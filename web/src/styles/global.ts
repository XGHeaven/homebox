import { css } from '@emotion/core'
import { Var, ThemeVar } from './variable'
import { LightTheme } from './theme'

export const $globalStyle = css`
  html,
  body {
    padding: 0;
    margin: 0;
    background: ${Var(ThemeVar.BackendColor)};
  }

  body {
    ${css(LightTheme)}
  }
`
