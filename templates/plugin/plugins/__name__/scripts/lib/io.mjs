// Shared stdin/stdout plumbing for hook handlers.
// Contract: hooks are fail-open — any internal error must resolve to an
// "allow" response with exit code 0, never break the host session.

export const ALLOW = { allow_tool: true };

// Empty object = successful no-op hook result (per Antigravity semantics).
export const SILENT = {};

// Context-injection wire format used by PreInvocation hooks (verified
// against antigravity-swarm's production hook).
export function injectResponse(text) {
  return { injectSteps: [{ userMessage: text }] };
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
