---
'hot-hook': patch
---

Only inject the `import.meta.hot` helpers into modules that reference `import.meta.hot`. Other modules, including `node_modules` dependencies, are now loaded unchanged, so their first-line columns and source maps are no longer shifted by the injected code. See #15.

If you need hot-hook in a module without the injection, import it directly: `import { hot } from 'hot-hook'`, then call `hot.dispose(import.meta.url, callback)` or `hot.decline(import.meta.url)`.

Modules that only access `import.meta.hot` indirectly (for example `const meta = import.meta; meta.hot`) no longer get it.
