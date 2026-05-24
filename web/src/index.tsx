import 'regenerator-runtime/runtime'
import 'core-js/stable'

import React from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './app'

createRoot(document.getElementById('app')!).render(<App />)
