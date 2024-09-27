---
"hot-hook": minor
---

Now Hot-Hook will throw an error when a file marked as "boundary" is not dynamically imported.

In AdonisJS, we had a few users complaining about having to restart the server to see the changes applied. Generally, the cause of this was a controller file not dynamically imported:

```ts
import PostsController from './app/controllers/posts_controller.js'
router.get('/posts', [PostsController, 'index'])
```

Before this new version, this code did not throw an error, but it did not work either. You had to reload the server to see the changes. Now Hot-Hook will throw an error for this kind of case.

I invite you to reread the readme if you want to understand why a dynamic import is necessary for Hot-Hook to work correctly.
