export class PostsService {
  /**
   * Try updating the return value of this method and refreshing the page.
   * You will always get the latest version of the code without
   * restarting the whole server.
   */
  getPosts() {
    return [
      { id: 1, title: 'Post 1' },
      { id: 2, title: 'Post 2' },
      { id: 3, title: 'Post 3' },
    ]
  }
}
