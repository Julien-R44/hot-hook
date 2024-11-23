---
'hot-hook': patch
---

See https://github.com/tailwindlabs/tailwindcss/discussions/15105

Sometimes in the resolve hook, we receive a parentUrl that is just `data:`. I didn't really understand
why yet, for now we just ignore these cases and that seems to fix the issue with Tailwind V4.

