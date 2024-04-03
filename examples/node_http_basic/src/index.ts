import * as http from 'node:http'

const server = http.createServer(async (request, response) => {
  const app = await import('./app.js', import.meta.hot?.boundary)
  app.default(request, response)
})

server.listen(8080)

console.log('Server running at http://localhost:8080/')
