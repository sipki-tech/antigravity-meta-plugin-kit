---
description: Design an Antigravity hook — pick the right lifecycle event, produce the hooks.json block, a fail-open script, and tests
---

1. Restate the user's intent as one of: gate a tool, observe results, inject context, keep the session working, block a premature stop.
2. Spawn the `meta-hook-smith` subagent; pass the intent and any constraints verbatim.
3. Present the returned event choice, hooks.json block, script, and tests; apply them to the repository only after the user agrees.
