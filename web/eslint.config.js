const config = require('@xgheaven/eslint-config-xgheaven')

const configs = config({
  ts: true,
  react: true,
  ignores: ['dist/**', 'build/**', 'node_modules/**'],
})
const plugins = Object.assign({}, ...configs.map((item) => item.plugins).filter(Boolean))

module.exports = configs.concat({
  files: ['src/**/*.{js,jsx,ts,tsx}'],
  plugins: {
    n: plugins.n,
    react: plugins.react,
    '@typescript-eslint': plugins['@typescript-eslint'],
  },
  rules: {
    'no-use-before-define': 'off',
    'n/no-callback-literal': 'off',
    'n/handle-callback-err': 'off',
    'react/jsx-handler-names': 'off',
    'react/no-unknown-property': ['error', { ignore: ['css'] }],
    '@typescript-eslint/no-explicit-any': 'off',
  },
})
