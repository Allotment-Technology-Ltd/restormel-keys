/**
 * POST /connect/v1/memory handler tests — the security-relevant ORDER of the gate:
 *
 *   1. schema validation (contract size caps) — malformed requests never reach auth,
 *   2. auth (authorizeKnowledgeWorkspaceRequest) — unauthenticated traffic can never
 *      consume or probe a key's rate budget,
 *   3. per-key rate limit — enforced before any store/LLM dependency resolution,
 *   4. dependency resolution (fail-closed 503 propagates verbatim).
 *
 * Plus unit tests for the fixed-window limiter and its identity derivation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./auth.js", () => ({
  authorizeKnowledgeWorkspaceRequest: vi.fn(),
}));
vi.mock("$lib/server/connect/memory-write-service", () => ({
  resolveMemoryWriteDeps: vi.fn(),
  executeConnectMemoryWrite: vi.fn(),
}));

import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import {
  executeConnectMemoryWrite,
  resolveMemoryWriteDeps,
} from "$lib/server/connect/memory-write-service";
import { handleConnectMemoryWrite } from "./memory-handler.js";
import {
  checkMemoryWriteRateLimit,
  memoryRateLimitIdentity,
  resetMemoryWriteRateLimit,
} from "./memory-rate-limit.js";

const WORKSPACE_ID = "550e8400-e29b-41d4-a716-446655440000";

const VALID_BODY = {
  workspace_id: WORKSPACE_ID,
  observations: [
    {
      text: "Paris is the capital of France.",
      evidence: { quote: "Paris is the capital of France" },
    },
  ],
};

const AUTH_OK = {
  userId: "u-1",
  projectId: "p-1",
  workspaceId: WORKSPACE_ID,
  authType: "gateway_key" as const,
};

function locals(user?: Record<string, unknown>): App.Locals {
  return { user } as unknown as App.Locals;
}

describe("handleConnectMemoryWrite ordering", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    resetMemoryWriteRateLimit();
    vi.mocked(authorizeKnowledgeWorkspaceRequest).mockResolvedValue(AUTH_OK);
    vi.mocked(resolveMemoryWriteDeps).mockResolvedValue({
      ok: false,
      status: 503,
      body: { error: "graph_target_not_configured", message: "no store" },
    });
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) delete process.env[key];
    }
    Object.assign(process.env, origEnv);
  });

  it("rejects malformed payloads 400 before auth ever runs", async () => {
    const out = await handleConnectMemoryWrite({
      locals: locals(),
      body: { workspace_id: WORKSPACE_ID, observations: [] },
      requestId: "r-1",
    });
    expect(out.ok).toBe(false);
    expect(out.status).toBe(400);
    expect(authorizeKnowledgeWorkspaceRequest).not.toHaveBeenCalled();
  });

  it("rejects oversize batches 400 (contract cap, ≤10 observations)", async () => {
    const out = await handleConnectMemoryWrite({
      locals: locals(),
      body: {
        workspace_id: WORKSPACE_ID,
        observations: Array.from({ length: 11 }, () => VALID_BODY.observations[0]),
      },
      requestId: "r-2",
    });
    expect(out.status).toBe(400);
  });

  it("propagates auth failures without consuming rate budget", async () => {
    process.env.CONNECT_MEMORY_RATE_LIMIT = "1";
    vi.mocked(authorizeKnowledgeWorkspaceRequest).mockResolvedValue({
      status: 401,
      error: "unauthorized",
      message: "Gateway key or session required",
    });

    // Hammer with unauthenticated requests…
    for (let i = 0; i < 5; i++) {
      const out = await handleConnectMemoryWrite({
        locals: locals(),
        body: VALID_BODY,
        requestId: `r-${i}`,
      });
      expect(out.status).toBe(401);
    }

    // …then the authenticated key still has its full budget.
    vi.mocked(authorizeKnowledgeWorkspaceRequest).mockResolvedValue(AUTH_OK);
    const out = await handleConnectMemoryWrite({
      locals: locals({ keyId: "key-1" }),
      body: VALID_BODY,
      requestId: "r-ok",
    });
    expect(out.status).toBe(503); // reached deps resolution — budget was intact
  });

  it("enforces the per-key rate limit BEFORE dependency resolution", async () => {
    process.env.CONNECT_MEMORY_RATE_LIMIT = "2";

    const first = await handleConnectMemoryWrite({
      locals: locals({ keyId: "key-2" }),
      body: VALID_BODY,
      requestId: "r-a",
    });
    const second = await handleConnectMemoryWrite({
      locals: locals({ keyId: "key-2" }),
      body: VALID_BODY,
      requestId: "r-b",
    });
    expect(first.status).toBe(503);
    expect(second.status).toBe(503);
    expect(resolveMemoryWriteDeps).toHaveBeenCalledTimes(2);

    const third = await handleConnectMemoryWrite({
      locals: locals({ keyId: "key-2" }),
      body: VALID_BODY,
      requestId: "r-c",
    });
    expect(third.ok).toBe(false);
    expect(third.status).toBe(429);
    if (third.ok) return;
    expect(third.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(third.body.error).toBe("rate_limited");
    // Deps were NOT resolved for the limited request — no store/LLM work leaked.
    expect(resolveMemoryWriteDeps).toHaveBeenCalledTimes(2);
  });

  it("rate-limits per key — a different key keeps its own budget", async () => {
    process.env.CONNECT_MEMORY_RATE_LIMIT = "1";
    await handleConnectMemoryWrite({
      locals: locals({ keyId: "key-3" }),
      body: VALID_BODY,
      requestId: "r-a",
    });
    const limited = await handleConnectMemoryWrite({
      locals: locals({ keyId: "key-3" }),
      body: VALID_BODY,
      requestId: "r-b",
    });
    expect(limited.status).toBe(429);

    const other = await handleConnectMemoryWrite({
      locals: locals({ keyId: "key-4" }),
      body: VALID_BODY,
      requestId: "r-c",
    });
    expect(other.status).toBe(503);
  });

  it("passes the submitting key id (audit identity) into the pipeline", async () => {
    vi.mocked(resolveMemoryWriteDeps).mockResolvedValue({
      ok: true,
      deps: {} as never,
    });
    vi.mocked(executeConnectMemoryWrite).mockResolvedValue({
      ok: true,
      status: 200,
      body: {} as never,
    });
    const out = await handleConnectMemoryWrite({
      locals: locals({ keyId: "  key-5  " }),
      body: VALID_BODY,
      requestId: "r-x",
    });
    expect(out.ok).toBe(true);
    expect(vi.mocked(executeConnectMemoryWrite).mock.calls[0][0].keyId).toBe("key-5");
  });
});

describe("memory rate limiter", () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    resetMemoryWriteRateLimit();
  });

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in origEnv)) delete process.env[key];
    }
    Object.assign(process.env, origEnv);
  });

  it("resets the budget when the fixed window expires", () => {
    process.env.CONNECT_MEMORY_RATE_LIMIT = "1";
    process.env.CONNECT_MEMORY_RATE_WINDOW_MS = "1000";
    const t0 = 1_000_000;
    expect(checkMemoryWriteRateLimit("key:k", t0).allowed).toBe(true);
    expect(checkMemoryWriteRateLimit("key:k", t0 + 500).allowed).toBe(false);
    expect(checkMemoryWriteRateLimit("key:k", t0 + 1000).allowed).toBe(true);
  });

  it("reports retry seconds until the window rolls", () => {
    process.env.CONNECT_MEMORY_RATE_LIMIT = "1";
    process.env.CONNECT_MEMORY_RATE_WINDOW_MS = "60000";
    const t0 = 2_000_000;
    checkMemoryWriteRateLimit("key:k", t0);
    const denied = checkMemoryWriteRateLimit("key:k", t0 + 30_000);
    expect(denied.allowed).toBe(false);
    if (denied.allowed) return;
    expect(denied.retryAfterSeconds).toBe(30);
  });

  it("ignores invalid env config and falls back to defaults", () => {
    process.env.CONNECT_MEMORY_RATE_LIMIT = "not-a-number";
    process.env.CONNECT_MEMORY_RATE_WINDOW_MS = "-5";
    // Default budget is 10/60s — 10 requests pass, the 11th is limited.
    const t0 = 3_000_000;
    for (let i = 0; i < 10; i++) {
      expect(checkMemoryWriteRateLimit("key:k", t0 + i).allowed).toBe(true);
    }
    expect(checkMemoryWriteRateLimit("key:k", t0 + 11).allowed).toBe(false);
  });

  it("derives identity from key id, falling back to a session composite", () => {
    expect(
      memoryRateLimitIdentity({ keyId: "abc", authType: "gateway_key", userId: "u", projectId: "p" }),
    ).toBe("key:abc");
    expect(
      memoryRateLimitIdentity({ keyId: null, authType: "session", userId: "u", projectId: "p" }),
    ).toBe("session:u:p");
  });
});
