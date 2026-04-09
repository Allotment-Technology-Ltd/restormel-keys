import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Honour inbound `X-Request-Id` when it looks like a UUID; else generate. */
export function getOrCreateRequestId(req: IncomingMessage): string {
  const incoming = req.headers["x-request-id"];
  if (typeof incoming === "string") {
    const t = incoming.trim();
    if (t.length > 0 && t.length <= 128 && UUID_RE.test(t)) return t;
  }
  return randomUUID();
}

/**
 * Rate-limit key per client. Set **`RESTORMEL_RUNS_TRUST_PROXY=1`** only behind a trusted proxy
 * that sets **`X-Forwarded-For`**; otherwise clients can spoof the header.
 */
export function clientRateLimitKey(req: IncomingMessage): string {
  if (process.env.RESTORMEL_RUNS_TRUST_PROXY === "1") {
    const xff = req.headers["x-forwarded-for"];
    if (typeof xff === "string") {
      const first = xff.split(",")[0]?.trim();
      if (first) return `xff:${first}`;
    }
  }
  const ra = req.socket.remoteAddress;
  return ra ?? "unknown";
}
