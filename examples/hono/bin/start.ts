import { hot } from 'hot-hook'

await hot.init({ root: import.meta.filename })
await import('../src/index.js')
