import { }
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/', async (c) => {
  const { MyService } = await import('./my_service.js')
  const myService = new MyService()

  return c.text(myService.doSomeBusinessLogic())
})

const port = 3000
console.log(`Server is running on port ${port}`)

serve({ fetch: app.fetch, port })
