---
name: meta-audit
description: Run mechanical validation (meta-kit lint --strict + agy plugin validate --strict --json) followed by a read-only semantic audit via the meta-payload-auditor subagent.
disable-model-invocation: true
---
# /meta-audit — full mechanical + semantic plugin audit

1. Run both mechanical gates and collect the full file list first (where `$KIT` is `~/.gemini/config/plugins/antigravity-meta-plugin-kit`, or `./plugins/antigravity-meta-plugin-kit` inside a checkout):
   - `node "$KIT/scripts/meta-kit.mjs" lint --strict <target>`
   - `agy plugin validate --strict --json <payload>`
   - `find "<payload>" -maxdepth 4 -not -path '*/.git*' -type f | sort`
   Record the exact verdicts, component counts, and complete file tree.
2. Invoke the `meta-payload-auditor` subagent via `invoke_subagent`, passing the user's request, target payload path, complete file list (required because `meta-payload-auditor` is read-only with `tools: [read_file]` and has no directory-listing tool), and mechanical verdicts verbatim.
3. Relay its `BLOCKER / WARN / NIT` findings and verdict without softening; add nothing the auditor did not report.
