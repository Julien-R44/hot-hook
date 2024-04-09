import * as http from 'node:http'

const server = http.createServer(async (request, response) => {
  const app = await import('./app.js')
  app.default(request, response)
})

server.listen(3000)

console.log('Server running at http://localhost:3000/')
