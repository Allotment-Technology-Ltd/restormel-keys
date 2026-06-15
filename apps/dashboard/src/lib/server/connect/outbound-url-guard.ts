/**
 * Shared outbound-URL / egress allow-list (SSRF mitigation) for ALL user-supplied
 * upstream URLs the dashboard server dials — Surreal HTTP endpoints AND the
 * verifying-proxy's upstream MCP servers (REC-PLAN-010 §B2, D-h / R8).
 *
 * This is the generalisation of the original `validateOutboundSurrealEndpoint`
 * guard: it owns the host/IP-blocking core (loopback, RFC-1918, link-local incl.
 * cloud IMDS 169.254.169.254, ULA / ::1, `.internal`, metadata names) and adds
 * protocol-scheme handling for `http`/`https` AND `ws`/`wss`. The Surreal guard
 * now delegates here so there is exactly ONE validator — never a weaker second one.
 *
 * The guard MUST be run at BOTH write-time (registering an upstream) and dial-time
 * (resolving / connecting), exactly like the original Surreal pattern.
 *
 * DNS-rebinding limit (carried forward): this is a hostname-string + literal-IP
 * check. A hostname that resolves to a public IP at validation time but to a
 * private IP at connect time is NOT mitigated here. Full mitigation requires
 * resolve-then-pin-then-connect at the socket layer (out of scope for Phase B).
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "metadata.google",
  "169.254.169.254",
]);

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

/**
 * Parse a user-supplied endpoint into a URL. When `defaultScheme` is set and the
 * input has no scheme, it is prepended (matches the Surreal guard's tolerance of
 * bare hosts). Returns null for un-parseable input.
 */
function parseEndpointUrl(endpoint: string, defaultScheme: string): URL | null {
  const trimmed = endpoint.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed.includes("://") ? trimmed : `${defaultScheme}://${trimmed}`);
  } catch {
    return null;
  }
}

function ipv4ToInt(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const octet = Number(p);
    if (!Number.isInteger(octet) || octet < 0 || octet > 255) return null;
    n = (n << 8) + octet;
  }
  return n >>> 0;
}

function isPrivateOrReservedIpv4(host: string): boolean {
  const n = ipv4ToInt(host);
  if (n === null) return false;
  // Mask results are coerced to unsigned (>>> 0) before comparison: for
  // 172.16.x / 192.168.x the high bit is set, so a bare signed `&` compares a
  // negative int32 against a positive literal and silently misses the range.
  const mask = (m: number): number => (n & m) >>> 0;
  // Loopback is the MOST-significant octet (127.0.0.0/8). The previous
  // `(n & 0xff) === 0x7f` masked the LEAST-significant octet, so only 127.0.0.1
  // (caught by a hostname literal) was blocked while 127.0.0.2 / 127.1.2.3 / all
  // of 127/8 passed — and public IPs ending in .127 (e.g. 8.8.8.127) were
  // falsely blocked. Mask the top octet so the whole loopback /8 is covered.
  if (mask(0xff000000) === 0x7f000000) return true; // 127.0.0.0/8 loopback
  if (mask(0xff000000) === 0x0a000000) return true; // 10.0.0.0/8
  if (mask(0xfff00000) === 0xac100000) return true; // 172.16.0.0/12
  if (mask(0xffff0000) === 0xc0a80000) return true; // 192.168.0.0/16
  if (mask(0xffff0000) === 0xa9fe0000) return true; // 169.254.0.0/16 link-local (incl. 169.254.169.254 IMDS)
  if (n === 0) return true; // 0.0.0.0
  return false;
}

/**
 * Extract the embedded IPv4 from an IPv4-mapped IPv6 address (::ffff:0:0/96), in
 * either form the parser/UI may hand us:
 *   - dotted:  `::ffff:127.0.0.1`          (some URL libs keep this)
 *   - hex:     `::ffff:7f00:1`             (WHATWG URL normalises to this)
 * Returns the IPv4 dotted-quad string, or null when not an IPv4-mapped address.
 */
function extractMappedIpv4(host: string): string | null {
  const m = /^::ffff:(.+)$/.exec(host);
  if (!m) return null;
  const tail = m[1];
  // Dotted form: ::ffff:127.0.0.1
  if (tail.includes(".")) return tail;
  // Hex form: ::ffff:7f00:1 → two 16-bit groups → four octets.
  const groups = tail.split(":");
  if (groups.length !== 2) return null;
  const hi = Number.parseInt(groups[0], 16);
  const lo = Number.parseInt(groups[1], 16);
  if (!Number.isInteger(hi) || !Number.isInteger(lo) || hi < 0 || hi > 0xffff || lo < 0 || lo > 0xffff) {
    return null;
  }
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
}

function isPrivateOrReservedIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::1") return true; // loopback
  if (h === "::") return true; // unspecified (0.0.0.0 equivalent)
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) routes to the embedded IPv4, so an attacker
  // can reach loopback / IMDS / RFC-1918 through it (e.g. ::ffff:127.0.0.1,
  // ::ffff:169.254.169.254, ::ffff:10.0.0.1). Decode the IPv4 and apply the IPv4
  // block-list. Without this the mapped forms bypassed every check above.
  const mapped = extractMappedIpv4(h);
  if (mapped !== null && isPrivateOrReservedIpv4(mapped)) return true;
  // ULA fc00::/7 — match the address PREFIX, not a substring (so a legitimate
  // public address like 2606:...:fc11 is NOT over-blocked).
  if (/^f[cd][0-9a-f]*:/.test(h) || h === "fc00::" || h === "fd00::") return true; // unique local (ULA)
  if (h.startsWith("fe80:") || h === "fe80::") return true; // link-local
  return false;
}

/** True when the hostname/IP is a private, loopback, link-local, or metadata target. */
export function hostLooksBlocked(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".internal")) return true;
  if (isPrivateOrReservedIpv4(host)) return true;
  if (host.includes(":") && isPrivateOrReservedIpv6(host)) return true;
  return false;
}

function hostIsLoopback(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  return h === "localhost" || h === "127.0.0.1" || h === "::1";
}

/**
 * Per-deployment escape hatch for operator-local testing against private targets
 * (e.g. a Surreal box on the same host). Honoured by every protocol family so the
 * generalised guard keeps identical behaviour to the original Surreal validator.
 */
function allowPrivateEndpoints(): boolean {
  return process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT === "1";
}

/**
 * Optional per-deployment host allow-list. When `RESTORMEL_UPSTREAM_ALLOWLIST` is
 * set (comma-separated hosts or `.suffix` entries), ONLY listed hosts may be
 * registered/dialled. Unset = no allow-list (the block-list above still applies).
 * Applied only to the upstream-MCP family (`scheme: "mcp"`) so the Surreal path is
 * byte-for-byte unchanged.
 */
function upstreamHostAllowed(hostname: string): boolean {
  const raw = process.env.RESTORMEL_UPSTREAM_ALLOWLIST?.trim();
  if (!raw) return true; // no allow-list configured
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const entries = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (entries.length === 0) return true;
  return entries.some((entry) =>
    entry.startsWith(".") ? host === entry.slice(1) || host.endsWith(entry) : host === entry,
  );
}

export type OutboundUrlScheme = "surreal" | "mcp";

export type OutboundUrlVerdict = { ok: true } | { ok: false; message: string };

/**
 * Validate a user-supplied outbound URL against the egress allow-list.
 *
 * @param endpoint  raw user input (may be a bare host; default scheme applied)
 * @param family    "surreal" → http/https (HTTP API) AND ws/wss (SurrealDB's
 *                              native WebSocket protocol — PR #57);
 *                  "mcp"     → http/https for streamable-HTTP MCP, ws/wss for
 *                              transports that upgrade.
 *                  Both families accept the same scheme set and require TLS
 *                  (https/wss) in production; they differ only in error wording
 *                  and the optional upstream host allow-list (mcp only).
 */
export function validateOutboundUrl(
  endpoint: string,
  family: OutboundUrlScheme = "surreal",
): OutboundUrlVerdict {
  const defaultScheme = "https";
  const url = parseEndpointUrl(endpoint, defaultScheme);
  if (!url) {
    return { ok: false, message: "Invalid endpoint URL." };
  }

  const proto = url.protocol.replace(":", "").toLowerCase();
  const host = url.hostname;
  const prod = isProductionRuntime();

  // Both families accept the secure WebSocket/HTTPS pair and the cleartext pair.
  // Surreal needs ws/wss for its native protocol (PR #57); MCP needs them for
  // transports that upgrade. Production rejects the cleartext pair below.
  const secureSchemes = ["https", "wss"];
  const insecureSchemes = ["http", "ws"];
  const allSchemes = [...secureSchemes, ...insecureSchemes];

  if (!allSchemes.includes(proto)) {
    return {
      ok: false,
      message:
        family === "mcp"
          ? "Upstream URL must use https, wss, http, or ws."
          : "Surreal endpoint must use https, wss, http, or ws.",
    };
  }

  // Production requires TLS (https/wss) — no cleartext egress.
  if (prod && !secureSchemes.includes(proto)) {
    return {
      ok: false,
      message:
        family === "mcp"
          ? "Production requires an HTTPS or WSS upstream URL (no cleartext egress)."
          : "Production requires a secure Surreal endpoint (https:// or wss://).",
    };
  }

  const isLoopback = hostIsLoopback(host);

  // Dev only: cleartext (http/ws) is allowed solely for localhost loopback.
  if (!prod && insecureSchemes.includes(proto)) {
    if (!isLoopback) {
      return {
        ok: false,
        message:
          "In development, cleartext (http/ws) is only allowed for localhost (use https/wss for remote hosts).",
      };
    }
    return { ok: true };
  }

  // Dev + loopback over a secure scheme is also fine (e.g. https://localhost).
  if (!prod && isLoopback) {
    return { ok: true };
  }

  // Non-loopback (or prod): apply the private/metadata block-list.
  if (!allowPrivateEndpoints() && hostLooksBlocked(host)) {
    return {
      ok: false,
      message:
        "This endpoint is not allowed from Restormel servers (private or metadata addresses). Use a public HTTPS/WSS URL, or set RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT=1 for local operator testing only.",
    };
  }

  // Upstream-MCP family: enforce the optional per-deployment host allow-list.
  if (family === "mcp" && !upstreamHostAllowed(host)) {
    return {
      ok: false,
      message:
        "This host is not in RESTORMEL_UPSTREAM_ALLOWLIST. Add it to the allow-list to register this upstream.",
    };
  }

  return { ok: true };
}
