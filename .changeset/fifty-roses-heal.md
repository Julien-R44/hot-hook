---
"hot-hook": patch
---

`--import=hot-hook/register` was broken due to a bug in path handling that wasn't cross platform. This has been fixed and also added a Windows CI to prevent this from happening again.

