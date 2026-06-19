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
import { createMode1UpstreamServer } from "./mode1-upstream.js";

const PORT = Number(process.env.MODE1_PORT ?? "3741");
const BIND = "127.0.0.1"; // always loopback — not a public server
const MCP_PATH = process.env.MODE1_PATH ?? "/mcp";

async function main(): Promise<void> {
  const mcpServer = createMode1UpstreamServer();

  const httpServer = http.createServer(async (req, res) => {
    // Health check — useful for probing liveness before the runner starts.
    if (req.url === "/health" || req.url === "/") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }

    const urlPath = req.url?.split("?")[0] ?? "";
    if (urlPath !== MCP_PATH) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Not found — MCP endpoint is at ${MCP_PATH}`);
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
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "invalid_json" }));
          return;
        }
      }
    }

    // Per-request transport: each request gets its own transport instance closed in the
    // finally block below, so no session state survives between requests. The
    // sessionIdGenerator is required by the SDK but the ID is only used ephemerally.
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    try {
      // Connect the MCP server to this transport for the duration of this request.
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, parsedBody);
    } catch (err) {
      if (!res.headersSent) {
        // Log to stderr but never echo err.message in the response body — dev tool only,
        // but avoid normalising the pattern of serialising errors into HTTP responses.
        console.error("[mode1-http-server] request error:", err instanceof Error ? err.message : String(err));
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "internal_server_error" }));
      }
    } finally {
      await transport.close().catch(() => {});
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(PORT, BIND, resolve);
    httpServer.on("error", reject);
  });

  console.error(`[mode1-http-server] listening on http://${BIND}:${PORT}${MCP_PATH}`);
  console.error(`[mode1-http-server] tool: graph_answer  corpus: lighthouse.md + honeybee.md`);
  console.error(`[mode1-http-server] press Ctrl-C to stop`);

  // Keep alive until a signal.
  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      console.error("\n[mode1-http-server] shutting down");
      httpServer.close();
      resolve();
    });
    process.on("SIGTERM", () => {
      httpServer.close();
      resolve();
    });
  });
}

main().catch((e) => {
  console.error("[mode1-http-server] fatal:", e instanceof Error ? e.message : e);
  process.exit(1);
});
