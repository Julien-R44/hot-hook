import { join } from 'node:path'
import { pEvent } from 'p-event'
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
    const result = await pEvent(
      server.child,
      'message',
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

    await setTimeout(100)
    await createHandlerFile({ path: 'src/app.js', response: 'Hello World! Updated' })
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated')

    await setTimeout(100)
    await createHandlerFile({ path: 'src/app.js', response: 'Hello World! Updated new' })
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
    await pEvent(
      server.child,
      'message',
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
    await pEvent(
      server.child,
      'message',
      (message: any) => message?.type === 'hot-hook:full-reload' && message.path.includes('.env'),
    )
  })

  test('can use env variables to assign boundaries', async ({ fs }) => {
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

       server.listen(3333, () => console.log('Server is running'))`
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook', HOT_HOOK_BOUNDARIES: './app.js' },
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

  test('can include files to watch and should sent file-changed message', async ({
    fs,
    assert,
  }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create('server.js', `console.log('Server is running')`)
    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook', HOT_HOOK_INCLUDE: './app.js' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    const result = await pEvent(
      server.child,
      'message',
      (message: any) =>
        message?.type === 'hot-hook:file-changed' && message.path === join(fs.basePath, 'app.js')
    )

    assert.isDefined(result)
  })

  test('send action "unlink" when file is removed', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create('server.js', `console.log('Server is running')`)
    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook', HOT_HOOK_INCLUDE: './app.js' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')

    await fs.remove('app.js')
    const result = await pEvent(server.child, 'message', (message: any) => {
      return (
        message?.type === 'hot-hook:file-changed' &&
        message.path === join(fs.basePath, 'app.js') &&
        message.action === 'unlink'
      )
    })

    assert.isDefined(result)
  })

  test('"include" should works with glob patterns', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create('server.js', `console.log('Server is running')`)
    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook', HOT_HOOK_INCLUDE: './**/*.js' },
      nodeOptions: ['--import=hot-hook/register'],
    })

    await server.waitForOutput('Server is running')

    await createHandlerFile({ path: 'app2.js', response: 'Hello World! Updated' })
    const result = await pEvent(
      server.child,
      'message',
      (message: any) =>
        message?.type === 'hot-hook:file-changed' &&
        message.path === join(fs.basePath, 'app2.js') &&
        message.action === 'add'
    )

    assert.isDefined(result)
  })
})
