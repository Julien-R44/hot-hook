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
         root: import.meta.filename,
       })

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js', { with: { hot: 'true' } })
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
         root: import.meta.filename,
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

  test('even add import.meta.hot to ignored files', async ({ fs, assert }) => {
    await fakeInstall(fs.basePath)

    await fs.createJson('package.json', { type: 'module' })
    await fs.create(
      'config/test.js',
      `
       if (import.meta.hot) {
        process.send({ type: 'ok' })
       }
       console.log(import.meta.hot)
       console.log("Hello")
    `
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
       })`
    )

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })

    await server.waitForOutput('Server is running')
    await setTimeout(100)

    const result = await pEvent(server.child, 'message', (message: any) => message?.type === 'ok')
    assert.isDefined(result)
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
       })`
    )

    const server = runProcess('server.js', {
      cwd: fs.basePath,
      env: { NODE_DEBUG: 'hot-hook' },
    })

    await server.waitForOutput('Server is running')
    await setTimeout(100)

    await supertest('http://localhost:3333').get('/').expect(200).expect('Hello')

    createHandlerFile({ path: 'config/test.js', response: 'Hello Updated' })

    const result = await pEvent(
      server.child,
      'message',
      (message: any) =>
        message?.type === 'hot-hook:invalidated' &&
        message.paths.includes(join(fs.basePath, 'config/test.js'))
    )

    assert.isDefined(result)
  })
})
