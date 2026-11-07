import { join } from 'node:path'
import pTimeout from 'p-timeout'
import supertest from 'supertest'
import { test } from '@japa/runner'
import { setTimeout } from 'node:timers/promises'

import { createHandlerFile, fakeInstall, runProcess } from './helpers.js'

test.group('Register', () => {
  test('Works fine', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { join } from 'node:path'

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js', import.meta.hot?.boundary)
         await app.default(request, response)
       })

       server.listen(3333, () => console.log('Server is running'))`,
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
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated')

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated new' })
    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated new')
  })

  test('works after a loader registered with module.register()', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    /**
     * Like ts-node, preloaded before hot-hook
     */
    await fs.create(
      'async-loader.js',
      `import { register } from 'node:module'
       register('data:text/javascript,export async function load(url, context, next) { return next(url, context) }')`,
    )

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'server.js',
      `import * as http from 'http'

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js', import.meta.hot?.boundary)
         await app.default(request, response)
       })

       server.listen(3333, () => console.log('Server is running'))`,
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      nodeOptions: ['--import=./async-loader.js', '--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated')
  })

  test('send full reload message', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { join } from 'node:path'

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => console.log('Server is running'))`,
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')
    await setTimeout(100)

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    const result = await server.waitForMessage(
      (message: any) =>
        message?.type === 'hot-hook:full-reload' && message.path === join(fs.basePath, 'app.js'),
    )
    assert.isDefined(result)
  })

  test('Can define hardcoded boundaries from package json', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', {
      type: 'module',
      hotHook: {
        boundaries: ['./app.js'],
      },
    })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { join } from 'node:path'

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => console.log('Server is running'))
      `,
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
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated')

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated new' })
    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated new')
  })

  test('use package.json dirname as root directory', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', {
      type: 'module',
      hotHook: { boundaries: ['./src/app.js'] },
    })
    await fs.create(
      'bin/server.js',
      `import * as http from 'http'
       import { join } from 'node:path'

       const server = http.createServer(async (request, response) => {
         const app = await import('../src/app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => console.log('Server is running'))
      `,
    )

    await createHandlerFile({ path: 'src/app.js', response: 'Hello World!' })

    const server = runProcess('bin/server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')

    await createHandlerFile({ path: 'src/app.js', response: 'Hello World! Updated' })
    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated')

    await createHandlerFile({ path: 'src/app.js', response: 'Hello World! Updated new' })
    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated new')
  })

  test('use package.json restart files', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', {
      type: 'module',
      hotHook: {
        boundaries: ['./app.js'],
        restart: ['.restart-file'],
      },
    })
    await fs.create('.restart-file', '')

    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { join } from 'node:path'

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => console.log('Server is running'))
      `,
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')

    await fs.create('.restart-file', '')
    await server.waitForMessage(
      (message: any) =>
        message?.type === 'hot-hook:full-reload' && message.path.includes('.restart-file'),
    )
  })

  test('use default reload files when restart files are not defined', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', {
      type: 'module',
      hotHook: { boundaries: ['./app.js'] },
    })
    await fs.create('.env', '')

    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { join } from 'node:path'

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => console.log('Server is running'))
      `,
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')

    await fs.create('.env', '')
    await server.waitForMessage(
      (message: any) => message?.type === 'hot-hook:full-reload' && message.path.includes('.env'),
    )
  })

  test('watch: false should receive file-changed from parent process', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', {
      type: 'module',
      hotHook: {
        boundaries: ['./app.js'],
        watch: false,
      },
    })
    await fs.create(
      'server.js',
      `import * as http from 'http'

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => console.log('Server is running'))`,
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

    server.child.send({
      type: 'hot-hook:file-changed',
      path: join(fs.basePath, 'app.js'),
      action: 'change',
    })

    await setTimeout(100)
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated')
  })

  test('exits when the application is done, without deprecation warnings', async ({
    fs,
    assert,
  }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', {
      type: 'module',
      hotHook: { boundaries: ['./app.js'] },
    })
    await fs.create('server.js', `await import('./app.js'); console.log('done')`)
    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      nodeOptions: ['--import=hot-hook/register'],
    })

    let stderr = ''
    server.child.stderr?.on('data', (data) => (stderr += data))

    await server.waitForOutput('done')
    await pTimeout(server.waitForExit(), { milliseconds: 2000 })

    assert.equal(server.child.exitCode, 0)
    assert.notInclude(stderr, 'DEP0205')
  })
})
