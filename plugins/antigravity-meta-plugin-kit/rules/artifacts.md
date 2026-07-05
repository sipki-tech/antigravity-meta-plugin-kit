# Artifact conventions

Quality bar for implementation plans and walkthroughs, on top of the
built-in Planning Mode format.

- Every implementation plan's "Verification Plan" section lists the exact
  commands to run (test runner, linters, validators) — not "run the tests".
- A plan proposing risky or hard-to-reverse changes (migrations, deletions,
  wire-format changes) ends with a "## Rollback" section: how to undo.
- When touching an Antigravity plugin payload, the Verification Plan
  includes both validators: this kit's `lint` and `agy plugin validate`.
- Finish substantial work by creating or updating `walkthrough.md`
  (changes made, what was tested, validation results). Update the existing
  walkthrough on follow-ups instead of creating a new one.
- No plan and no walkthrough for trivial one-off tweaks — artifact noise
  buries the artifacts that matter.
