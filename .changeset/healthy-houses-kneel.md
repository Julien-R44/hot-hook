---
"hot-hook": minor
---

From this commit, if you are using `--import=hot-hook/register` for using hot-hook, the `package.json` will be used for resolving glob patterns in the `boundaries` config. 

That means, if you had a `package.json` with the following content, and a root entrypoint in `./src/start.ts`, glob patterns were resolved from `./src/start.ts` file :

```json
{
  "name": "my-package",
  "version": "1.0.0",
  "hot-hook": {
    "boundaries": [
      "./controllers/**/*",
    ]
  }
}
```

This configuration was matching all files in the `./src/controllers` directory. To achieve the same result, you should now use the following configuration:

```json
{
  "name": "my-package",
  "version": "1.0.0",
  "hot-hook": {
    "boundaries": [
      "./src/controllers/**/*",
    ]
  }
}
```
