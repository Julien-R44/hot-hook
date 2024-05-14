---
"hot-hook": patch
---

[Vite has a bug](https://github.com/vitejs/vite/issues/13267) that causes a `vite.config.js.timestamp-*` file to be created and persisted under certain conditions. When Hot-Hook is used with Vite, this bug can sometimes cause the server to restart indefinitely. Consequently, this commit adds these files by default to Hot-Hook's `ignore` config.
