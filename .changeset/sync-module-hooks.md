---
'hot-hook': minor
---

Use synchronous `module.registerHooks()` on Node.js >= 22.22.3, 24.11.1, 25.1.0 and 26 instead of the deprecated `module.register()` (DEP0205). Older Node.js versions fall back to `module.register()`, since their `registerHooks()` breaks CommonJS loading when combined with `module.register()` hooks such as ts-node's.

With in-thread hooks, `require()` calls also go through hot-hook.
