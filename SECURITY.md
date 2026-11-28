# Security Policy

## Supported Versions

Security fixes are applied to the latest minor release on `main`:

| Version | Supported |
| --- | --- |
| `0.6.x` | Yes |
| `< 0.6.0` | No |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report vulnerabilities privately through GitHub Security Advisories:

- https://github.com/sipki-tech/antigravity-meta-plugin-kit/security/advisories/new

Include:

- A clear description of the issue and affected files or CLI commands.
- Minimal reproduction steps or a proof of concept.
- Potential security impact and any suggested remediation.

### Response Expectations

- Acknowledgement within **72 hours**.
- Triage and remediation timeline once confirmed, followed by a coordinated fix release.

## Security Model

- Zero external runtime dependencies (Node.js `>= 20` built-ins only).
- All scripts operate locally and never transmit credentials or user telemetry.
- Generated hook templates fail open and never log raw secrets.
