import 'regenerator-runtime/runtime'
import 'core-js/stable'

import { render, h } from 'preact'

import { App } from './app'

render(<App/>, document.getElementById('app')!)
