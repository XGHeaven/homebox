export enum ThemeVar {
  FrontendColor = '--frontend-color',
  BackendColor = '--backend-color',

  ConfigPanelBgColor = '--config-panel-background-color'
}

export function Var(varName: string, defaultValue?: any) {
  return `var(${varName}${defaultValue ? `, ${defaultValue}` : ''})`
}
