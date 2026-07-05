---
description: Semantic audit of an Antigravity plugin payload — trigger quality, hook-script logic, manifest coherence (beyond mechanical lint)
---

1. Run the mechanical gate first: `npx github:sipki-tech/antigravity-meta-plugin-kit lint <target>` and `agy plugin validate <payload>`; include their verdicts in the final report.
2. Spawn the `meta-payload-auditor` subagent; pass the user's request and the target payload path verbatim.
3. Relay its findings (severity(file:line) → fix) without softening; add nothing the auditor did not report.
