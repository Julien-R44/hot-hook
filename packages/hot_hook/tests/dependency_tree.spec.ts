import { test } from '@japa/runner'
import DependencyTree from '../src/dependency_tree.js'

test.group('Dependency tree', () => {
  test('basic scenario', ({ assert }) => {
    const tree = new DependencyTree({ root: 'app.ts' })

    tree.addDependency('app.ts', { path: 'start/index.ts' })
    tree.addDependency('app.ts', { path: 'providers/database_provider.ts' })
    tree.addDependency('start/index.ts', {
      reloadable: true,
      path: 'controllers/users_controller.ts',
    })
    tree.addDependency('start/index.ts', {
      reloadable: true,
      path: 'controllers/posts_controller.ts',
    })

    tree.addDependency('providers/database_provider.ts', { path: 'models/user.ts' })
    tree.addDependency('controllers/users_controller.ts', { path: 'models/user.ts' })
    tree.addDependency('controllers/posts_controller.ts', { path: 'models/post.ts' })
    tree.addDependency('models/post.ts', { path: 'services/post_service.ts' })

    assert.deepEqual(tree.isReloadable('app.ts'), false)
    assert.deepEqual(tree.isReloadable('start/index.ts'), false)
    assert.deepEqual(tree.isReloadable('providers/database_provider.ts'), false)
    assert.deepEqual(tree.isReloadable('controllers/users_controller.ts'), true)
    assert.deepEqual(tree.isReloadable('controllers/posts_controller.ts'), true)
    assert.deepEqual(tree.isReloadable('models/user.ts'), false)
    assert.deepEqual(tree.isReloadable('models/post.ts'), true)
    assert.deepEqual(tree.isReloadable('services/post_service.ts'), true)
  })

  test('should not increase the version of a file if it is not reloadable', ({ assert }) => {
    const tree = new DependencyTree({ root: 'app.ts' })

    tree.addDependency('app.ts', { path: 'start/index.ts' })
    tree.addDependency('start/index.ts', { path: 'config/auth.ts' })
    tree.addDependency('config/auth.ts', { path: 'models/user.ts' })
    tree.addDependency('start/index.ts', {
      reloadable: true,
      path: 'controllers/users_controller.ts',
    })

    tree.addDependency('controllers/users_controller.ts', { path: 'models/user.ts' })

    assert.isFalse(tree.isReloadable('models/user.ts'))
    assert.deepEqual(tree.getVersion('models/user.ts'), 0)

    const invalidatedFiles = tree.invalidateFileAndDependents('controllers/users_controller.ts')

    assert.notInclude(Array.from(invalidatedFiles), 'models/user.ts')
    assert.deepEqual(tree.getVersion('models/user.ts'), 0)
  })
})
