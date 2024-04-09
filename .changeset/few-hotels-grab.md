---
"hot-hook": patch
---

This PR adds a new way of configuring hot-hook. This allows you to configure hot-hook without having to modify your codebase. 

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
  "hot-hook": {
    "boundaries": [
      "./src/controllers/**/*.tsx"
    ]
  }
}
```