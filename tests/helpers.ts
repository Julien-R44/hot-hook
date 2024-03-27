// export function runProcess()
import { register } from 'node:module'

// I can not believe they did this.
register('dynohot', {
  parentURL: import.meta.url,
})
