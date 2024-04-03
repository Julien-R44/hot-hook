import { hot } from 'hot-hook'

await hot.init({
  root: import.meta.filename,
  ignore: ['../../node_modules/**'],
})

await import('../src/index.js')
