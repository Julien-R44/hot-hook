import { hot } from 'hot-hook'
import { join } from 'node:path'

await hot.init({
  projectRoot: join(import.meta.dirname, '..'),
  reload: ['src/index.ts'],
})

await import('../src/index.js')
