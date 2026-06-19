/**
 * Verifying proxy — standalone StreamableHTTP Mode-1 upstream server (W2-1 reference integration).
 *
 * PURPOSE: A REAL, locally-runnable Mode-1 MCP upstream over the ratified 2025-11-25 Streamable
 * HTTP transport — the reference integration for issue #96. Serves the same public-domain corpus
 * and graph_answer tool as mode1-upstream.ts (the in-memory fixture), but over HTTP so that
 * connectUpstreamHttp() + the SSRF guard can be exercised end-to-end.
 *
 * WHY THIS UPSTREAM (Mode-1 fit justification):
 *   - A "GraphRAG-style" answer server is the canonical Mode-1 upstream: it takes a natural-language
 *     query and returns {answer, claims[], sources:[{id,text,uri}]} — exactly the Mode1Result shape
 *     the proxy consumes. The corpus+claims structure mirrors a knowledge-graph retrieval result.
 *   - Running locally over stdio (or http) avoids external accounts or network deps, making the
 *     reference integration fully reproducible: clone → run this server → point the proxy at it.
 *   - The bundled public-domain corpus (Eddystone lighthouse + honey bee waggle dance) provides
 *     deterministic grounded/planted claim pairs for end-to-end envelope verification.
 *   - The HTTP transport (StreamableHTTPClientTransport) is the W2-1 gate: it exercises the
 *     connectUpstreamHttp() implementation and the SSRF egress guard on the egress path.
 *
 * USAGE (from the repo root — start first, leave running, then run the reference script):
 *   pnpm exec tsx packages/mcp/src/proxy/fixtures/mode1-http-server.ts
 *   # → listens on http://127.0.0.1:3741/mcp  (port configurable via MODE1_PORT env)
 *
 * Then in a second terminal:
 *   pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts \
 *     --upstream http://localhost:3741/mcp
 *
 * For the reproducible real-LLM capture (D-c independent — answer author is "fixture-graphrag"):
 *   OPENAI_API_KEY=sk-… pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts \
 *     --upstream http://localhost:3741/mcp \
 *     --validator openai:gpt-4o-mini
 *
 *   TOGETHER_API_KEY=… pnpm exec tsx scripts/reviews/verifying-proxy-reference.ts \
 *     --upstream http://localhost:3741/mcp \
 *     --validator together:meta-llama/Llama-3.3-70B-Instruct-Turbo
 *
 * SSRF notes:
 *   - localhost is allowed in dev (NODE_ENV !== production) by the outbound-url-guard. In
 *     production, RESTORMEL_ALLOW_PRIVATE_SURREAL_ENDPOINT=1 would be required — but this
 *     server is a LOCAL development / operator tool only, never a prod-deployed upstream.
 *   - The server itself does NOT egress anywhere — it reads only the bundled corpus files.
 */
import http from "node:http";
import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createMode1UpstreamServer } from "./mode1-upstream.js";

const PORT = Number(process.env.MODE1_PORT ?? "3741");
const BIND = "127.0.0.1"; // always loopback — not a public server
const MCP_PATH = process.env.MODE1_PATH ?? "/mcp";

const SESSION_HEADER = "mcp-session-id";

function jsonRpcError(res: http.ServerResponse, status: number, message: string): void {
  // JSON-RPC-shaped transport error (no request id is known at this layer). We do NOT
  // echo internal error details — only fixed, safe transport-level messages.
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }),
  );
}

/**
 * Build a session-stateful Mode-1 Streamable-HTTP request listener.
 *
 * The MCP Streamable-HTTP transport is session-scoped: the client's `initialize` establishes a
 * session (the server returns an `mcp-session-id`), and every subsequent listTools/callTool/GET/
 * DELETE MUST hit the SAME transport for that session. We therefore keep one transport PER session
 * (keyed by its generated id), mirroring the SDK's documented stateful Streamable-HTTP server
 * example. A fresh McpServer is bound to each session's transport so per-session connection state
 * never crosses sessions.
 *
 * Returned `closeAll` closes every open session transport (use it on shutdown / in test teardown).
 * Exported (rather than inlined in main()) so a hermetic test can mount the exact same handler on
 * an ephemeral http.Server without a child process.
 *
 * @param mcpPath  The MCP endpoint path (default "/mcp"). Requests to other paths 404 (with a
 *                 "/" and "/health" liveness exception).
 */
export function createMode1HttpRequestListener(mcpPath: string = MCP_PATH): {
  listener: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
  closeAll: () => Promise<void>;
} {
  const transports = new Map<string, StreamableHTTPServerTransport>();

  const listener = async (req: http.IncomingMessage, res: http.ServerResponse): Promise<void> => {
    // Health check — useful for probing liveness before the runner starts.
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    const urlPath = req.url?.split("?")[0] ?? "";
    if (urlPath !== mcpPath) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Not found — MCP endpoint is at ${mcpPath}`);
      return;
    }

    // Collect request body (needed for POST initialize / callTool requests).
    let parsedBody: unknown;
    if (req.method === "POST") {
      let raw = "";
      for await (const chunk of req) raw += chunk;
      if (raw) {
        try {
          parsedBody = JSON.parse(raw);
        } catch {
          jsonRpcError(res, 400, "Parse error: invalid JSON");
          return;
        }
      }
    }

    const sessionIdHeader = req.headers[SESSION_HEADER];
    const sessionId = Array.isArray(sessionIdHeader) ? sessionIdHeader[0] : sessionIdHeader;

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports.has(sessionId)) {
        // Existing session — reuse its transport for listTools / callTool / GET / DELETE.
        transport = transports.get(sessionId)!;
      } else if (!sessionId && req.method === "POST" && isInitializeRequest(parsedBody)) {
        // New session — the client is initializing. Create a session-scoped transport whose
        // generated id is stored on `onsessioninitialized`, and bind a fresh McpServer to it.
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid) => {
            transports.set(sid, transport);
          },
        });
        // When the transport closes (client DELETE, connection teardown, or shutdown), drop the
        // session so the map cannot leak transports across a long-lived server.
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) transports.delete(sid);
        };
        const mcpServer = createMode1UpstreamServer();
        await mcpServer.connect(transport);
      } else {
        // No valid session and not an initialize request → protocol error.
        // (Spec: non-init requests without a session id are 400; invalid session ids are 404.)
        const status = sessionId ? 404 : 400;
        const msg = sessionId
          ? "Bad Request: unknown or expired mcp-session-id"
          : "Bad Request: no valid session id and not an initialize request";
        jsonRpcError(res, status, msg);
        return;
      }

      await transport.handleRequest(req, res, parsedBody);
    } catch (err) {
      if (!res.headersSent) {
        // Log to stderr but never echo err.message in the response body — dev tool only,
        // but avoid normalising the pattern of serialising errors into HTTP responses.
        console.error("[mode1-http-server] request error:", err instanceof Error ? err.message : String(err));
        jsonRpcError(res, 500, "Internal server error");
      }
    }
  };

  const closeAll = async (): Promise<void> => {
    for (const transport of transports.values()) {
      await transport.close().catch(() => {});
    }
    transports.clear();
  };

  return { listener, closeAll };
}

async function main(): Promise<void> {
  const { listener, closeAll } = createMode1HttpRequestListener();
  const httpServer = http.createServer((req, res) => void listener(req, res));

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(PORT, BIND, resolve);
    httpServer.on("error", reject);
  });

  console.error(`[mode1-http-server] listening on http://${BIND}:${PORT}${MCP_PATH}`);
  console.error(`[mode1-http-server] tool: graph_answer  corpus: lighthouse.md + honeybee.md`);
  console.error(`[mode1-http-server] session-stateful Streamable HTTP — press Ctrl-C to stop`);

  // Close every open session transport, then stop accepting connections.
  const shutdown = async (): Promise<void> => {
    await closeAll();
    httpServer.close();
  };

  // Keep alive until a signal.
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.error("\n[mode1-http-server] shutting down");
      void shutdown().finally(resolve);
    });
    process.on("SIGTERM", () => {
      void shutdown().finally(resolve);
    });
  });
}

// Only launch the standalone HTTP server when run directly (tsx/node), not when imported by a
// test that mounts createMode1HttpRequestListener() on its own ephemeral server.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error("[mode1-http-server] fatal:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
