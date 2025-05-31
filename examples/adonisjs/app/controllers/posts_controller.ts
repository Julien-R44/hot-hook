import type { HttpContext } from '@adonisjs/core/http'

export default class PostsController {
  async handle({}: HttpContext) {
    return [
      { id: 1, title: 'Yeah' },
      { id: 2, title: 'Another one' },
      { id: 3, title: 'Last one' },
    ]
  }
}
