import { join } from 'node:path'
import supertest from 'supertest'
import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { createHandlerFile, fakeInstall, runProcess } from './helpers.js'

test.group('Loader', () => {
  test('Works fine', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'

       await hot.init({
         root: import.meta.filename,
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js', { with: { hot: 'true' } })
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', { cwd: fs.basePath, env: { NODE_DEBUG: 'hot-hook' } })
    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated')

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated new' })
    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated new')
  })

  test('send full reload message', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'

       await hot.init({
         root: import.meta.filename,
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })
    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')
    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    await setTimeout(100)

    const result = await server.waitForMessage(
      (message: any) =>
        message?.type === 'hot-hook:full-reload' && message.path === join(fs.basePath, 'app.js'),
    )
    assert.isDefined(result)
  })

  test('ignore node_modules by default', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.createJson('node_modules/app/package.json', { type: 'module' })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'

       await hot.init({
         root: import.meta.filename,
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./node_modules/app/app.js', { with: { hot: 'true' } })
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    await createHandlerFile({ path: 'node_modules/app/app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })
    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')
    await setTimeout(100)

    await createHandlerFile({ path: 'node_modules/app/app.js', response: 'Hello World! Updated' })
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')
  })

  test('even add import.meta.hot to ignored files', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'config/test.js',
      `
       if (import.meta.hot) {
        process.send({ type: 'ok' })
       }
    `,
    )
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'

       await hot.init({
         root: import.meta.filename,
         ignore: ['config/**'],
       })

       await import('./config/test.js')

       const server = http.createServer(async (request, response) => {
         const app = await import('./config/test.js')
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })

    await server.waitForOutput('Server is running')
    await setTimeout(100)

    const result = await server.waitForMessage((message: any) => message?.type === 'ok')
    assert.isDefined(result)
  })

  test('does not shift positions of modules that do not use import.meta', async ({
    fs,
    assert,
  }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create('app.js', `export function boom() { throw new Error('boom') }`)
    await fs.create(
      'server.js',
      `import { hot } from 'hot-hook'

       await hot.init({ root: import.meta.filename })

       const app = await import('./app.js', { with: { hot: 'true' } })
       try {
         app.boom()
       } catch (error) {
         process.send({ type: 'stack', frame: error.stack.split('\\n')[1] })
       }`,
    )

    const server = runProcess('server.js', { cwd: fs.basePath })
    const result: any = await server.waitForMessage((m: any) => m?.type === 'stack')

    assert.match(result.frame, /app\.js\?hot-hook=0:1:32\)$/)
  })

  test('injects import.meta.hot into modules checking `"hot" in import.meta`', async ({
    fs,
    assert,
  }) => {
    await fakeInstall(fs.basePath)

    /**
     * Like @adonisjs/fold, which re-imports controllers only when `hot` is set
     */
    await fs.createJson('package.json', { type: 'module' })
    await fs.create('app.js', `export const hasHot = 'hot' in import.meta`)
    await fs.create(
      'server.js',
      `import { hot } from 'hot-hook'

       await hot.init({ root: import.meta.filename })

       const app = await import('./app.js')
       process.send({ type: 'has-hot', value: app.hasHot })`,
    )

    const server = runProcess('server.js', { cwd: fs.basePath })
    const result: any = await server.waitForMessage((m: any) => m?.type === 'has-hot')

    assert.isTrue(result.value)
  })

  test('keeps inline source maps exact on the first line', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    /**
     * Segments: col 0 -> 1:0, col 28 (`new Error`) -> 1:10, col 60 -> 5:0.
     * Without shifting, the error position falls on the last segment (5:0)
     */
    const map = { version: 3, sources: ['original.ts'], names: [], mappings: 'AAAA,4BAAU,gCAIV' }
    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'app.js',
      `export function boom() { throw new Error(import.meta.url) } /* padding */\n` +
        `//# sourceMappingURL=data:application/json;base64,${Buffer.from(JSON.stringify(map)).toString('base64')}\n`,
    )
    await fs.create(
      'server.js',
      `import { hot } from 'hot-hook'

       await hot.init({ root: import.meta.filename })

       const app = await import('./app.js', { with: { hot: 'true' } })
       try {
         app.boom()
       } catch (error) {
         process.send({ type: 'stack', frame: error.stack.split('\\n')[1] })
       }`,
    )

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      nodeOptions: ['--enable-source-maps'],
    })
    const result: any = await server.waitForMessage((m: any) => m?.type === 'stack')

    assert.match(result.frame, /original\.ts:1:11\)$/)
  })

  test('send invalidated message when file is invalidated', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await createHandlerFile({ path: 'config/test.js', response: 'Hello' })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'

       await hot.init({
         root: import.meta.filename,
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./config/test.js', { with: { hot: 'true' } })
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })

    await server.waitForOutput('Server is running')
    await setTimeout(100)

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello')

    createHandlerFile({ path: 'config/test.js', response: 'Hello Updated' })

    const result = await server.waitForMessage(
      (message: any) =>
        message?.type === 'hot-hook:invalidated' &&
        message.paths.includes(join(fs.basePath, 'config/test.js')),
    )

    assert.isDefined(result)
  })

  test('Can define hardcoded boundaries', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'

       await hot.init({
         root: import.meta.filename,
         boundaries: ['./app.js']
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', { cwd: fs.basePath, env: { NODE_DEBUG: 'hot-hook' } })
    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated')

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated new' })
    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated new')
  })

  test('full reload when a `restart` file changes', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create('.env', 'HELLO=WORLD')

    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'

       await hot.init({
         root: import.meta.filename,
       })

       const server = http.createServer(async (request, response) => {
          const HELLO = process.env.HELLO

          response.writeHead(200, {'Content-Type': 'text/plain'})
          response.end(HELLO)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
      nodeOptions: ['--env-file=.env'],
    })

    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('WORLD')

    await setTimeout(100)
    fs.create('.env', 'HELLO=WORLD UPDATED')
    const result = await server.waitForMessage(
      (message: any) => message?.type === 'hot-hook:full-reload',
    )
    assert.isDefined(result)
  }).disableTimeout()

  test('full reload if file should be reloadable but is not dynamically imported', async ({
    fs,
    assert,
  }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module', hotHook: { boundaries: ['./app.js'] } })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'
       import app from './app.js'

       const server = http.createServer(async (request, response) => {
         await app(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    await setTimeout(100)

    const result = await server.waitForMessage(
      (message: any) =>
        message?.type === 'hot-hook:full-reload' && message.shouldBeReloadable === true,
    )
    assert.isDefined(result)
  }).disableTimeout()

  test('send shouldBeReloadable if parent boundary is not dynamically importd', async ({
    fs,
    assert,
  }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module', hotHook: { boundaries: ['./app.js'] } })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'
       import app from './app.js'

       const server = http.createServer(async (request, response) => {
         await app(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    await fs.create(
      'app.js',
      `
      import { test } from './app2.js'

      export default function(request, response) {
        response.writeHead(200, {'Content-Type': 'text/plain'})
        response.end('Hello World!')
      }`,
    )
    await fs.create(`app2.js`, `export function test() { return 'Hello World!' }`)

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')

    await fs.create(`app2.js`, `export function test() { return 'Hello Test!' }`)

    await setTimeout(100)

    const result = await server.waitForMessage((message: any) => {
      console.log(message)
      return message?.type === 'hot-hook:full-reload' && message.shouldBeReloadable === true
    })
    assert.isDefined(result)
  }).disableTimeout()

  test('throw error if file should be reloadable but is not dynamically imported and flag is set', async ({
    fs,
    assert,
  }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', {
      type: 'module',
      hotHook: { boundaries: ['./app.js'], throwWhenBoundariesAreNotDynamicallyImported: true },
    })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'
       import app from './app.js'

       const server = http.createServer(async (request, response) => {
         await app(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`,
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await assert.rejects(() => server.waitForExit())
  }).disableTimeout()
})
