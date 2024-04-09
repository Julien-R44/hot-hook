import { uppercasePostTitles } from "../helpers/posts";

export class PostsService {
  /**
   * Try updating the return value of this method and refreshing the page.
   * You will always get the latest version of the code without
   * restarting the whole server.
   */
  getPosts() {
    return uppercasePostTitles([
      { id: 1, title: 'post 1' },
      { id: 2, title: 'post 2' },
      { id: 3, title: 'post 3' },
    ])
  }
}
