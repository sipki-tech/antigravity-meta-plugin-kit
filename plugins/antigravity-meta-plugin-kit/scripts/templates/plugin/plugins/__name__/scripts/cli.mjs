#!/usr/bin/env node
// Self-contained zero-dependency CLI for {{displayName}} (Google Workspace
// plugin pattern: bundled CLI + auth.json + SKILL.md instead of heavy MCP).
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const HELP = `usage: node ./scripts/cli.mjs <command> [--json]

  status     report CLI readiness and whether {{ENV_PREFIX}}_API_KEY is configured
  ping       verify local CLI wiring (returns JSON when --json is passed)`;

export function runCommand(argv = process.argv.slice(2), env = process.env) {
  const wantsJson = argv.includes("--json");
  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        json: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    }));
  } catch (err) {
    const message = err?.message ?? "invalid arguments";
    return {
      status: 1,
      stdout: wantsJson
        ? JSON.stringify({ ok: false, error: message }, null, 2) + "\n"
        : `error: ${message}\n${HELP}\n`,
    };
  }

  if (values.help || positionals.length === 0) {
    return { status: 0, stdout: HELP + "\n" };
  }

  const cmd = positionals[0];
  const hasToken = Boolean(env.{{ENV_PREFIX}}_API_KEY && env.{{ENV_PREFIX}}_API_KEY.trim());

  if (cmd === "ping") {
    const payload = { ok: true, plugin: "{{name}}", authConfigured: hasToken };
    return {
      status: 0,
      stdout: values.json
        ? JSON.stringify(payload, null, 2) + "\n"
        : `ok (${payload.plugin}, auth=${hasToken ? "configured" : "missing"})\n`,
    };
  }

  if (cmd === "status") {
    if (!hasToken) {
      const err = {
        ok: false,
        error: "{{ENV_PREFIX}}_API_KEY is not set (configure via auth.json or env)",
      };
      return {
        status: 1,
        stdout: values.json ? JSON.stringify(err, null, 2) + "\n" : `error: ${err.error}\n`,
      };
    }
    const payload = { ok: true, plugin: "{{name}}", authConfigured: true };
    return {
      status: 0,
      stdout: values.json
        ? JSON.stringify(payload, null, 2) + "\n"
        : `ready (${payload.plugin})\n`,
    };
  }

  const unknown = `unknown command: ${cmd}`;
  return {
    status: 1,
    stdout: values.json
      ? JSON.stringify({ ok: false, error: unknown }, null, 2) + "\n"
      : `${unknown}\n${HELP}\n`,
  };
}

function isMain() {
  if (!process.argv[1]) return false;
  try {
    return import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href;
  } catch {
    return false;
  }
}

if (isMain()) {
  const res = runCommand();
  process.stdout.write(res.stdout);
  process.exit(res.status);
}
