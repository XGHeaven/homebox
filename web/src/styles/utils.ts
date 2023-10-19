import { css } from '@emotion/react'
import { UI_UNIT_PX } from './const'

export const $textCenter = css`
  text-align: center;
`
export const $mgt = new Array(16).fill(0).map(
  (_, i) =>
    css`
      margin-top: ${i * UI_UNIT_PX}px;
    `,
)

export const $valm = css`
  vertical-align: middle;
`

export const $talc = css`
  text-align: center;
`
