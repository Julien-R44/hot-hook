import { test } from '@japa/runner'
import DependencyTree from '../src/dependency_tree.js'

test.group('Dependency Tree', () => {
  test('managing a single file', ({ assert }) => {
    const tree = new DependencyTree()

    tree.add('foo.js')
    assert.isTrue(tree.has('foo.js'))
    assert.deepEqual(tree.getVersion('foo.js'), 1)

    tree.invalidate('foo.js')
    assert.isTrue(tree.has('foo.js'))
    assert.deepEqual(tree.getVersion('foo.js'), 2)

    tree.remove('foo.js')
    assert.isFalse(tree.has('foo.js'))
    assert.isUndefined(tree.getVersion('foo.js'))
  })

  test('managing a file imported by other files', ({ assert }) => {
    const tree = new DependencyTree()
    tree.add('root.js')

    tree.add('left.js')
    tree.addDependent('left.js', 'root.js')

    tree.add('left-one.js')
    tree.addDependent('left-one.js', 'left.js')

    tree.add('left-two.js')
    tree.addDependent('left-two.js', 'left.js')

    tree.add('right.js')
    tree.addDependent('right.js', 'root.js')

    const invalidated = tree.invalidateFileAndDependents('left-one.js')
    assert.deepEqual(Array.from(invalidated), ['left-one.js', 'left.js', 'root.js'])

    assert.deepEqual(tree.getVersion('left-one.js'), 2)
    assert.deepEqual(tree.getVersion('left.js'), 2)
    assert.deepEqual(tree.getVersion('root.js'), 2)

    assert.deepEqual(tree.getVersion('left-two.js'), 1)
    assert.deepEqual(tree.getVersion('right.js'), 1)
  })

  test('supporting circular dependencies', ({ assert }) => {
    const tree = new DependencyTree()
    tree.add('one.js')

    tree.add('two.js')
    tree.addDependent('two.js', 'one.js')

    tree.add('three.js')
    tree.addDependent('three.js', 'two.js')
    tree.addDependent('one.js', 'three.js')

    const invalidated = tree.invalidateFileAndDependents('three.js')
    assert.deepEqual(Array.from(invalidated), ['three.js', 'two.js', 'one.js'])

    assert.deepEqual(tree.getVersion('one.js'), 2)
    assert.deepEqual(tree.getVersion('two.js'), 2)
    assert.deepEqual(tree.getVersion('three.js'), 2)
  })
})
