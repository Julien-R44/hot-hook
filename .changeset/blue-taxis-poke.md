---
'hot-hook': minor
---

Earlier, with this release https://github.com/Julien-R44/hot-hook/releases/tag/hot-hook%400.3.0 we were just throwing and thus killing the app when a boundary file was not dynamically imported because it prevented hot-hook from hot-reloading.

Now, we no longer throw the error by default, we simply emit a message of type "hot-hook:full-reload" to the parent process, which will be responsible for restarting the entire app. This "hot-hook:full-reload" message is not new, it was already used for files that should trigger a full reload.

If you still want to throw the error, then you can pass the `throwWhenBoundariesAreNotDynamicallyImported` option to true, when you call `hot.init` or in your `package.json`:

```json
{
  "hotHook": {
    "throwWhenBoundariesAreNotDynamicallyImported": true
  }
}
```
