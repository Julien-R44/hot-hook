---
'hot-hook': patch
---

One of the problems we encountered was that Hot Hook didn't send a full reload message when a `.env` file was changed, for example. This is because `.env` files are not javascript modules, and so are not processed by Hot Hook nor added to the dependency graph.

As a result, this commit introduces a `restart` property in the config that allows you to specify which files should trigger a full reload. By default, `restart` will be equal to `['.env']`.

```js
// package.json
{
  “hotHook”: {
    “restart”: [“.env”, “./config/foo.yaml”]
  }
}
```
