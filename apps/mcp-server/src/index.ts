#!/usr/bin/env node
/**
 * index — entry point. Runs startup validation (which exits the process on any
 * failure), then starts the server on the configured transport.
 *
 *   stdio (default) — for Claude Desktop / Cursor. stdout carries MCP frames;
 *                     all diagnostics go to stderr.
 *   http            — StreamableHTTP on RESTORMEL_PORT (stateless: one transport
 *                     per request).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { runStartup } from "./health-check.js";
import { buildServer } from "./server.js";
import { setLogLevel, logError, logInfo } from "./logger.js";

async function startStdio(...args: Parameters<typeof buildServer>): Promise<void> {
  const server = buildServer(...args);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logInfo("stdio transport connected.");
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve(undefined);
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", () => resolve(undefined));
  });
}

async function startHttp(port: number, ...args: Parameters<typeof buildServer>): Promise<void> {
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== "POST") {
      res.writeHead(405, { Allow: "POST" }).end("Method Not Allowed");
      return;
    }
    // Stateless: a fresh server + transport per request (no session state).
    const server = buildServer(...args);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      const body = await readBody(req);
      await transport.handleRequest(req, res, body);
    } catch (err) {
      logError(`HTTP request failed: ${err instanceof Error ? err.message : String(err)}`);
      if (!res.headersSent) res.writeHead(500).end("Internal Server Error");
    }
  });
  await new Promise<void>((resolve) => httpServer.listen(port, resolve));
  logInfo(`HTTP (StreamableHTTP) transport listening on :${port}.`);
}

async function main(): Promise<void> {
  const { config, runtime } = await runStartup();
  setLogLevel(config.logLevel);

  if (config.transport === "http") {
    await startHttp(config.port, config, runtime);
  } else {
    await startStdio(config, runtime);
  }
}

main().catch((err) => {
  logError(`Fatal: ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
  process.exit(1);
});
