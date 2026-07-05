---
description: Mirror changed bilingual docs — regenerate the RU (or EN) counterpart section for section, code blocks untouched
---

1. Determine which documents changed (git status/diff for `*.md` with a language sibling).
2. Spawn the `meta-doc-mirror` subagent; pass the list of changed source files verbatim.
3. Verify its parity report (matching section counts per file) and show the diff of the mirrored files to the user.
