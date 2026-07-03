/**
 * Verifying proxy — MCP CLIENT leg. (planning/w2-1-phase-a-reference-integration.md, W2-1.)
 *
 * The proxy is an MCP *client* that calls a Mode-1 *upstream* MCP server (which returns
 * {answer, claims, sources}). This module owns the egress leg: connect, callTool with a
 * timeout + circuit-break, parse a text CallToolResult into a Mode1Result, and clean lifecycle.
 *
 * Transport: the deterministic CI integration links a real McpServer + Client over the SDK's
 * in-memory transport (no subprocess — see fixtures/mode1-upstream.ts and the client-fixture
 * test). A stdio path is provided for out-of-process upstreams. connectUpstreamHttp implements
 * the W2-1 StreamableHTTP egress leg (MCP 2025-11-25 ratified transport), guarded by the
 * SSRF/egress block-list in outbound-url-guard.ts (R8/D-h).
 *
 * R-nontext: v1 reads TEXT content only. A structured/binary upstream result is rejected rather
 * than silently coerced — it routes to review, never to a verified pass.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { Mode1Result, Mode1Source } from "@restormel/connect-core";

export const PROXY_CLIENT_NAME = "restormel-verifying-proxy";
export const PROXY_CLIENT_VERSION = "0.1.0";

/** Default egress timeout for a single upstream callTool. */
export const DEFAULT_CALLTOOL_TIMEOUT_MS = 30_000;

export type UpstreamConnection = {
  client: Client;
  /** Close transport + client. Always call in a finally. */
  close: () => Promise<void>;
};

/** Connect over an already-constructed transport (e.g. an in-memory linked pair). */
export async function connectUpstreamTransport(transport: Transport): Promise<UpstreamConnection> {
  const client = new Client({ name: PROXY_CLIENT_NAME, version: PROXY_CLIENT_VERSION });
  await client.connect(transport);
  return {
    client,
    close: async () => {
      await client.close().catch(() => {});
    },
  };
}

/** Connect to a stdio upstream by spawning `command args` (out-of-process upstreams). */
export async function connectUpstreamStdio(args: {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}): Promise<UpstreamConnection> {
  const transport = new StdioClientTransport({
    command: args.command,
    args: args.args ?? [],
    ...(args.env ? { env: args.env } : {}),
  });
  return connectUpstreamTransport(transport);
}

// ── Inline SSRF guard (mirrors outbound-url-guard.ts — kept in sync) ────────
// The dashboard's outbound-url-guard.ts is the canonical policy source. This
// inline copy exists so the MCP client module is self-contained (no cross-
// package dynamic import), testable in isolation, and usable in standalone
// scripts. Any policy change MUST be reflected in both places.
// See: apps/dashboard/src/lib/server/connect/outbound-url-guard.ts

const _BLOCKED_HOSTNAMES = new Set([
  "localhost", "127.0.0.1", "0.0.0.0", "::1",
  "metadata.google.internal", "metadata.google", "169.254.169.254",
]);

function _ipv4ToInt(host: string): number | null {
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

function _isPrivateIpv4(host: string): boolean {
  const n = _ipv4ToInt(host);
  if (n === null) return false;
  const mask = (m: number): number => (n & m) >>> 0;
  if (mask(0xff000000) === 0x7f000000) return true; // 127.0.0.0/8
  if (mask(0xff000000) === 0x0a000000) return true; // 10.0.0.0/8
  if (mask(0xfff00000) === 0xac100000) return true; // 172.16.0.0/12
  if (mask(0xffff0000) === 0xc0a80000) return true; // 192.168.0.0/16
  if (mask(0xffff0000) === 0xa9fe0000) return true; // 169.254.0.0/16 link-local
  if (n === 0) return true;
  return false;
}

function _extractMappedIpv4(host: string): string | null {
  const m = /^::ffff:(.+)$/.exec(host);
  if (!m) return null;
  const tail = m[1]!;
  if (tail.includes(".")) return tail;
  const groups = tail.split(":");
  if (groups.length !== 2) return null;
  const hi = Number.parseInt(groups[0]!, 16);
  const lo = Number.parseInt(groups[1]!, 16);
  if (!Number.isInteger(hi) || !Number.isInteger(lo) || hi < 0 || hi > 0xffff || lo < 0 || lo > 0xffff) return null;
  return [hi >> 8, hi & 0xff, lo >> 8, lo & 0xff].join(".");
}

function _isPrivateIpv6(host: string): boolean {
  const h = host.toLowerCase();
  if (h === "::1" || h === "::") return true;
  const mapped = _extractMappedIpv4(h);
  if (mapped !== null && _isPrivateIpv4(mapped)) return true;
  if (/^f[cd][0-9a-f]*:/.test(h) || h === "fc00::" || h === "fd00::") return true;
  if (h.startsWith("fe80:") || h === "fe80::") return true;
  return false;
}

function _hostBlocked(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (_BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".internal")) return true;
  if (_isPrivateIpv4(h)) return true;
  if (h.includes(":") && _isPrivateIpv6(h)) return true;
  return false;
}

function _isLoopback(h: string): boolean {
  const host = h.toLowerCase().replace(/^\[|\]$/g, "");
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

/** Validate a user-supplied MCP upstream URL against the SSRF block-list. */
function _validateMcpUrl(url: string): { ok: true } | { ok: false; message: string } {
  let parsed: URL;
  try {
    parsed = new URL(url.trim().includes("://") ? url.trim() : `https://${url.trim()}`);
  } catch {
    return { ok: false, message: "Invalid upstream URL." };
  }
  const proto = parsed.protocol.replace(":", "").toLowerCase();
  const host = parsed.hostname;
  const prod = process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const secureSchemes = ["https", "wss"];
  const insecureSchemes = ["http", "ws"];
  if (![...secureSchemes, ...insecureSchemes].includes(proto)) {
    return { ok: false, message: "Upstream URL must use https, wss, http, or ws." };
  }
  if (prod && !secureSchemes.includes(proto)) {
    return { ok: false, message: "Production requires an HTTPS or WSS upstream URL (no cleartext egress)." };
  }
  const loopback = _isLoopback(host);
  // Dev: cleartext only allowed for loopback.
  if (!prod && insecureSchemes.includes(proto)) {
    if (!loopback) {
      return { ok: false, message: "In development, cleartext (http/ws) is only allowed for localhost." };
    }
    return { ok: true };
  }
  // Dev loopback over secure scheme is fine.
  if (!prod && loopback) return { ok: true };
  // Non-loopback: apply the SSRF block-list.
  if (process.env.RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT !== "1" && _hostBlocked(host)) {
    return { ok: false, message: "Upstream host is blocked (private or metadata address). Use a public HTTPS/WSS URL." };
  }
  // Optional per-deployment allow-list (RESTORMEL_UPSTREAM_ALLOWLIST).
  const raw = process.env.RESTORMEL_UPSTREAM_ALLOWLIST?.trim();
  if (raw) {
    const entries = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
    if (entries.length > 0) {
      const h2 = host.toLowerCase().replace(/^\[|\]$/g, "");
      const allowed = entries.some((e) => e.startsWith(".") ? h2 === e.slice(1) || h2.endsWith(e) : h2 === e);
      if (!allowed) {
        return { ok: false, message: "Host not in RESTORMEL_UPSTREAM_ALLOWLIST." };
      }
    }
  }
  return { ok: true };
}
// ── End inline SSRF guard ─────────────────────────────────────────────────────

/**
 * Connect to a remote StreamableHTTP upstream (MCP 2025-11-25 Streamable HTTP transport).
 *
 * The URL is validated synchronously against the inline SSRF block-list (R8/D-h) before any
 * transport object is constructed. Private IPs, loopback (non-dev), link-local, cloud IMDS
 * (169.254.169.254), and `.internal` hostnames are all rejected. Production additionally
 * requires https/wss (no cleartext egress).
 *
 * The inline guard mirrors outbound-url-guard.ts — see that file for the canonical policy.
 * Any policy change must be reflected in both places.
 *
 * Reconnection policy: SDK defaults (maxRetries=2, backoff 1–30 s). The egress timeout on
 * callTool (DEFAULT_CALLTOOL_TIMEOUT_MS) is the primary circuit-break.
 *
 * @param url      The upstream StreamableHTTP endpoint URL.
 * @param _guard   Optional override for the URL validator (injectable for tests / operator
 *                 tooling). Defaults to the inline SSRF guard described above.
 *                 WARNING: Never pass a permissive guard from user-controlled input — doing so
 *                 re-opens the SSRF surface. This parameter is for hermetic tests and operator
 *                 scripts only. Dashboard server routes must use the default.
 */
export async function connectUpstreamHttp(
  url: string,
  _guard?: (u: string) => { ok: boolean; message?: string },
): Promise<UpstreamConnection> {
  const guard = _guard ?? _validateMcpUrl;
  const verdict = guard(url);
  if (!verdict.ok) {
    throw new UpstreamCallError(
      `connectUpstreamHttp: SSRF guard rejected upstream URL — ${verdict.message}`,
      "transport",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new UpstreamCallError(`connectUpstreamHttp: invalid URL "${url}"`, "transport");
  }

  let transport: StreamableHTTPClientTransport;
  try {
    transport = new StreamableHTTPClientTransport(parsedUrl);
  } catch (err) {
    throw new UpstreamCallError(
      `connectUpstreamHttp: failed to construct transport for "${url}": ${err instanceof Error ? err.message : String(err)}`,
      "transport",
    );
  }

  return connectUpstreamTransport(transport);
}

export class UpstreamCallError extends Error {
  constructor(
    message: string,
    readonly kind: "timeout" | "tool_error" | "non_text" | "unparseable" | "transport",
  ) {
    super(message);
    this.name = "UpstreamCallError";
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new UpstreamCallError(`${label} timed out after ${ms}ms`, "timeout")), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

type RawCallToolResult = {
  content?: { type: string; text?: string }[];
  structuredContent?: unknown;
  isError?: boolean;
};

/**
 * Call a Mode-1 tool and return its raw CallToolResult. Enforces the egress timeout (circuit
 * break) and rejects an error result. Does NOT parse — see callMode1Tool for the typed path.
 */
export async function callTool(args: {
  client: Client;
  name: string;
  args?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<RawCallToolResult> {
  const timeoutMs = args.timeoutMs ?? DEFAULT_CALLTOOL_TIMEOUT_MS;
  let result: RawCallToolResult;
  try {
    result = (await withTimeout(
      args.client.callTool({ name: args.name, arguments: args.args ?? {} }),
      timeoutMs,
      `callTool(${args.name})`,
    )) as RawCallToolResult;
  } catch (err) {
    if (err instanceof UpstreamCallError) throw err;
    throw new UpstreamCallError(
      `callTool(${args.name}) failed: ${err instanceof Error ? err.message : String(err)}`,
      "transport",
    );
  }
  if (result?.isError) {
    const text = firstText(result) ?? "(no message)";
    throw new UpstreamCallError(`upstream tool "${args.name}" returned an error: ${text}`, "tool_error");
  }
  return result;
}

/** Extract the first text content block, or null if none (R-nontext: text only). */
export function firstText(result: RawCallToolResult): string | null {
  const block = (result.content ?? []).find((c) => c.type === "text" && typeof c.text === "string");
  return block?.text ?? null;
}

/**
 * Parse a Mode-1 tool's text CallToolResult into a Mode1Result. R-nontext: a result with no text
 * block, or whose text is not the expected JSON shape, throws (→ review). Never coerces.
 */
export function parseMode1ToolResult(result: RawCallToolResult): Mode1Result {
  const text = firstText(result);
  if (text === null) {
    throw new UpstreamCallError("upstream returned no text content (non-text results are out of v1)", "non_text");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new UpstreamCallError("upstream text content was not valid JSON", "unparseable");
  }
  const rec = obj as Record<string, unknown>;
  const answer = typeof rec.answer === "string" ? rec.answer : "";
  const claims = Array.isArray(rec.claims)
    ? rec.claims.filter((c): c is string => typeof c === "string")
    : undefined;
  const sources: Mode1Source[] = Array.isArray(rec.sources)
    ? rec.sources
        .filter((s): s is Record<string, unknown> => !!s && typeof s === "object")
        .map((s) => ({
          id: String(s.id ?? ""),
          text: typeof s.text === "string" ? s.text : "",
          ...(typeof s.uri === "string" ? { uri: s.uri } : {}),
        }))
        .filter((s) => s.id.length > 0)
    : [];
  if (!answer && (!claims || claims.length === 0)) {
    throw new UpstreamCallError("upstream result had neither an answer nor claims", "unparseable");
  }
  return { answer, ...(claims ? { claims } : {}), sources };
}

/** Convenience: callTool + parse into a typed Mode1Result (the proxy's egress leg). */
export async function callMode1Tool(args: {
  client: Client;
  name: string;
  args?: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<Mode1Result> {
  const raw = await callTool(args);
  return parseMode1ToolResult(raw);
}
