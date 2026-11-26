// Declarative plugin auth validation (`auth.json`).
// Blind spot: `agy plugin validate --strict` does not validate `auth.json` at
// all on agy 1.5.17, so malformed providers or hardcoded secrets pass silently.
import { existsSync } from "node:fs";
import { join } from "node:path";
import { readJsonc } from "../fsutil.mjs";
import { SECRET_KEY_RE, VALID_AUTH_DELIVERIES, VALID_AUTH_TYPES } from "./constants.mjs";
import { isValidHttpsUrl } from "./helpers.mjs";

export function lintAuth(dir, { ok, warn }) {
  const authFile = join(dir, "auth.json");
  if (!existsSync(authFile)) return;

  const parsed = readJsonc(authFile);
  ok(
    "auth.json parses (strict JSON)",
    Boolean(parsed?.strictOk),
    parsed?.strictOk
      ? authFile
      : parsed?.hasJsoncSyntax
        ? "auth.json should be strict JSON (no comments or trailing commas)"
        : parsed?.error ?? authFile,
  );
  if (!parsed?.strictOk) return;

  const doc = parsed.data;
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    ok("auth.json providers valid", false, "auth.json root must be a JSON object");
    return;
  }

  const providers = doc.providers;
  if (
    !providers ||
    typeof providers !== "object" ||
    Array.isArray(providers) ||
    Object.keys(providers).length === 0
  ) {
    ok("auth.json providers valid", false, 'must declare a non-empty "providers" object');
    return;
  }

  const bad = [];
  for (const [id, spec] of Object.entries(providers)) {
    if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
      bad.push(`providers.${id}: must be an object`);
      continue;
    }

    if (typeof spec.type !== "string" || !spec.type.trim()) {
      bad.push(`providers.${id}: missing "type"`);
    } else if (!VALID_AUTH_TYPES.has(spec.type)) {
      warn(
        `auth.json unknown provider type "${spec.type}"`,
        `providers.${id}: expected one of ${[...VALID_AUTH_TYPES].join(", ")}`,
      );
    }

    if (spec.type === "oauth2") {
      const o = spec.oauth2;
      if (!o || typeof o !== "object" || Array.isArray(o)) {
        bad.push(`providers.${id}: type="oauth2" requires an "oauth2" object`);
      } else {
        if (!isValidHttpsUrl(o.authorizeUrl)) {
          bad.push(`providers.${id}.oauth2.authorizeUrl must be a valid https:// URL`);
        }
        if (!isValidHttpsUrl(o.tokenUrl)) {
          bad.push(`providers.${id}.oauth2.tokenUrl must be a valid https:// URL`);
        }
        if (typeof o.clientId !== "string" || !o.clientId.trim()) {
          bad.push(`providers.${id}.oauth2.clientId must be a non-empty string`);
        }
        if (!Array.isArray(o.scopes) || o.scopes.some((s) => typeof s !== "string" || !s.trim())) {
          bad.push(`providers.${id}.oauth2.scopes must be a string[]`);
        }
      }
    }

    if (spec.delivery !== undefined) {
      if (typeof spec.delivery !== "string" || !VALID_AUTH_DELIVERIES.has(spec.delivery)) {
        warn(
          `auth.json unknown delivery "${spec.delivery}"`,
          `providers.${id}: expected one of ${[...VALID_AUTH_DELIVERIES].join(", ")}`,
        );
      }
    }

    if (spec.delivery === "env") {
      if (
        !spec.env ||
        typeof spec.env !== "object" ||
        Array.isArray(spec.env) ||
        Object.keys(spec.env).length === 0
      ) {
        bad.push(`providers.${id}: delivery="env" requires a non-empty "env" object`);
      }
    }

    if (spec.env && typeof spec.env === "object" && !Array.isArray(spec.env)) {
      for (const [ek, ev] of Object.entries(spec.env)) {
        if (typeof ev !== "string") {
          bad.push(`providers.${id}.env.${ek}: value must be a string placeholder`);
          continue;
        }
        if (
          SECRET_KEY_RE.test(ek) &&
          ev.length >= 16 &&
          !/\{[^}]+\}/.test(ev) &&
          !/^(?:TODO|YOUR_|REPLACE_|<)/i.test(ev)
        ) {
          warn(
            `auth.json possible hardcoded secret in providers.${id}.env.${ek}`,
            `use a placeholder like "{api_key}" or "{access_token}" instead of a literal secret`,
          );
        }
      }
    }

    if (
      spec.domains !== undefined &&
      (!Array.isArray(spec.domains) || spec.domains.some((d) => typeof d !== "string" || !d.trim()))
    ) {
      bad.push(`providers.${id}.domains must be a string[]`);
    }
    if (
      spec.clis !== undefined &&
      (!Array.isArray(spec.clis) || spec.clis.some((c) => typeof c !== "string" || !c.trim()))
    ) {
      bad.push(`providers.${id}.clis must be a string[]`);
    }

    if (spec.identity !== undefined) {
      if (!spec.identity || typeof spec.identity !== "object" || Array.isArray(spec.identity)) {
        bad.push(`providers.${id}.identity must be an object`);
      } else {
        if (!isValidHttpsUrl(spec.identity.url)) {
          bad.push(`providers.${id}.identity.url must be a valid https:// URL`);
        }
        if (typeof spec.identity.jsonPath !== "string" || !spec.identity.jsonPath.trim()) {
          bad.push(`providers.${id}.identity.jsonPath must be a non-empty string`);
        }
      }
    }
  }

  ok(
    "auth.json providers valid",
    bad.length === 0,
    bad.join("; ") || `${Object.keys(providers).length} provider(s)`,
  );
}
