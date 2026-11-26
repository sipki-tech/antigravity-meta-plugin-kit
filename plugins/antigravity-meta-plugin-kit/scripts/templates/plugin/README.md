<div align="center">

<img src="plugins/{{name}}/assets/logo.svg" width="80" height="80" alt="{{displayName}}" />

# {{displayName}}

[![Google Antigravity](https://img.shields.io/badge/Google_Antigravity-agy_1.5.17%2B-4285F4?style=flat-square&logo=google&logoColor=white)](https://antigravity.google)
[![Node >= 20](https://img.shields.io/badge/Node-%3E%3D20-339933?style=flat-square&logo=nodedotjs&logoColor=white)](package.json)

A native Google Antigravity plugin scaffolded by
[antigravity-meta-plugin-kit](https://github.com/sipki-tech/antigravity-meta-plugin-kit).

</div>

---

TODO: describe what **{{displayName}}** adds to Antigravity in 1–2 crisp sentences.

## Install

Push this repository to GitHub, then install natively via the Antigravity CLI:

```bash
agy plugin install https://github.com/TODO-owner/{{name}}
```

Or install from a local checkout during development:

```bash
agy plugin install plugins/{{name}}
```

Manage natively: `agy plugin list`, `agy plugin disable {{name}}`,
`agy plugin uninstall {{name}}`. For workspace-scoped testing without touching
`~/.gemini/config/plugins/`, copy `plugins/{{name}}` into
`<project>/.agents/plugins/{{name}}/` and run `agy -p "..." --add-dir <project>`.

## Layout

| Piece | Path |
|---|---|
| Plugin payload | `plugins/{{name}}/` |
| Zero-dependency tests (`node:test`) | `test/` |
| CI workflow | `.github/workflows/ci.yml` |

## Development & Verification

```bash
npm test                                                  # unit & wire tests
agy plugin validate --strict --json plugins/{{name}}      # official Antigravity validator
```

To run offline strict checks (runtime blind spots beyond `agy plugin validate`)
and local environment diagnostics via `antigravity-meta-plugin-kit`:

```bash
KIT=~/.gemini/config/plugins/antigravity-meta-plugin-kit
node "$KIT/scripts/meta-kit.mjs" lint --strict .
node "$KIT/scripts/meta-kit.mjs" doctor --workspace .
```
