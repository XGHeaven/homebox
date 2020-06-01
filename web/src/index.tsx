import 'regenerator-runtime/runtime'
import 'core-js/stable'

import React from 'react'
import { render } from 'react-dom'

import { App } from './app'

render(<App />, document.getElementById('app')!)
