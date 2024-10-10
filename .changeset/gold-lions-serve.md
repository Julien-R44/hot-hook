---
'hot-hook': patch
---

On some linux distributions, or on some IDE/Text-Editor, only the `unlink` message is received by chokidar when a file is changed/saved. This commit now treats the `unlink` message as a file change, and therefore triggers the HMR/Full-reload logic
