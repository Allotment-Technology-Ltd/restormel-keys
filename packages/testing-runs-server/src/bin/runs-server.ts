#!/usr/bin/env node
import { resolve } from "node:path";
import { createRunsStoreFromEnv } from "../create-store.js";
import { logStructured } from "../logger.js";
import { startRunsApiServer } from "../server.js";

function getenv(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v.trim() === "" ? undefined : v.trim();
}

async function main(): Promise<void> {
  const workspace = getenv("RESTORMEL_RUNS_WORKSPACE") ?? process.argv.find((a) => a.startsWith("--workspace="))?.slice("--workspace=".length);
  if (workspace === undefined || workspace === "") {
    console.error("Set RESTORMEL_RUNS_WORKSPACE or pass --workspace=<abs-path> to the repository root to run against.");
    process.exit(2);
  }

  const socketRaw =
    getenv("RESTORMEL_RUNS_SOCKET_PATH") ?? process.argv.find((a) => a.startsWith("--socket="))?.slice("--socket=".length);
  const unixSocketPath = socketRaw !== undefined && socketRaw.length > 0 ? resolve(socketRaw) : undefined;

  let port = 8787;
  if (unixSocketPath === undefined) {
    const portRaw = getenv("RESTORMEL_RUNS_PORT") ?? process.argv.find((a) => a.startsWith("--port="))?.slice("--port=".length) ?? "8787";
    const p = Number(portRaw);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      console.error("Invalid port");
      process.exit(2);
    }
    port = p;
  }

  const host = getenv("RESTORMEL_RUNS_HOST") ?? "127.0.0.1";
  const maxConcRaw = getenv("RESTORMEL_RUNS_MAX_CONCURRENT");
  let maxConcurrent = 1;
  if (maxConcRaw !== undefined) {
    maxConcurrent = Number(maxConcRaw);
    if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
      console.error("Invalid RESTORMEL_RUNS_MAX_CONCURRENT");
      process.exit(2);
    }
  }

  const root = resolve(workspace);
  const store = await createRunsStoreFromEnv();
  const server = await startRunsApiServer({
    workspaceRoot: root,
    host,
    port,
    maxConcurrent,
    store,
    unixSocketPath,
  });

  const tokenHint = getenv("RESTORMEL_RUNS_API_TOKEN") ? "auth=Bearer token" : "auth=none";
  const listenHint =
    unixSocketPath !== undefined
      ? `unix:${unixSocketPath}`
      : `http://${host}:${port}`;
  const rpmRaw = getenv("RESTORMEL_RUNS_RATE_LIMIT_RPM");
  const rateHint =
    rpmRaw !== undefined && rpmRaw !== "" && rpmRaw !== "0" ? `rate_limit_rpm=${rpmRaw}` : "rate_limit=off";
  console.error(
    `Restormel Testing Runs API listening on ${listenHint} (${tokenHint}, ${rateHint}, workspace=${root}, store=${store.kind})`,
  );

  server.on("error", (e) => {
    console.error(e);
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logStructured("info", "runs_api.shutdown", { signal });
    server.close((err) => {
      if (err !== undefined && err !== null) {
        logStructured("error", "runs_api.shutdown_error", { error: err.message });
        process.exit(1);
      }
      process.exit(0);
    });
    setTimeout(() => {
      logStructured("error", "runs_api.shutdown_timeout", {});
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
