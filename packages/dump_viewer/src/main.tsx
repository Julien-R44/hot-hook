import '@unocss/reset/tailwind-compat.css'
import 'virtual:uno.css'
import './index.css'

import { render } from 'preact'

import { App } from './app.tsx'

render(<App />, document.getElementById('app')!)
