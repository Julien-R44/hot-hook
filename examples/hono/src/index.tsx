import { Hono } from 'hono'
import { hot } from 'hot-hook'
import { serve } from '@hono/node-server'
import { setTimeout } from 'node:timers/promises'

await hot.init({})

/**
 * Let's imagine we have a complex initialization step that takes
 * a while to complete. This is pretty common in real-world application
 * We need to setup the database, read configurations files,
 * setup other services etc..
 */
console.log('Initializing the application..')
await setTimeout(2_000)
console.log('Ready to serve requests')

/**
 * That means now, if we don't have hot-hook, we would need to restart
 * the whole process each time we make a change to our JSX views.
 *
 * 2s between each change. Even a simple CSS padding update.
 *
 * This is slow.
 *
 * This is where hot-hook comes into play. Give it a try by changing
 * the JSX view and see the changes without restarting the server.
 */

const app = new Hono()

app.get('/', async (c) => {
  const { Home } = await import('./views/home.js')
  return c.html(<Home />)
})

const port = 3000
console.log(`Server is running on port ${port}`)

serve({ fetch: app.fetch, port })

/**
 * Note: You will notice the browser doesn't auto reload when you
 * make a change. This is something you will have to setup yourself
 * with Hono. Too lazy to do it, sorry.
 */
