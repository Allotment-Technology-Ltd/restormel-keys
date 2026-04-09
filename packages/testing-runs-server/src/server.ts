import { unlinkSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { parsePostRunsBody } from "./post-body.js";
import { executeRunInBackground } from "./execute-run.js";
import { logStructured, SERVER_VERSION } from "./logger.js";
import { clientRateLimitKey, getOrCreateRequestId } from "./request-context.js";
import { MinuteWindowRateLimiter } from "./rate-limit.js";
import type { RunEntity, RunsStore } from "./runs-store.js";

export type RunsApiServerOptions = {
  /** Absolute path — config and artefacts must stay under this tree. */
  workspaceRoot: string;
  host?: string;
  port: number;
  /** Limit parallel Playwright runs (default 1). */
  maxConcurrent?: number;
  store: RunsStore;
  /**
   * Unix domain socket path (Linux/macOS sidecar). When set, **TCP listen is not used** —
   * set via **`RESTORMEL_RUNS_SOCKET_PATH`** from the CLI.
   */
  unixSocketPath?: string;
  /**
   * Max HTTP requests per minute per client key (0 = off).
   * Default: **`RESTORMEL_RUNS_RATE_LIMIT_RPM`** env or **0**.
   */
  rateLimitRequestsPerMinute?: number;
};

function resolveRateLimitRpm(opts: RunsApiServerOptions): number {
  if (opts.rateLimitRequestsPerMinute !== undefined) return Math.max(0, opts.rateLimitRequestsPerMinute);
  const v = parseInt(process.env.RESTORMEL_RUNS_RATE_LIMIT_RPM ?? "0", 10);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: unknown,
  requestId: string,
  extraHeaders?: Record<string, string>,
): void {
  const payload = `${JSON.stringify(body)}\n`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "X-Request-Id": requestId,
    "Content-Length": String(Buffer.byteLength(payload)),
    ...extraHeaders,
  };
  res.writeHead(status, headers);
  res.end(payload);
}

function authorize(req: IncomingMessage): boolean {
  const want = process.env.RESTORMEL_RUNS_API_TOKEN?.trim();
  if (want === undefined || want === "") return true;
  const h = req.headers.authorization;
  if (typeof h !== "string" || !h.startsWith("Bearer ")) return false;
  return h.slice("Bearer ".length) === want;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolvePromise(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function runToListItem(row: RunEntity): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: row.id,
    status: row.status,
    suite_id: row.suite_id,
    created_at: row.created_at,
  };
  if (row.workspace_root !== undefined) o.workspace_root = row.workspace_root;
  if (row.started_at !== undefined) o.started_at = row.started_at;
  if (row.ended_at !== undefined) o.ended_at = row.ended_at;
  if (row.goal_total !== undefined) o.goal_total = row.goal_total;
  if (row.goal_completed !== undefined) o.goal_completed = row.goal_completed;
  if (row.verdict !== undefined) o.verdict = row.verdict;
  if (row.summary !== undefined) o.summary = row.summary;
  return o;
}

/**
 * HTTP server: `POST /v1/runs`, `GET /v1/runs`, `GET /v1/runs/:id`, `GET /health`.
 * Structured logs on stderr; **`X-Request-Id`** on every response.
 */
export function createRunsApiServer(opts: RunsApiServerOptions): {
  server: Server;
  store: RunsStore;
} {
  const workspaceRoot = resolve(opts.workspaceRoot);
  const maxConcurrent = opts.maxConcurrent ?? 1;
  const { store } = opts;
  let active = 0;

  const rpm = resolveRateLimitRpm(opts);
  const limiter = rpm > 0 ? new MinuteWindowRateLimiter(rpm) : undefined;

  const server = createServer(async (req, res) => {
    const requestId = getOrCreateRequestId(req);
    const t0 = Date.now();
    const method = req.method ?? "GET";
    const path = req.url?.split("?")[0] ?? "/";
    const clientKey = clientRateLimitKey(req);

    const finish = (status: number, extra?: LogFields) => {
      logStructured("info", "runs_api.http_request", {
        request_id: requestId,
        method,
        path,
        status,
        duration_ms: Date.now() - t0,
        client_key: clientKey,
        ...extra,
      });
    };

    try {
      if (limiter !== undefined && !limiter.tryConsume(clientKey)) {
        logStructured("warn", "runs_api.rate_limited", {
          request_id: requestId,
          client_key: clientKey,
          limit_rpm: rpm,
        });
        sendJson(
          res,
          429,
          { error: "rate_limit_exceeded", retry_after_seconds: 60 },
          requestId,
          { "Retry-After": "60" },
        );
        finish(429, { rate_limited: true });
        return;
      }

      if (!authorize(req)) {
        sendJson(res, 401, { error: "unauthorized" }, requestId);
        finish(401);
        return;
      }

      const url = new URL(req.url ?? "/", "http://127.0.0.1/");
      const pathParts = url.pathname.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);

      if (req.method === "GET" && pathParts.length === 1 && pathParts[0] === "health") {
        const body: Record<string, unknown> = {
          ok: true,
          store: store.kind,
          service: "restormel-testing-runs-server",
          version: SERVER_VERSION,
        };
        if (store.ping) {
          try {
            await store.ping();
            body.db = "ok";
          } catch {
            body.db = "error";
          }
        } else {
          body.db = "skipped";
        }
        sendJson(res, 200, body, requestId);
        finish(200);
        return;
      }

      if (req.method === "GET" && pathParts.length === 2 && pathParts[0] === "v1" && pathParts[1] === "runs") {
        const limitRaw = url.searchParams.get("limit") ?? "50";
        const offsetRaw = url.searchParams.get("offset") ?? "0";
        const limit = Math.min(100, Math.max(1, parseInt(limitRaw, 10) || 50));
        const offset = Math.max(0, parseInt(offsetRaw, 10) || 0);
        const { items, next_offset } = await store.list({ limit, offset });
        sendJson(res, 200, {
          items: items.map(runToListItem),
          limit,
          offset,
          next_offset,
        }, requestId);
        finish(200);
        return;
      }

      if (req.method === "GET" && pathParts.length === 3 && pathParts[0] === "v1" && pathParts[1] === "runs") {
        const id = pathParts[2]!;
        const row = await store.get(id);
        if (row === undefined) {
          sendJson(res, 404, { error: "not_found" }, requestId);
          finish(404);
          return;
        }
        const terminal = ["passed", "failed", "indeterminate", "error"].includes(row.status);
        const body: Record<string, unknown> = {
          id: row.id,
          status: row.status,
          suite_id: row.suite_id,
          created_at: row.created_at,
        };
        if (row.workspace_root !== undefined) body.workspace_root = row.workspace_root;
        if (row.started_at !== undefined) body.started_at = row.started_at;
        if (row.ended_at !== undefined) body.ended_at = row.ended_at;
        if (row.goal_total !== undefined) body.goal_total = row.goal_total;
        if (row.goal_completed !== undefined) body.goal_completed = row.goal_completed;
        if (terminal) {
          body.verdict = row.verdict ?? row.status;
          if (row.summary !== undefined) body.summary = row.summary;
          if (row.error_message !== undefined) body.error_message = row.error_message;
          if (row.artifact_dir !== undefined) body.artifact_manifest_hint = row.artifact_dir;
        }
        sendJson(res, 200, body, requestId);
        finish(200);
        return;
      }

      if (req.method === "POST" && pathParts.length === 2 && pathParts[0] === "v1" && pathParts[1] === "runs") {
        const rawText = await readBody(req);
        let rawJson: unknown;
        try {
          rawJson = rawText.length > 0 ? JSON.parse(rawText) : {};
        } catch {
          sendJson(res, 400, { error: "invalid_json" }, requestId);
          finish(400);
          return;
        }
        const parsed = parsePostRunsBody(rawJson);
        if (!parsed.ok) {
          sendJson(res, 400, { error: "validation", message: parsed.message }, requestId);
          finish(400);
          return;
        }
        if (active >= maxConcurrent) {
          sendJson(res, 503, { error: "too_many_concurrent_runs" }, requestId, { "Retry-After": "10" });
          finish(503, { concurrent_cap: true });
          return;
        }

        const row = await store.createQueued(parsed.body.suite_id, workspaceRoot);
        active++;
        logStructured("info", "runs_api.run_enqueued", {
          request_id: requestId,
          run_id: row.id,
          suite_id: parsed.body.suite_id,
        });
        void executeRunInBackground(store, row.id, parsed.body, workspaceRoot).finally(() => {
          active--;
        });

        sendJson(res, 201, {
          id: row.id,
          status: "queued",
          created_at: row.created_at,
        }, requestId);
        finish(201, { run_id: row.id });
        return;
      }

      sendJson(res, 404, { error: "not_found" }, requestId);
      finish(404);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logStructured("error", "runs_api.unhandled_error", { request_id: requestId, error: msg });
      sendJson(res, 500, { error: "internal_error" }, requestId);
      finish(500, { internal_error: true });
    }
  });

  return { server, store };
}

type LogFields = Record<string, string | number | boolean | undefined>;

export function startRunsApiServer(opts: RunsApiServerOptions): Promise<Server> {
  return new Promise((resolvePromise, reject) => {
    const { server } = createRunsApiServer(opts);
    const unix = opts.unixSocketPath?.trim();
    if (unix !== undefined && unix.length > 0) {
      try {
        unlinkSync(unix);
      } catch {
        /* ENOENT */
      }
      server.listen(unix, () => resolvePromise(server));
    } else {
      const host = opts.host ?? "127.0.0.1";
      server.listen(opts.port, host, () => resolvePromise(server));
    }
    server.on("error", reject);
  });
}

export { createRunsStoreFromEnv, runsDatabaseUrlFromEnv } from "./create-store.js";
export type { RunsStore, RunEntity, RunEntityStatus } from "./runs-store.js";
