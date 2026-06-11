/**
 * Per-key fixed-window rate limit for POST /connect/v1/memory (Stage 3.4).
 *
 * The repo has no shared route rate-limit middleware yet (checked 2026-06-11: existing
 * 429 handling is all upstream-provider backoff), so this is the documented simple
 * per-key window the stage contract allows:
 *
 *   - Window: CONNECT_MEMORY_RATE_WINDOW_MS (default 60s), fixed (not sliding).
 *   - Budget: CONNECT_MEMORY_RATE_LIMIT requests per window per key identity
 *     (default 10 — with CONNECT_MEMORY_MAX_OBSERVATIONS=10 that bounds a single key
 *     to ~100 observations/minute, each still individually judged before persisting).
 *   - Identity: the authenticated key id (gateway/management) — never the raw key —
 *     falling back to authType:userId:projectId for session auth.
 *   - Scope: in-memory, per Node process. The dashboard deploys as a single instance
 *     (Coolify, Stage 2 infra); if it is ever scaled horizontally the budget multiplies
 *     by instance count — acceptable for an abuse guard, revisit with shared storage
 *     (Postgres/Redis) if that happens. Documented in docs/guides/agent-memory-write.md.
 *
 * Fail-closed ordering at the route: auth FIRST, then this limiter — unauthenticated
 * traffic can never consume or probe a key's budget.
 */

export type MemoryRateLimitDecision =
  | { allowed: true; remaining: number }
  | { allowed: false; retryAfterSeconds: number };

const DEFAULT_LIMIT = 10;
const DEFAULT_WINDOW_MS = 60_000;

/** Prune bookkeeping: drop expired windows once the map grows past this many keys. */
const PRUNE_THRESHOLD = 4096;

type WindowState = { windowStartMs: number; count: number };

const windows = new Map<string, WindowState>();

export function memoryRateLimitConfig(): { limit: number; windowMs: number } {
  const rawLimit = Number(process.env.CONNECT_MEMORY_RATE_LIMIT ?? DEFAULT_LIMIT);
  const rawWindow = Number(process.env.CONNECT_MEMORY_RATE_WINDOW_MS ?? DEFAULT_WINDOW_MS);
  return {
    limit:
      Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.floor(rawLimit) : DEFAULT_LIMIT,
    windowMs:
      Number.isFinite(rawWindow) && rawWindow >= 1000
        ? Math.floor(rawWindow)
        : DEFAULT_WINDOW_MS,
  };
}

function pruneExpired(nowMs: number, windowMs: number): void {
  if (windows.size < PRUNE_THRESHOLD) return;
  for (const [key, state] of windows) {
    if (nowMs - state.windowStartMs >= windowMs) windows.delete(key);
  }
}

/**
 * Check (and consume) one request from the key identity's window budget.
 * Deterministic given `nowMs` — injectable for tests.
 */
export function checkMemoryWriteRateLimit(
  identity: string,
  nowMs = Date.now(),
): MemoryRateLimitDecision {
  const { limit, windowMs } = memoryRateLimitConfig();
  pruneExpired(nowMs, windowMs);

  const state = windows.get(identity);
  if (!state || nowMs - state.windowStartMs >= windowMs) {
    windows.set(identity, { windowStartMs: nowMs, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }
  if (state.count >= limit) {
    const retryAfterMs = state.windowStartMs + windowMs - nowMs;
    return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  state.count += 1;
  return { allowed: true, remaining: limit - state.count };
}

/** Test hook: clear all windows (the limiter is module-level state). */
export function resetMemoryWriteRateLimit(): void {
  windows.clear();
}

/**
 * Rate-limit identity for an authenticated memory write. Key id when present (gateway
 * and management keys carry one for audit); session auth falls back to a composite that
 * can never collide with a key id (prefixed). Never derived from raw key material.
 */
export function memoryRateLimitIdentity(args: {
  keyId?: string | null;
  authType: string;
  userId: string;
  projectId: string;
}): string {
  if (args.keyId?.trim()) return `key:${args.keyId.trim()}`;
  return `${args.authType}:${args.userId}:${args.projectId}`;
}
