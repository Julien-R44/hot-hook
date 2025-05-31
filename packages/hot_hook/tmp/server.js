import * as http from 'http'
       import { join } from 'node:path'

       const server = http.createServer(async (request, response) => {
         const app = await import('./app.js')
         await app.default(request, response)
       })

       server.listen(3333, () => console.log('Server is running'))