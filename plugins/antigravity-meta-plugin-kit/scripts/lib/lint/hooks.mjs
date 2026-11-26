// Lifecycle hooks validation (`hooks.json` + fail-open & runtime trap checks).
import { readFileSync } from "node:fs";
import { extname, join } from "node:path";
import { readJsonc } from "../fsutil.mjs";
import {
  CLAUDE_TOOL_NAMES,
  GROUPED_EVENTS,
  KNOWN_EVENTS,
  MAX_HOOK_TIMEOUT,
} from "./constants.mjs";
import {
  isFailOpen,
  isFile,
  resolveInside,
  scriptPathOf,
  stripJsComments,
  usesPluginRoot,
} from "./helpers.mjs";

export function flattenHooks(hooksDoc) {
  const leaves = [];
  const problems = [];
  const shapeWarnings = [];
  const unknownEvents = [];
  let namedHooks = 0;
  let claudeWrapper = false;
  let allDisabled = true;

  if (!hooksDoc || typeof hooksDoc !== "object" || Array.isArray(hooksDoc)) {
    return {
      leaves,
      problems: ["hooks.json must be an object of named hooks"],
      shapeWarnings,
      unknownEvents,
      namedHooks,
      claudeWrapper,
      allDisabled: false,
    };
  }

  for (const [hookName, spec] of Object.entries(hooksDoc)) {
    if (hookName === "hooks") claudeWrapper = true;
    if (KNOWN_EVENTS.includes(hookName)) {
      problems.push(
        `top-level key '${hookName}' is an event name — top-level keys must be named hook groups`,
      );
      continue;
    }
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      problems.push(`hook '${hookName}': expected an object of events`);
      continue;
    }
    namedHooks += 1;
    if (spec.enabled !== undefined && typeof spec.enabled !== "boolean") {
      problems.push(`hook '${hookName}': 'enabled' must be a boolean`);
    }
    if (spec.enabled !== false) allDisabled = false;

    for (const [event, entries] of Object.entries(spec)) {
      if (event === "enabled") continue;
      if (!KNOWN_EVENTS.includes(event)) {
        unknownEvents.push(`${hookName}.${event}`);
        continue;
      }
      if (!Array.isArray(entries)) {
        problems.push(`${hookName}.${event}: expected an array`);
        continue;
      }
      for (const entry of entries) {
        if (Array.isArray(entry?.hooks)) {
          if (!GROUPED_EVENTS.has(event)) {
            problems.push(
              `${hookName}.${event}: matcher group on flat event (agy rejects matcher groups on ${event})`,
            );
            continue;
          }
          for (const hook of entry.hooks) {
            leaves.push({
              hookName,
              event,
              matcher: entry.matcher ?? null,
              hook,
              enabled: spec.enabled !== false,
            });
          }
        } else {
          if (GROUPED_EVENTS.has(event)) {
            shapeWarnings.push(
              `${hookName}.${event}: flat handler on grouped event — must be {matcher, hooks: [...]} (flat handlers never run)`,
            );
          }
          leaves.push({
            hookName,
            event,
            matcher: null,
            hook: entry,
            enabled: spec.enabled !== false,
          });
        }
      }
    }
  }
  return {
    leaves,
    problems,
    shapeWarnings,
    unknownEvents,
    namedHooks,
    claudeWrapper,
    allDisabled: namedHooks > 0 && allDisabled,
  };
}

export function lintHooks(dir, { ok, warn, info }) {
  const rootFile = join(dir, "hooks.json");
  const legacyFile = join(dir, "hooks", "hooks.json");
  const hasRoot = isFile(rootFile);
  const hasLegacy = isFile(legacyFile);
  if (!hasRoot && !hasLegacy) return;

  if (hasLegacy && !hasRoot) {
    warn(
      "hooks.json not at plugin root",
      "hooks/hooks.json is never loaded in native plugins — move it to <plugin>/hooks.json",
    );
  } else if (hasRoot && hasLegacy) {
    warn(
      "duplicate hooks/hooks.json",
      "hooks/hooks.json is ignored when root hooks.json exists — remove hooks/hooks.json",
    );
  }

  const hooksFile = hasRoot ? rootFile : legacyFile;
  const parsed = readJsonc(hooksFile);
  ok(
    "hooks.json parses (strict JSON)",
    Boolean(parsed?.strictOk),
    parsed?.strictOk
      ? hooksFile
      : parsed?.hasJsoncSyntax
        ? "hooks.json does not allow JSONC comments or trailing commas"
        : parsed?.error ?? hooksFile,
  );
  if (!parsed?.strictOk) return;

  const {
    leaves,
    problems,
    shapeWarnings,
    unknownEvents,
    namedHooks,
    claudeWrapper,
    allDisabled,
  } = flattenHooks(parsed.data);

  if (claudeWrapper) {
    info("hooks.json top-level key 'hooks'", "loads as a single named hook group called 'hooks'");
  }

  ok(
    "hooks.json declares named hooks",
    problems.length === 0 && namedHooks > 0,
    problems.join("; ") || `${namedHooks} named hook group(s)`,
  );

  const promptHooks = leaves.filter((l) => l.hook?.type === "prompt");
  const otherBadHandlers = leaves.filter(
    (l) =>
      l.hook?.type !== "prompt" &&
      (typeof l.hook?.command !== "string" ||
        !l.hook.command.trim() ||
        (l.hook.type !== undefined && l.hook.type !== "command")),
  );
  const badParts = [];
  if (promptHooks.length > 0) {
    badParts.push(
      `${promptHooks.map((l) => `${l.hookName}.${l.event}`).join(", ")}: type="prompt" passes agy --strict but fails every tool call at runtime ("prompt hooks are not currently supported")`,
    );
  }
  if (otherBadHandlers.length > 0) {
    badParts.push(
      `malformed command handler(s): ${otherBadHandlers.map((l) => `${l.hookName}.${l.event}`).join(", ")}`,
    );
  }
  ok(
    "hook entries well-formed",
    (leaves.length > 0 || allDisabled) && badParts.length === 0,
    badParts.length > 0
      ? badParts.join("; ")
      : leaves.length === 0
        ? "no handlers found"
        : `${leaves.length} command handler(s)`,
  );

  const badMatchers = [];
  for (const l of leaves) {
    if (l.matcher && l.matcher !== "*") {
      try {
        new RegExp(l.matcher);
      } catch {
        badMatchers.push(`${l.hookName}.${l.event}: invalid regex "${l.matcher}"`);
      }
      for (const token of l.matcher.split("|").map((t) => t.trim())) {
        if (CLAUDE_TOOL_NAMES.has(token)) {
          warn(
            "hook matcher uses non-Antigravity tool name",
            `${l.hookName}.${l.event}: "${token}" is not an Antigravity tool name (use run_command, read_file, edit_file, write_file)`,
          );
        }
      }
    }
  }
  ok("hook matchers valid regex", badMatchers.length === 0, badMatchers.join("; ") || "ok");

  const malformedTimeouts = leaves.filter(
    (l) =>
      l.hook?.timeout !== undefined &&
      (typeof l.hook.timeout !== "number" || !Number.isInteger(l.hook.timeout) || l.hook.timeout <= 0),
  );
  ok(
    "hook timeouts sane",
    malformedTimeouts.length === 0,
    malformedTimeouts
      .map((l) => `${l.hookName}.${l.event}: timeout=${l.hook?.timeout}`)
      .join(", ") || "explicit 10-15s recommended",
  );
  for (const l of leaves) {
    if (l.hook?.timeout === undefined) {
      warn(
        "hook timeout missing",
        `${l.hookName}.${l.event}: default is 30s of synchronous blocking — set 10-15s explicitly`,
      );
    } else if (l.hook.timeout > MAX_HOOK_TIMEOUT) {
      warn(
        "hook timeout above 30s",
        `${l.hookName}.${l.event}: timeout=${l.hook.timeout} blocks the agent loop`,
      );
    }
  }

  for (const ue of unknownEvents) {
    warn("unknown hook event", `${ue} — known events: ${KNOWN_EVENTS.join(", ")}`);
  }
  for (const sw of shapeWarnings) warn("hook entry shape", sw);

  const missingScripts = [];
  const notFailOpen = [];
  const inspectedScripts = new Set();

  for (const l of leaves) {
    if (usesPluginRoot(l.hook?.command)) {
      warn(
        "hook command uses PLUGIN_ROOT variable",
        `${l.hookName}.${l.event}: fails \`agy plugin validate --strict\` — hooks run with cwd = plugin root, so use ./scripts/x.mjs (use $PLUGIN_DATA for persistent data)`,
      );
    }
    const rel = scriptPathOf(l.hook?.command);
    if (!rel) continue;
    const checked = resolveInside(dir, rel);
    if (!checked.ok) {
      warn("hook script path escapes plugin root", `${l.hookName}.${l.event}: ${rel} (${checked.reason})`);
      continue;
    }
    const scriptFile = checked.path;
    if (!isFile(scriptFile)) {
      missingScripts.push(rel);
      continue;
    }
    const ext = extname(rel).toLowerCase();
    const src = readFileSync(scriptFile, "utf8");
    if ([".mjs", ".js", ".cjs", ".sh", ".bash", ".py"].includes(ext)) {
      if (!isFailOpen(src, ext)) notFailOpen.push(rel);
    }

    const key = `${l.event}:${rel}`;
    if (!inspectedScripts.has(key) && [".mjs", ".js", ".cjs"].includes(ext)) {
      inspectedScripts.add(key);
      const code = stripJsComments(src);
      if (/["']model_stop["']/.test(code)) {
        warn(
          "hook uses obsolete terminationReason 'model_stop'",
          `${rel}: agy 1.5.17 sends "NO_TOOL_CALL" (model_stop never matches)`,
        );
      }
      if (/\bephemeralMessage\b/.test(code)) {
        warn(
          "hook uses deprecated ephemeralMessage",
          `${rel}: use nested systemMessage: { systemMessage: "..." }`,
        );
      }
      if (/\binjectSteps\b/.test(code) && /\btoolCall\b/.test(code) && /\{\s*toolCall\s*:/.test(code)) {
        warn(
          "hook injects toolCall step",
          `${rel}: injectSteps[{toolCall}] crashes the turn with exit 3 in agy 1.5.17`,
        );
      }
      if (
        l.event === "Stop" &&
        (/["']continue["']/.test(code) || /\bcontinueStopResponse\s*\(/.test(code)) &&
        !/\b(?:continuationActive|executionNum|isStopContinuation)\b/.test(code)
      ) {
        warn(
          "Stop hook missing continuation loop guard",
          `${rel}: check isStopContinuation(input) (continuationActive || executionNum > 0) to prevent infinite loops`,
        );
      }
    }
  }

  ok(
    "hook scripts exist",
    missingScripts.length === 0,
    missingScripts.join(", ") || "all plugin-local script refs resolve",
  );
  ok(
    "hook scripts fail-open",
    notFailOpen.length === 0,
    notFailOpen.join(", ") || "heuristic: runHook() wrapper or try/catch",
  );
}
