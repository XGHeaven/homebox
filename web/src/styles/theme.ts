import { ThemeVar } from './variable'

export const DarkTheme: Record<ThemeVar, string> = {
  [ThemeVar.BackendColor]: '#10161A',
  [ThemeVar.FrontendColor]: '#f0f0f0',
  [ThemeVar.ConfigPanelBgColor]: '#102020',
  [ThemeVar.FooterColor]: '#999999',
}

export const LightTheme: Record<ThemeVar, string> = {
  [ThemeVar.BackendColor]: '#f0f0f0',
  [ThemeVar.FrontendColor]: '#0e0e0e',
  [ThemeVar.ConfigPanelBgColor]: '#e0f0f0',
  [ThemeVar.FooterColor]: '#999999',
}
