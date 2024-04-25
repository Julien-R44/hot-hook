---
'hot-hook': patch
---

Bugfix : We should not invalidate non-reloadable files when a reloadable file is changed. That means, we gonna keep fetching the same file from the cache and not increase the version query param. This was not the case until this commit and caused theses issues for example :

- https://github.com/orgs/adonisjs/discussions/4544
- https://github.com/orgs/adonisjs/discussions/4537
