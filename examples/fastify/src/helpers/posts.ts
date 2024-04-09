export function uppercasePostTitles(posts: any[]) {
  return posts.map((post) => ({
    ...post,
    title: post.title.toUpperCase(),
  }))
}
