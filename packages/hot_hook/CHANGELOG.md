# hot-hook

## 0.4.1-next.0

### Patch Changes

- d66a6d6: ## Global watching and file-changed events

  Add support for "global watching" and "file-changed" events

  Before this commit, Hot-hook only watched files after they were imported at runtime. Now, it directly watches all project files and sends a "file-changed" event whenever a file is modified, deleted, or added. This allows "runners" to react in various ways to file changes based on their needs.

  The option to configure which files to watch is `include`, and by default is set to `["**/*"]`, meaning all files from the `rootDirectory`.

  The behavior will be as follows:

  - If the file has not yet been imported at runtime, and therefore is not part of the import graph, and it is modified, then a `hot-hook:file-changed` event will be emitted with the payload `{ path: string, action: "change" | "add" | "unlink"}`
  - If the file has already been imported at runtime, and it is hot reloadable, then a `hot-hook:invalidated` event will be emitted with the payload `{ path: string }`. As before.
  - If the file has already been imported at runtime and it is not hot reloadable, then `hot-hook:full-reload` will be emitted with the payload `{ path: string }`. As before.

  ## Environment variables configuration

  You can now configure certain environment variables for hot-hook, which are:

  - `HOT_HOOK_IGNORE`: for the `ignore` option. Example: `HOT_HOOK_IGNORE=**/node_modules/**,**/dist/**`
  - `HOT_HOOK_INCLUDE`: for the `include` option. Example: `HOT_HOOK_INCLUDE=**/*`
  - `HOT_HOOK_BOUNDARIES`: for the `boundaries` option. Example: `HOT_HOOK_BOUNDARIES=./controllers/**/*.ts`
  - `HOT_HOOK_RESTART`: for the `restart` option. Example: `HOT_HOOK_RESTART=.env,./config/**/*.ts`

## 0.4.0

### Minor Changes

- 0ab1205: Earlier, with this release https://github.com/Julien-R44/hot-hook/releases/tag/hot-hook%400.3.0 we were just throwing and thus killing the app when a boundary file was not dynamically imported because it prevented hot-hook from hot-reloading.

  Now, we no longer throw the error by default, we simply emit a message of type "hot-hook:full-reload" to the parent process, which will be responsible for restarting the entire app. This "hot-hook:full-reload" message is not new, it was already used for files that should trigger a full reload.

  If you still want to throw the error, then you can pass the `throwWhenBoundariesAreNotDynamicallyImported` option to true, when you call `hot.init` or in your `package.json`:

  ```json
  {
    "hotHook": {
      "throwWhenBoundariesAreNotDynamicallyImported": true
    }
  }
  ```

### Patch Changes

- 623294e: See https://github.com/tailwindlabs/tailwindcss/discussions/15105

  Sometimes in the resolve hook, we receive a parentUrl that is just `data:`. I didn't really understand
  why yet, for now we just ignore these cases and that seems to fix the issue with Tailwind V4.

## 0.3.1

### Patch Changes

- b639a3c: On some linux distributions, or on some IDE/Text-Editor, only the `unlink` message is received by chokidar when a file is changed/saved. This commit now treats the `unlink` message as a file change, and therefore triggers the HMR/Full-reload logic

## 0.3.0

### Minor Changes

- 64b51ed: Now Hot-Hook will throw an error when a file marked as "boundary" is not dynamically imported.

  In AdonisJS, we had a few users complaining about having to restart the server to see the changes applied. Generally, the cause of this was a controller file not dynamically imported:

  ```ts
  import PostsController from './app/controllers/posts_controller.js'
  router.get('/posts', [PostsController, 'index'])
  ```

  Before this new version, this code did not throw an error, but it did not work either. You had to reload the server to see the changes. Now Hot-Hook will throw an error for this kind of case.

  Suggesting to reread the readme if you want to understand why a dynamic import is necessary for Hot-Hook to work correctly.

## 0.2.6

### Patch Changes

- f81b32f: [Vite has a bug](https://github.com/vitejs/vite/issues/13267) that causes a `vite.config.js.timestamp-*` file to be created and persisted under certain conditions. When Hot-Hook is used with Vite, this bug can sometimes cause the server to restart indefinitely. Consequently, this commit adds these files by default to Hot-Hook's `ignore` config.

## 0.2.5

### Patch Changes

- 89c2a60: Add support for Node.js 20. We removed the direct usage of `importAttributes` that was only introduced in Node.js 20.9. Hot-hook should works fine with Node.js 20.0.0 and above.

## 0.2.4

### Patch Changes

- 7d4a8bc: Fix: should use default values when configured through --import=hot-hook/register

## 0.2.3

### Patch Changes

- 07cadde: The HMR was a bit broken in some situations due to a change introduced by 117f9c150df9b5ec1463f59364a27572c7f3f3e8. This has been fixed and tests have been added to prevent it happening again.
- 0ade4eb: One of the problems we encountered was that Hot Hook didn't send a full reload message when a `.env` file was changed, for example. This is because `.env` files are not javascript modules, and so are not processed by Hot Hook nor added to the dependency graph.

  As a result, this commit introduces a `restart` property in the config that allows you to specify which files should trigger a full reload. By default, `restart` will be equal to `['.env']`.

  ```js
  // package.json
  {
    “hotHook”: {
      “restart”: [“.env”, “./config/foo.yaml”]
    }
  }
  ```

## 0.2.2

### Patch Changes

- 117f9c1: Bugfix : We should not invalidate non-reloadable files when a reloadable file is changed. That means, we gonna keep fetching the same file from the cache and not increase the version query param. This was not the case until this commit and caused theses issues for example :

  - https://github.com/orgs/adonisjs/discussions/4544
  - https://github.com/orgs/adonisjs/discussions/4537

## 0.2.1

### Patch Changes

- 5f6de24: `--import=hot-hook/register` was broken due to a bug in path handling that wasn't cross platform. This has been fixed and also added a Windows CI to prevent this from happening again.

## 0.2.0

### Minor Changes

- c0defa6: From this commit, if you are using `--import=hot-hook/register` for using hot-hook, the `package.json` will be used for resolving glob patterns in the `boundaries` config.

  That means, if you had a `package.json` with the following content, and a root entrypoint in `./src/start.ts`, glob patterns were resolved from `./src/start.ts` file :

  ```json
  {
    "name": "my-package",
    "version": "1.0.0",
    "hot-hook": {
      "boundaries": ["./controllers/**/*"]
    }
  }
  ```

  This configuration was matching all files in the `./src/controllers` directory. To achieve the same result, you should now use the following configuration:

  ```json
  {
    "name": "my-package",
    "version": "1.0.0",
    "hot-hook": {
      "boundaries": ["./src/controllers/**/*"]
    }
  }
  ```

## 0.1.10

### Patch Changes

- c26292d: Don't throw when a dependent file node is missing. This can happen when a file has been deleted

## 0.1.9

### Patch Changes

- Republishing packages since I forgot to build them before publishing the last release :D

## 0.1.8

### Patch Changes

- 3259e0e: Move from 'hot-hook' to hotHook in package.json configuration

## 0.1.7

### Patch Changes

- fa6ed2e: This PR adds a new way of configuring hot-hook. This allows you to configure hot-hook without having to modify your codebase.

  We introduce a new `hot-hook/register` entrypoint that can be used with Node.JS's `--import` flag. By using this method, the Hot Hook hook will be loaded at application startup without you needing to use `hot.init` in your codebase. It can be used as follows:

  ```bash
  node --import=hot-hook/register ./src/index.js
  ```

  Be careful if you also use a loader to transpile to TS (`ts-node` or `tsx`), hot-hook must be placed in the second position, after the TS loader :

  ```bash
  node --import=tsx --import=hot-hook/register ./src/index.ts
  ```

  To configure boundaries and other files, you'll need to use your application's `package.json` file, in the `hot-hook` key. For example:

  ```jsonc
  // package.json
  {
    "hotHook": {
      "boundaries": ["./src/controllers/**/*.tsx"],
    },
  }
  ```
