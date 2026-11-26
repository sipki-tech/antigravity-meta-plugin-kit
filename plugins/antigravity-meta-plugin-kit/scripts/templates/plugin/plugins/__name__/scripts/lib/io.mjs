// Shared stdin/stdout plumbing for Antigravity lifecycle hook handlers.
// Contract: hooks are fail-open — any internal error must resolve to a safe
// allow/silent JSON response with exit code 0, never break the host session.
// Follows the official Antigravity 1.5.x camelCase protojson wire contracts.
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

// --- Main-module guard (symlink & macOS /tmp -> /private/tmp safe) ---
export function isMainModule(metaUrl, argv1 = process.argv[1]) {
  if (!argv1) return false;
  try {
    return metaUrl === pathToFileURL(realpathSync(argv1)).href;
  } catch {
    return false;
  }
}

// --- PreToolUse responses ---
export const ALLOW = { decision: "allow" };

// Empty object = successful silent no-op (PostToolUse, SessionStart,
// PreInvocation, PostInvocation).
export const SILENT = {};

export function denyResponse(reason) {
  return { decision: "deny", reason };
}

export function askResponse(reason, permissionOverrides) {
  return {
    decision: "ask",
    ...(reason ? { reason } : {}),
    ...(Array.isArray(permissionOverrides) && permissionOverrides.length > 0
      ? { permissionOverrides }
      : {}),
  };
}

export function forceAskResponse(reason, permissionOverrides) {
  return {
    decision: "force_ask",
    ...(reason ? { reason } : {}),
    ...(Array.isArray(permissionOverrides) && permissionOverrides.length > 0
      ? { permissionOverrides }
      : {}),
  };
}

// Shallow top-level merge into toolCall.args before execution (verified live
// on agy 1.5.17/1.5.18).
export function overwriteResponse(overwrite, reason) {
  return {
    decision: "allow",
    overwrite,
    ...(reason ? { reason } : {}),
  };
}

// --- SessionStart / PreInvocation / PostInvocation responses ---
// Canonical systemMessage step (nested object; replaces deprecated
// ephemeralMessage). Set userMarkdown to render inline markdown for the user
// without sending it to the model.
export function systemMessageResponse(text, { userMarkdown } = {}) {
  return {
    injectSteps: [
      {
        systemMessage: {
          systemMessage: String(text ?? ""),
          ...(userMarkdown ? { metadata: { user_markdown: String(userMarkdown) } } : {}),
        },
      },
    ],
  };
}

export function injectResponse(text) {
  return { injectSteps: [{ userMessage: String(text ?? "") }] };
}

// Shows an error to the user without sending it to the model and halts the
// turn before/after invocation (PreInvocation / PostInvocation).
export function errorTerminateResponse(userMessage) {
  return {
    injectSteps: [{ errorMessage: { userMessage: String(userMessage ?? "") } }],
    terminationBehavior: "terminate",
  };
}

// Re-enters the execution loop from PostInvocation.
export function forceContinueResponse(injectSteps = []) {
  return { injectSteps, terminationBehavior: "force_continue" };
}

// --- Stop responses ---
export const STOP_ALLOW = { decision: "" };

export function continueStopResponse(reason) {
  return { decision: "continue", reason };
}

// Loop-prevention guard for Stop hooks. On agy 1.5.17+, live probes observed
// `continuationActive` staying false on `executionNum > 0`, so check BOTH.
export function isStopContinuation(input) {
  return Boolean(
    input?.continuationActive ||
      (typeof input?.executionNum === "number" && input.executionNum > 0),
  );
}

// --- Stdin / Stdout transport ---
export async function readStdinJson(timeoutMs = 3000) {
  if (process.stdin.readableEnded) return {};
  const chunks = [];
  const raw = await new Promise((resolve) => {
    let settled = false;
    const onData = (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(String(c)));
    const cleanup = () => {
      process.stdin.off("data", onData);
      process.stdin.off("end", onEnd);
      process.stdin.off("error", onEnd);
      process.stdin.pause();
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cleanup();
      resolve(Buffer.concat(chunks).toString("utf8"));
    };
    const onEnd = () => finish();
    const timer = setTimeout(finish, timeoutMs);
    timer.unref?.();
    process.stdin.on("data", onData);
    process.stdin.on("end", onEnd);
    process.stdin.on("error", onEnd);
  });
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

export function safeSerialize(payload, fallback = SILENT) {
  try {
    const json = JSON.stringify(payload);
    if (typeof json === "string") return json;
  } catch {}
  try {
    const fb = JSON.stringify(fallback);
    if (typeof fb === "string") return fb;
  } catch {}
  return "{}";
}

export function respond(payload, onFlushed, fallback = SILENT) {
  const line = safeSerialize(payload, fallback) + "\n";
  if (typeof onFlushed === "function") {
    process.stdout.write(line, onFlushed);
  } else {
    process.stdout.write(line);
  }
}

export async function runHook(handler, fallback = ALLOW) {
  let out = null;
  try {
    const input = await readStdinJson();
    out = await handler(input);
  } catch {
    out = null;
  }
  respond(out ?? fallback, () => process.exit(0), fallback);
}

// --- Input adapters (official agy 1.5.17+ camelCase fields first) ---

export function hookEventNameOf(input) {
  return typeof input?.hookEventName === "string" ? input.hookEventName : "";
}

export function toolCallIdOf(input) {
  return typeof input?.toolCall?.id === "string" ? input.toolCall.id : "";
}

export function commandLineOf(input) {
  const args = input?.toolCall?.args ?? input?.args ?? {};
  return args.CommandLine ?? args.commandLine ?? args.command ?? args.cmd ?? "";
}

export function promptTextOf(input) {
  const direct =
    input?.lastUserInput ??
    input?.prompt ??
    input?.userPrompt ??
    input?.userMessage ??
    input?.message ??
    input?.input;
  if (typeof direct === "string") return direct;
  const steps = input?.steps;
  if (Array.isArray(steps)) {
    for (let i = steps.length - 1; i >= 0; i--) {
      if (typeof steps[i]?.userMessage === "string") return steps[i].userMessage;
    }
  }
  return "";
}

export function transcriptPathOf(input) {
  return typeof input?.transcriptPath === "string" ? input.transcriptPath : "";
}

// Agent working directory (distinct from the hook process cwd, which is the
// plugin directory containing hooks.json).
export function cwdOf(input) {
  if (typeof input?.cwd === "string" && input.cwd) return input.cwd;
  const ws = input?.workspacePaths;
  if (Array.isArray(ws) && typeof ws[0] === "string") return ws[0];
  return input?.workingDirectory ?? input?.workspace ?? process.cwd();
}

export function editedFileOf(input) {
  const args = input?.toolCall?.args ?? input?.args ?? {};
  return (
    args.Path ??
    args.TargetFile ??
    args.FilePath ??
    args.filePath ??
    args.file_path ??
    args.path ??
    ""
  );
}
