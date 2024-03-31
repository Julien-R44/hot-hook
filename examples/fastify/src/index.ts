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
  const { PostsService } = await import('./posts_service.js')
  return new PostsService().getPosts()
})

const start = async () => {
  try {
    throw new Error('foo')
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
