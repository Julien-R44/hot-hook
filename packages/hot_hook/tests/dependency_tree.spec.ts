import { test } from '@japa/runner'
import DependencyTree from '../src/dependency_tree.js'

test.group('Dependency tree', () => {
  test('scenario 1', ({ assert }) => {
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

  test('scenario 2', ({ assert }) => {
    const tree = new DependencyTree({ root: 'app.ts' })

    tree.addDependency('app.ts', { path: 'start/index.ts' })
    tree.addDependency('app.ts', { path: 'models/user.ts' })
    tree.addDependency('start/index.ts', {
      path: 'controllers/users_controller.ts',
      reloadable: true,
    })
    tree.addDependency('controllers/users_controller.ts', { path: 'models/user.ts' })
    tree.addDependency('controllers/users_controller.ts', { path: 'user_presenter.ts' })
    tree.addDependency('user_presenter.ts', { path: 'utils/index.ts' })

    assert.deepEqual(tree.isReloadable('app.ts'), false)
    assert.deepEqual(tree.isReloadable('models/user.ts'), false)
    assert.deepEqual(tree.isReloadable('start/index.ts'), false)
    assert.deepEqual(tree.isReloadable('controllers/users_controller.ts'), true)
    assert.deepEqual(tree.isReloadable('user_presenter.ts'), true)

    const invalidated = tree.invalidateFileAndDependents('user_presenter.ts')

    assert.deepEqual(invalidated.size, 2)
    assert.deepEqual(tree.getVersion('user_presenter.ts'), 1)
    assert.deepEqual(tree.getVersion('controllers/users_controller.ts'), 1)
    assert.deepEqual(tree.getVersion('models/user.ts'), 0)
    assert.deepEqual(tree.getVersion('utils/index.ts'), 0)
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
