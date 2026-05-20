import React, { useContext } from 'react'
import { $talc } from '../styles/utils'
import styled from '@emotion/styled'
import { Var, ThemeVar } from '../styles/variable'
import { I18nContext } from '../context'

const FooterContainer = styled.div`
  ${$talc}
  color: ${Var(ThemeVar.FooterColor)};
  padding-top: 24px;
`

export function Footer() {
  const t = useContext(I18nContext)
  return <FooterContainer>{t('footer.notice')}</FooterContainer>
}
