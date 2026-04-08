/** Patterns for credential *references* only (never inline secrets). */
const KEYS_REF_PREFIX = "ref:restormel-keys:";
const ENV_REF_PREFIX = "env:";

export function looksLikeInlineSecret(value: string): boolean {
  if (value.length > 4096) return true;
  if (/\bsk-[a-zA-Z0-9]{16,}\b/.test(value)) return true;
  if (/\bBearer\s+[a-zA-Z0-9._-]{20,}\b/i.test(value)) return true;
  if (/\bAIza[0-9A-Za-z_-]{20,}\b/.test(value)) return true;
  return false;
}

export function isOpaqueKeyRef(value: string): boolean {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return false;
  if (value.includes("\n") || value.includes("\r")) return false;
  if (looksLikeInlineSecret(value)) return false;

  if (value.startsWith(KEYS_REF_PREFIX) && value.length > KEYS_REF_PREFIX.length) {
    return true;
  }
  if (value.startsWith(ENV_REF_PREFIX)) {
    const rest = value.slice(ENV_REF_PREFIX.length);
    return /^[A-Z][A-Z0-9_]*$/.test(rest);
  }
  return false;
}

export function isSafeHttpUrl(value: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "Invalid URL" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "Only http(s) URLs are allowed" };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, reason: "URL must not embed credentials (use auth_ref + Keys)" };
  }
  return { ok: true, url };
}
