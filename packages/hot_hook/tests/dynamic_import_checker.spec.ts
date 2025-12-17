import { join } from 'node:path'
import { test } from '@japa/runner'

import { DynamicImportChecker } from '../src/dynamic_import_checker.js'

test.group('Dynamic Import Checker', () => {
  test('Throw if given specifier is not dynamically importedf', async ({ assert, fs }) => {
    await fs.create(
      'app.ts',
      `
      import './foo'
      await import('./bla')

      import '#app/aliases'
      await import('#app/aliases-bla')
      `,
    )

    const checker = new DynamicImportChecker()
    const path = join(fs.basePath, 'app.ts')

    assert.isFalse(await checker.ensureFileIsImportedDynamicallyFromParent(path, './foo'))
    assert.isFalse(await checker.ensureFileIsImportedDynamicallyFromParent(path, '#app/aliases'))

    assert.isTrue(await checker.ensureFileIsImportedDynamicallyFromParent(path, './bla'))
    assert.isTrue(await checker.ensureFileIsImportedDynamicallyFromParent(path, '#app/aliases-bla'))
  })

  test('Consider missing specifier as dynamically imported', async ({ assert, fs }) => {
    await fs.create(
      'app.ts',
      `
        import './foo'
        await import('./bla')
      `,
    )

    const checker = new DynamicImportChecker()
    const path = join(fs.basePath, 'app.ts')

    assert.isTrue(await checker.ensureFileIsImportedDynamicallyFromParent(path, './unknown'))
  })
})
