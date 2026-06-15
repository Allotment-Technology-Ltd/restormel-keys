/**
 * Verifying proxy — MCP CLIENT leg. (planning/w2-1-phase-a-reference-integration.md, W2-1.)
 *
 * The proxy is an MCP *client* that calls a Mode-1 *upstream* MCP server (which returns
 * {answer, claims, sources}). This module owns the egress leg: connect, callTool with a
 * timeout + circuit-break, parse a text CallToolResult into a Mode1Result, and clean lifecycle.
 *
 * Transport: the deterministic CI integration links a real McpServer + Client over the SDK's
 * in-memory transport (no subprocess — see fixtures/mode1-upstream.ts and the client-fixture
 * test). A stdio path is provided for out-of-process upstreams; a StreamableHTTP path is stubbed
 * for Phase C (remote, D1-gated — not wired here).
 *
 * R-nontext: v1 reads TEXT content only. A structured/binary upstream result is rejected rather
 * than silently coerced — it routes to review, never to a verified pass.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
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

/**
 * Phase C placeholder (D1-gated): a remote StreamableHTTP upstream. Intentionally not wired in
 * Phase A — no live route, no egress to real upstreams (R8/SSRF is a remote-only gate).
 */
export function connectUpstreamHttp(_url: string): never {
  throw new Error(
    "connectUpstreamHttp is a Phase C placeholder (D1-gated remote upstream) — not enabled in Phase A.",
  );
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
