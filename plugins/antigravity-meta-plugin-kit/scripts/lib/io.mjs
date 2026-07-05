// Shared stdin/stdout plumbing for hook handlers.
// Contract: hooks are fail-open — any internal error must resolve to an
// "allow" response with exit code 0, never break the host session.
// Response shapes follow the official 2026-07 hook contracts (CLI 1.0.16
// builtin docs): decision dialect, ephemeral injection. Legacy keys
// (allow_tool/deny_reason) are emitted alongside the official ones until
// pre-2026-07 builds die out; unknown keys are ignored by the host.

export const ALLOW = { decision: "allow", allow_tool: true };

// Empty object = successful no-op hook result (per Antigravity semantics).
export const SILENT = {};

export function denyResponse(reason) {
  return { decision: "deny", reason, allow_tool: false, deny_reason: reason };
}

// Context-injection wire formats used by PreInvocation/PostInvocation hooks.
export function injectResponse(text) {
  return { injectSteps: [{ userMessage: text }] };
}

// Transient system message — does not persist in the conversation history.
export function ephemeralResponse(text) {
  return { injectSteps: [{ ephemeralMessage: text }] };
}

export async function readStdinJson(timeoutMs = 3000) {
  const chunks = [];
  const raw = await new Promise((resolve) => {
    const finish = () => resolve(Buffer.concat(chunks).toString("utf8"));
    const timer = setTimeout(finish, timeoutMs);
    timer.unref?.();
    process.stdin.on("data", (c) => chunks.push(c));
    process.stdin.on("end", () => {
      clearTimeout(timer);
      finish();
    });
    process.stdin.on("error", () => {
      clearTimeout(timer);
      finish();
    });
  });
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return { _raw: raw };
  }
}

export function respond(payload) {
  process.stdout.write(JSON.stringify(payload) + "\n");
}

export async function runHook(handler, fallback = ALLOW) {
  let out = null;
  try {
    const input = await readStdinJson();
    out = await handler(input);
  } catch {
    out = null;
  }
  respond(out ?? fallback);
  process.exit(0);
}

// Input shapes vary across preview builds; probe the known variants.

export function commandLineOf(input) {
  const args =
    input?.toolCall?.args ?? input?.tool_call?.args ?? input?.args ?? {};
  return (
    args.CommandLine ?? args.commandLine ?? args.command ?? args.cmd ?? ""
  );
}

export function promptTextOf(input) {
  const direct =
    input?.prompt ??
    input?.userPrompt ??
    input?.user_prompt ??
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
  const messages = input?.messages;
  if (Array.isArray(messages)) {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m?.role === "user" && typeof m.content === "string") return m.content;
    }
  }
  return "";
}

export function transcriptPathOf(input) {
  return typeof input?.transcriptPath === "string" ? input.transcriptPath : "";
}

export function cwdOf(input) {
  const ws = input?.workspacePaths;
  if (Array.isArray(ws) && typeof ws[0] === "string") return ws[0];
  return (
    input?.cwd ??
    input?.workingDirectory ??
    input?.working_directory ??
    input?.workspace ??
    process.cwd()
  );
}

export function editedFileOf(input) {
  const args =
    input?.toolCall?.args ?? input?.tool_call?.args ?? input?.args ?? {};
  return (
    args.TargetFile ??
    args.FilePath ??
    args.file_path ??
    args.filePath ??
    args.path ??
    ""
  );
}
