import { test } from '@japa/runner'
import { DynamicImportChecker } from '../src/dynamic_import_checker.js'
import { join } from 'node:path'

test.group('Dynamic Import Checker', () => {
  test('Throw if given specifier is not dynamically importedf', async ({ assert, fs }) => {
    await fs.create(
      'app.ts',
      `
      import './foo'
      await import('./bla')

      import '#app/aliases'
      await import('#app/aliases-bla')
      `
    )

    const checker = new DynamicImportChecker(fs.basePath)

    const path = join(fs.basePath, 'app.ts')

    await assert.rejects(async () => {
      await checker.ensureFileIsImportedDynamicallyFromParent(path, './foo')
    })

    await assert.rejects(async () => {
      await checker.ensureFileIsImportedDynamicallyFromParent(path, '#app/aliases')
    })

    assert.isTrue(await checker.ensureFileIsImportedDynamicallyFromParent(path, './bla'))
    assert.isTrue(await checker.ensureFileIsImportedDynamicallyFromParent(path, '#app/aliases-bla'))
  })
})
