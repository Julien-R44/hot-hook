# hot-hook

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
