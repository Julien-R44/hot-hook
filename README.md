# Hot Hook

Hot Hook is a simple and lightweight library for adding hot module reloading in NodeJS with ESM.

You know how in frameworks like React or VueJS, you edit a file and the page updates automatically without needing to refresh? Well, it's the same concept but for NodeJS.

Take an Express server, for example. The most common development process involves watching the entire project with tools like nodemon and restarting the whole server whenever a file changes. With Hot Hook, you no longer need to restart the entire server; you can make it so only the changed module/file is reloaded. This provides a much faster DX and feedback loop.

The library is designed to be very light and simple. It doesn't perform any dark magic, no AST parsing, no code transformation, no bundling. It just reloads the changed module. 

## Installation

> [!TIP]
> If you're using AdonisJS, Hono, or Fastify, we have examples in the examples folder to help you set up Hot Hook in your application.

```bash
pnpm add hot-hook
```

Once installed, you need to add the following code as early as possible in your NodeJS application.

```ts
import { hot } from 'hot-hook'

await hot.init({
  // options
})
```

Next, you need to include the types for `import.meta.hot` in your project. To do this, add the following code in a `.d.ts` file or in the `types` property of your `tsconfig.json`.

```ts
/// <reference types="hot-hook/import-meta" />
```

```json
{
  "compilerOptions": {
    "types": ["hot-hook/import-meta"]
  }
}
```

## Utilisation

Once Hot Hook is initialized in your application, you will need to use `await import()` where you want to benefit from hot module reloading. To understand why, read the "How it works?" section below.

```ts
import * as http from 'http'

const server = http.createServer(async (request, response) => {
  const app = await import('./app.js')
  app.default(request, response)
})

server.listen(8080)
```

This is a simple example, but above, the app.js module will always be reloaded with the latest version every time you modify the file. However, the http server will not be restarted.

We have some examples in the examples folder with different frameworks to help you set up Hot Hook in your application. If you are using [AdonisJS](https://adonisjs.com/): it's your lucky day. Hot hook was the reason why I created this library and we gonna have a complete integration with AdonisJS soon.

## Options

`hot.init` accepts the following options:

- `reload`: An array of glob patterns that specifies which files should trigger a full process reload.
- `ignore`: An array of glob patterns that specifies which files should not be considered by Hot Hook. By default, ['**/node_modules/**'].
- `projectRoot`: The path of the project root folder.

## API

### import.meta.hot

The `import.meta.hot` variable is available if you need to condition code based on whether hot-hook is enabled or not.

```
if (import.meta.hot) {
  // Specific code that will use import.meta.hot
}
```

Or simply use optional chaining:

```
import.meta.hot?.dispose()
```

### import.meta.hot.dispose()

`import.meta.hot.dispose` is a function that allows you to specify code that should run before a module is reloaded. This can be useful for closing connections, cleaning up resources, etc.

```ts
const interval = setInterval(() => {
  console.log('Hello')
}, 1000)

import.meta.hot?.dispose(() => {
  clearInterval(interval)
})
```

Here, each time the module is reloaded, the `interval` will be cleaned up.

### import.meta.hot.decline()

`import.meta.hot.decline` is a function that allows you to specify that the module should not be reloaded. This can be useful for modules that are not supposed to be hot reloaded, like configuration files.

```ts
import.meta.hot?.decline()

export const config = {
  port: 8080
}
```

If this file is modified, then hot hook will call the `onFullReloadAsked` function, which you can specify in the options of `hot.init`. Otherwise, by default it will just send a message to the parent process to reload the module.

## How it works ?

First, let's start by explaining the basics.

### What is a hook ? 

Hot Hook is a [hook](https://nodejs.org/api/module.html#customization-hooks) for Node.js. In short: a hook is a way to intercept the loading of a module. Every time you do an import in your code, Hot Hook can intercept this and perform additional actions like injecting or transforming the module's imported code, recording information about the module, etc.

### ESM Cache busting

Once you use an import, Node.js loads the module into memory and keeps it in cache. This means that if you import the same module multiple times in your application, Node.js will load it only once throughout the application's lifetime.

This is problematic for hot module reloading.

Previously, with CommonJS (require), we had control over this Node.js cache. We could remove a module from the cache (delete require.cache), and thus a require on this module would force Node.js to fetch the latest version of the module.

So, how do we do this in ESM? There have been lots of discussions on this topic for a while (https://github.com/nodejs/node/issues/49442, https://github.com/nodejs/help/issues/2806). But for now, there's no official solution. However, there is a trick. A trick that causes memory leaks, but they are so minimal that it shouldn't be a problem for most applications. Especially since we use this trick ONLY in development mode.

This trick is what Hot Hook uses to do hot module reloading. And it simply involves adding a query parameter to the URL of the imported module. This forces Node.js to load the module anew, thus getting the latest version of the module.

```ts
await import('./app.js?v=1')
await sleep(5_000)
await import('./app.js?v=2')
```

If you execute this code, and modify the app.js file between the two imports, then the second import will load the latest version of the module you've saved.

### Full reload

Now, how do we perform a full reload? How do we force Node.js to reload the entire process?

For this, there's no secret : you will need a process manager. Whenever a file listed in `reload`, or a file containing the `import.meta.hot?.decline()` instruction is modified, Hot Hook will by default send a message to the parent process to tell it to reload the module. But for that, you need a parent process. And a parent process that understands this instruction.

So the concept is simple: the manager needs to launch your application as a child process and listen to messages from the child process. If the child process sends a message asking for a full reload, then the manager must kill the child process and restart it.

It's quite simple. However, we ship a process manager with Hot Hook. See the documentation of the runner here[here](./packages/runner/) for more information, and also see the examples in the [examples](./examples/) folder that use the runner.

### Hot Hook

With all that, Hot Hook is ultimately quite simple:

- Intercept imports with a hook
- Collect all imported files and build a dependency tree
- If a file changes, then increase the query parameter of the imported module's URL
- Thus, the next time the module is imported, Node.js will load the latest version of the module

Simple, lightweight, and efficient.

## Credits

Hot Hook was initially forked from [hot-esm](https://github.com/vinsonchuong/hot-esm) by Vinson Chuong. Thanks a lot for the initial work!
