---
"@hot-hook/dump-viewer": patch
"hot-hook": patch
"@hot-hook/runner": patch
---

Add support for Node.js 20. We removed the direct usage of `importAttributes` that was only introduced in Node.js 20.9. Hot-hook should works fine with Node.js 20.0.0 and above.
