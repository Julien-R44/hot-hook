import { test } from '@japa/runner'
import { Matcher } from '../src/matcher.js'

test.group('Matcher', () => {
  test('works fine with double glob pattern and absolute', ({ assert }) => {
    const matcher = new Matcher('/home/foo/bar', ['**/node_modules/**'])

    const matches = [
      '/node_modules/test/.pnpm/test/index.js',
      '/home/foo/node_modules/test/index.js',
      '/home/foo/bar/node_modules/test/index.js',
      '/home/foo/bar/test/bla/node_modules/test/index.js',
    ]

    assert.isTrue(matches.every((match) => matcher.match(match)))
  })

  test('works fine with relative paths', ({ assert }) => {
    const matcher = new Matcher('/home/foo/bar', ['./config/**'])

    const matches = [
      '/home/foo/bar/config/index.js',
      '/home/foo/bar/config/index.ts',
      '/home/foo/bar/config/test/index.js',
    ]

    const notMatches = [
      '/home/config/index.js',
      '/home/foo/bar/config.js',
      '/home/foo/bar/test/config/index.js',
    ]

    assert.isTrue(matches.every((match) => matcher.match(match)))
    assert.isFalse(notMatches.some((match) => matcher.match(match)))
  })

  test('works fine with relative paths but without leading ./', ({ assert }) => {
    const matcher = new Matcher('/home/foo/bar', ['config/**'])

    const matches = [
      '/home/foo/bar/config/index.js',
      '/home/foo/bar/config/index.ts',
      '/home/foo/bar/config/test/index.js',
    ]

    const notMatches = [
      '/home/config/index.js',
      '/home/foo/bar/config.js',
      '/home/foo/bar/test/config/index.js',
    ]

    assert.isTrue(matches.every((match) => matcher.match(match)))
    assert.isFalse(notMatches.some((match) => matcher.match(match)))
  })

  test('works with parent directory', ({ assert }) => {
    const matcher = new Matcher('/home/foo/bar', ['../config/**'])

    const matches = ['/home/foo/config/index.js', '/home/foo/config/bar/index.js']

    const notMatches = [
      '/home/config/index.js',
      '/home/foo/bar/config/index.js',
      '/home/foo/bar/config/test/index.js',
    ]

    assert.isTrue(matches.every((match) => matcher.match(match)))
    assert.isFalse(notMatches.some((match) => matcher.match(match)))
  })
})
