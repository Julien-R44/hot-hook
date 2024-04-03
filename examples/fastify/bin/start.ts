import { hot } from 'hot-hook'

await hot.init({
  root: import.meta.filename,
  reload: ['src/index.ts'],
})

await import('../src/index.js')
