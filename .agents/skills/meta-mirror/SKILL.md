---
name: meta-mirror
description: Mirror changed bilingual EN/RU documentation in this repository section for section, keeping code blocks untouched.
disable-model-invocation: true
---
# meta-mirror — keep EN/RU docs in lockstep

1. Identify changed documentation files (`git status` / `git diff` for `README.md`, `README.ru.md`, and `docs/guides/*.md`).
2. Invoke the `meta-doc-mirror` subagent with the exact list of changed source files.
3. Run `node --test test/docs-parity.test.mjs` to confirm heading parity and internal `.ru.md` links, then show the diff to the user.
