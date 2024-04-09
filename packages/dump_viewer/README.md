## Dump Viewer 

The dump viewer is a small frontend app built with `Vis.js` that lets you view Hot Hook's dependency graph. This lets you quickly see which files are hot reloadable and which aren't, and why.

![image](../../assets/dump_viewer.png)

To use it, you can add it to your application as follows: 

```ts
router.get('/dump-viewer', async (request, reply) => {
  const { dumpViewer } = await import('@hot-hook/dump-viewer')

  reply.header('Content-Type', 'text/html; charset=utf-8')
  return dumpViewer()
})
```

then access your dev server at `/dump-viewer`.
