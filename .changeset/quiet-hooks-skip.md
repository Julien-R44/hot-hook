---
'hot-hook': patch
---

Only inject the `import.meta.hot` helpers into modules that reference `import.meta`. Other modules, including most `node_modules` dependencies, are now loaded unchanged, so their positions and source maps are no longer shifted by the injected code. See #15.

Modules that get the helpers keep exact positions when they have an inline source map, as produced by tsx, ts-node or `@poppinss/ts-exec`: hot-hook now shifts it to account for the injected code.
