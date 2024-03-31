import Fastify from 'fastify'

const fastify = Fastify({ logger: true })

fastify.get('/', async (request, reply) => {
  const { PostsService } = await import('./posts_service.js')
  return new PostsService().getPosts()
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
