// Shared constants and registries for Google Antigravity plugin linting (agy 1.5.17+).

export const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
export const KEBAB_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SHA256_RE = /^[a-f0-9]{64}$/i;
export const MAX_HOOK_TIMEOUT = 30;
export const MAX_BODY_BYTES = 24000;
export const WARN_BODY_BYTES = 20000;
export const WARN_ALWAYS_ON_LINES = 150;

export const BUILTIN_MCP_COMMANDS = new Set(["node", "npx"]);

export const KNOWN_EVENTS = [
  "SessionStart",
  "PreToolUse",
  "PostToolUse",
  "PreInvocation",
  "PostInvocation",
  "Stop",
];
export const GROUPED_EVENTS = new Set(["PreToolUse", "PostToolUse"]);

export const VALID_MODEL_TIERS = new Set(["inherit", "flash_lite", "flash", "pro"]);
export const VALID_EXEC_POLICIES = new Set(["off", "auto", "eager", "sandbox"]);
export const VALID_RULE_TRIGGERS = new Set([
  "always_on",
  "model_decision",
  "glob",
  "manual",
]);
export const RESERVED_AGENT_NAMES = new Set([
  "self",
  "browser",
  "research",
  "deepagent",
  "review-agent",
  "image-generator",
]);

// Canonical native tool names in agy 1.5.17 (verified via live probes).
export const NATIVE_AGENT_TOOLS = new Set([
  "read_file",
  "edit_file",
  "write_file",
  "run_command",
  "manage_task",
  "search_web",
  "invoke_subagent",
  "define_subagent",
  "manage_subagents",
  "send_message",
  "ask_question",
  "update_steps",
  "schedule",
  "run_workflow",
  "swarm",
  "call_mcp_tool",
  "list_resources",
  "read_resource",
  "generate_image",
]);

export const LEGACY_AGENT_TOOL_ALIASES = {
  grep_search: "silently dropped in agy 1.5.17 (grants 0 search tools) — use run_command",
  view_file: "legacy IDE alias — use read_file",
  replace_file_content: "legacy IDE alias — use edit_file",
  write_to_file: "legacy IDE alias — use write_file",
  find_by_name: "retired in agy 1.2.7 — use run_command",
  list_dir: "retired in agy 1.2.7 — use run_command",
};

export const ALLOWED_MANIFEST_KEYS = new Set([
  "$schema",
  "name",
  "displayName",
  "display_name",
  "description",
  "version",
  "logo",
  "suggestedPrompts",
  "suggested_prompts",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
  "category",
  "disabled",
  "skills",
  "extensions",
  "source",
  "sourcePath",
  "source_path",
]);

export const ALLOWED_LOGO_EXTS = new Set([".png", ".svg", ".jpg", ".jpeg", ".webp"]);
export const GOOGLE_LOGO_DOMAINS = [
  "google.com",
  "gstatic.com",
  "googleusercontent.com",
  "googleplex.com",
];

export const CLAUDE_TOOL_NAMES = new Set([
  "Bash",
  "Read",
  "Write",
  "Edit",
  "MultiEdit",
  "Glob",
  "Grep",
]);

export const ALLOWED_SIDECAR_KEYS = new Set([
  "command",
  "args",
  "builtin",
  "restart_policy",
  "restartPolicy",
  "description",
  "display_name",
  "displayName",
  "disabled",
  "env",
  "has_web_ui",
  "hasWebUi",
  "ui_config",
  "uiConfig",
  "agent_permissions",
  "agentPermissions",
  "arguments",
  "sandbox",
]);
export const VALID_RESTART_POLICIES = new Set(["always", "on-failure", "never"]);

export const VALID_AUTH_TYPES = new Set(["oauth2", "api_key", "bearer", "basic"]);
export const VALID_AUTH_DELIVERIES = new Set(["env", "header", "file"]);

export const SECRET_KEY_RE = /(?:API_KEY|SECRET|TOKEN|PASSWORD|PRIVATE_KEY)$/i;

export const MANIFEST_LOCATIONS = [
  [".antigravity-plugin"],
  [".gemini-plugin"],
  [],
];

export const COMPONENT_NAMES = [
  "skills",
  "rules",
  "agents",
  "hooks.json",
  "mcp_config.json",
  "sidecars",
];
