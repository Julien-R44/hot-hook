import { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Try updating this function and saving the file while the server is running.
 * You will always get the updated version of this function without restarting the server.
 */
export default function handler(_request: IncomingMessage, response: ServerResponse) {
  response.writeHead(200, { 'Content-Type': 'text/plain' })
  response.end('Hello, world!')
}
