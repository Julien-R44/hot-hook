import { hot } from 'hot-hook'

await hot.init({ 
  root: import.meta.filename,
  boundaries: ['../src/services/**.ts']
})

await import('../src/index.js')
