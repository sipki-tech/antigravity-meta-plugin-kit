---
name: meta-scout
description: Check the locally installed Google Antigravity (`agy`) for contract drift against documented plugin specs using probe.mjs and the meta-trap-scout subagent.
disable-model-invocation: true
---
# /meta-scout — detect Antigravity contract drift

1. Run the fast drift probe first (where `$KIT` is `~/.gemini/config/plugins/antigravity-meta-plugin-kit`, or `./plugins/antigravity-meta-plugin-kit` inside a checkout):
   - `node "$KIT/scripts/probe.mjs" --fast` (add `--live` if the user asks for live `agy -p` runtime probes)
2. Invoke the `meta-trap-scout` subagent via `invoke_subagent`, passing the probe output and the user's concern (or "full post-update drift sweep") verbatim.
3. Relay its `DRIFT / CONFIRMED / UNKNOWN` report with quoted evidence intact, and if any `DRIFT` items exist, offer to update `docs/internals.md` and `scripts/lib/lint.mjs`.
