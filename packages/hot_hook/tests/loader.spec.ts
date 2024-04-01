import { join } from 'node:path'
import { pEvent } from 'p-event'
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
         projectRoot: join(import.meta.dirname, '..'),
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', { cwd: fs.basePath, env: { NODE_DEBUG: 'hot-hook' } })
    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')

    await setTimeout(100)
    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World! Updated')

    await setTimeout(100)
    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated new' })
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
         projectRoot: join(import.meta.dirname, '.'),
         reload: ['app.js'],
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })
    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')
    await setTimeout(100)

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    const result = await pEvent(
      server.child,
      'message',
      (message: any) =>
        message?.type === 'hot-hook:full-reload' && message.path === join(fs.basePath, 'app.js')
    )
    assert.isDefined(result)
  })

  test('does not watch specified files', async ({ fs }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'

       await hot.init({
         projectRoot: join(import.meta.dirname, '.'),
         ignore: ['app.js'],
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })
    await server.waitForOutput('Server is running')

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')
    await setTimeout(100)

    await createHandlerFile({ path: 'app.js', response: 'Hello World! Updated' })
    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello World!')
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
         projectRoot: join(import.meta.dirname, '.'),
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./node_modules/app/app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`
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

  test('add reload paths to the watcher', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create('config/test.js', 'console.log("Hello")')
    await fs.create('config/test2.js', 'console.log("Hello")')
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'

       await hot.init({
         projectRoot: join(import.meta.dirname, '.'),
         reload: ['app.js', 'server.js', 'config/**/*'],
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => {
         console.log('Server is running')
       })`
    )

    await createHandlerFile({ path: 'app.js', response: 'Hello World!' })

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })

    await server.waitForOutput('Server is running')
    await fs.create('config/test.js', 'console.log("Hello Updated")')

    await setTimeout(100)

    const result = await pEvent(
      server.child,
      'message',
      (message: any) =>
        message?.type === 'hot-hook:full-reload' &&
        message.path === join(fs.basePath, 'config/test.js')
    )

    assert.isDefined(result)
  })

  test('dependent files of reload paths should trigger a full reload', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'config/test.js',
      `
       import '../app/test.js'
       console.log("Hello")
    `
    )
    await fs.create('app/test.js', 'console.log("Hello")')
    await fs.create(
      'server.js',
      `import * as http from 'http'
       import { hot } from 'hot-hook'
       import { join } from 'node:path'
       import { setTimeout } from 'node:timers/promises'

       await hot.init({
         projectRoot: join(import.meta.dirname, '.'),
         reload: ['config/**/*'],
       })

       await import('./config/test.js')
       await setTimeout(100)
       console.log('Server is running')
       await setTimeout(2000)
      `
    )

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })

    await server.waitForOutput('Server is running')

    await fs.create('app/test.js', 'console.log("Hello Updated")')
    await setTimeout(100)

    const result = await pEvent(
      server.child,
      'message',
      (message: any) =>
        message?.type === 'hot-hook:full-reload' &&
        message.path === join(fs.basePath, 'app/test.js')
    )

    assert.isDefined(result)
  })
})
