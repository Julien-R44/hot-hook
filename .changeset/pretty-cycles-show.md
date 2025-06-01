---
'hot-hook': patch
---

## Global watching and file-changed events

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
