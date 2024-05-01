import { join } from 'desm'
import { assert } from '@japa/assert'
import { snapshot } from '@japa/snapshot'
import { fileSystem } from '@japa/file-system'
import { configure, processCLIArgs, run } from '@japa/runner'

processCLIArgs(process.argv.splice(2))
configure({
  files: ['tests/**/*.spec.ts'],
  plugins: [
    assert(),
    fileSystem({ basePath: join(import.meta.url, '../tmp'), autoClean: true }),
    snapshot(),
  ],
})

run()
