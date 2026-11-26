---
name: {{name}}-help
description: Deterministic slash-command wrapper that delegates inspection work to the {{name}}-helper subagent.
disable-model-invocation: true
---
# /{{name}}-help — invoke {{name}}-helper

1. Gather the file path(s) or question from the user's request.
2. Spawn the `{{name}}-helper` subagent via `invoke_subagent`, passing the target paths and intent verbatim.
3. Relay its `send_message` report without omitting findings.
