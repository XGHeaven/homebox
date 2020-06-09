import React from 'react'
import { $talc } from '../styles/utils'
import styled from '@emotion/styled'
import { Var, ThemeVar } from '../styles/variable'

const FooterContainer = styled.div`
  ${$talc}
  color: ${Var(ThemeVar.FooterColor)};
  padding-top: 24px;
`

export function Footer() {
  return (
    <FooterContainer>
      测试结果通常只能代表当前设备性能下所能跑到的实际数据， 没有任何理论参考价值，不能作为链路理论数据使用。
    </FooterContainer>
  )
}
