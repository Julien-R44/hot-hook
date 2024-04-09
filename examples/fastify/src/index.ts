import Fastify from 'fastify'

const fastify = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
    },
  },
})

fastify.get('/', async (request, reply) => {
  const { PostsService } = await import('./services/posts_service.js', { with: { hot: 'true' }})
  return new PostsService().getPosts()
})

/**
 * This route is totally optional and can be used to visualize
 * your dependency graph in a browser.
 */
fastify.get('/dump-viewer', async (request, reply) => {
  const { dumpViewer } = await import('@hot-hook/dump-viewer')

  reply.header('Content-Type', 'text/html; charset=utf-8')
  return dumpViewer()
})

const start = async () => {
  try {
    await fastify.listen({ port: 3000 })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
