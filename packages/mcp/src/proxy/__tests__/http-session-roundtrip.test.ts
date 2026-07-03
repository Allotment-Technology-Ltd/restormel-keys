/**
 * HTTP session round-trip — hermetic integration test (W2-1, issue #96).
 *
 * Proves the session-stateful Streamable-HTTP path works END-TO-END over real loopback HTTP:
 * the proxy Client (connectUpstreamHttp → StreamableHTTPClientTransport) runs `initialize`,
 * which establishes an `mcp-session-id`, and the SAME session is then carried across
 * `listTools` and `callTool`. This is the exact path that the per-request-transport bug broke:
 * with a fresh transport per request the client's post-initialize calls failed because they
 * landed on a different (un-initialized) session.
 *
 * Hermetic: the session-managed request listener is mounted on an ephemeral loopback port (no
 * child process, no external network, no keys). The inline SSRF guard permits loopback in dev,
 * so connectUpstreamHttp's default guard is exercised — no permissive override needed.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { connectUpstreamHttp, callMode1Tool, type UpstreamConnection } from "../client.js";
import { createMode1HttpRequestListener } from "../fixtures/mode1-http-server.js";
import { MODE1_TOOL_NAME, FIXTURE_EXPECTATIONS } from "../fixtures/mode1-upstream.js";

describe("session-stateful Streamable HTTP round-trip (client ↔ session-managed server)", () => {
  let server: http.Server;
  let closeAll: () => Promise<void>;
  let url: string;
  let conn: UpstreamConnection | null = null;

  beforeEach(async () => {
    const built = createMode1HttpRequestListener("/mcp");
    closeAll = built.closeAll;
    server = http.createServer((req, res) => void built.listener(req, res));
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}/mcp`;
  });

  afterEach(async () => {
    await conn?.close().catch(() => {});
    conn = null;
    await closeAll();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("initialize → listTools on the SAME session (no per-request session reset)", async () => {
    // connect() runs `initialize` and stores the server-issued mcp-session-id on the transport.
    conn = await connectUpstreamHttp(url);
    // listTools is a POST that MUST carry the established session id. If the server spun up a
    // fresh transport per request (the bug), this would fail "server not initialized".
    const tools = await conn.client.listTools();
    expect(tools.tools.map((t) => t.name)).toContain(MODE1_TOOL_NAME);
  });

  it("initialize → callTool returns the Mode-1 result over the same session", async () => {
    conn = await connectUpstreamHttp(url);
    const result = await callMode1Tool({
      client: conn.client,
      name: MODE1_TOOL_NAME,
      args: { query: "Who built the first Eddystone lighthouse?" },
    });
    expect(result.claims).toContain(FIXTURE_EXPECTATIONS.lighthouse.grounded);
    expect(result.claims).toContain(FIXTURE_EXPECTATIONS.lighthouse.planted);
    expect(result.sources[0]!.id).toBe("lighthouse");
  });

  it("two callTool round-trips reuse one session (initialize once, then multiple calls)", async () => {
    conn = await connectUpstreamHttp(url);
    const first = await callMode1Tool({
      client: conn.client,
      name: MODE1_TOOL_NAME,
      args: { query: "Eddystone lighthouse" },
    });
    const second = await callMode1Tool({
      client: conn.client,
      name: MODE1_TOOL_NAME,
      args: { query: "honey bee waggle dance" },
    });
    expect(first.sources[0]!.id).toBe("lighthouse");
    expect(second.sources[0]!.id).toBe("honeybee");
  });
});
