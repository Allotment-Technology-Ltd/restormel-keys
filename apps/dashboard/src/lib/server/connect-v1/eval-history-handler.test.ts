/**
 * Tests for Stage 2.4 eval-history handlers: auth, validation, persistence, pagination.
 *
 * All Neon calls are mocked — no database required. The tests drive the real handler
 * logic (schema validation, auth delegation, storage calls, response shaping).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CONNECT_EVAL_VERDICT_SCHEMA_VERSION } from "@restormel/contracts";

vi.mock("$lib/server/db", () => ({ getProject: vi.fn(), getProjectInWorkspace: vi.fn() }));
vi.mock("$lib/server/neon", () => ({
  insertConnectEvalVerdict: vi.fn(),
  listConnectEvalVerdicts: vi.fn(),
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "660e8400-e29b-41d4-a716-446655440001";

const gatewayLocals = {
  user: { uid: "u1", authType: "gateway_key", projectIdForKey: projectId, keyId: "k1" },
} as unknown as App.Locals;

const sessionLocals = {
  user: { uid: "u1", authType: "session" },
} as unknown as App.Locals;

/** Minimal valid ConnectEvalVerdict for test bodies. */
const minimalVerdict = {
  schema_version: CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
  evaluated_at: "2026-06-10T12:00:00.000Z",
  source: { kind: "counts_file" as const },
  g2: { ok: 90, weak: 5, unsupported: 5, ok_pct: 90, unsupported_pct: 5 },
  targets: { ok_pct_min: 90, unsupported_pct_max: 2 },
  pass: false,
  reasons: ["unsupported_pct 5 exceeds max 2"],
};

const validPostBody = {
  source: "cli" as const,
  verdict: minimalVerdict,
};

beforeEach(async () => {
  vi.clearAllMocks();
  const { getProject } = await import("$lib/server/db");
  vi.mocked(getProject).mockResolvedValue({
    id: projectId,
    userId: "u1",
    workspaceId,
  } as Awaited<ReturnType<typeof getProject>>);

  const { insertConnectEvalVerdict, listConnectEvalVerdicts } = await import("$lib/server/neon");
  vi.mocked(insertConnectEvalVerdict).mockResolvedValue({
    id: "123",
    recordedAt: "2026-06-10T12:00:01.000Z",
  });
  vi.mocked(listConnectEvalVerdicts).mockResolvedValue([]);
});

// ── POST handler ─────────────────────────────────────────────────────────────

describe("handlePostEvalVerdict", () => {
  it("400s when workspace_id is missing", async () => {
    const { handlePostEvalVerdict } = await import("./eval-history-handler.js");
    const res = await handlePostEvalVerdict({
      locals: gatewayLocals,
      workspaceId: null,
      body: validPostBody,
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("401s when user is not authenticated", async () => {
    const { handlePostEvalVerdict } = await import("./eval-history-handler.js");
    const res = await handlePostEvalVerdict({
      locals: { user: null } as unknown as App.Locals,
      workspaceId,
      body: validPostBody,
    });
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it("422s when body schema is invalid", async () => {
    const { handlePostEvalVerdict } = await import("./eval-history-handler.js");
    const res = await handlePostEvalVerdict({
      locals: gatewayLocals,
      workspaceId,
      body: { source: "cli" }, // missing verdict
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
    if (!res.ok) expect(res.body.error).toBe("validation_error");
  });

  it("422s when source enum is invalid", async () => {
    const { handlePostEvalVerdict } = await import("./eval-history-handler.js");
    const res = await handlePostEvalVerdict({
      locals: gatewayLocals,
      workspaceId,
      body: { ...validPostBody, source: "unknown_source" },
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("201s and returns id + recorded_at on success with gateway key", async () => {
    const { handlePostEvalVerdict } = await import("./eval-history-handler.js");
    const res = await handlePostEvalVerdict({
      locals: gatewayLocals,
      workspaceId,
      body: validPostBody,
    });
    expect(res).toMatchObject({ ok: true, status: 201 });
    if (res.ok) {
      expect(res.body.id).toBe("123");
      expect(typeof res.body.recorded_at).toBe("string");
    }
  });

  it("calls insertConnectEvalVerdict with the correct workspace and verdict", async () => {
    const { insertConnectEvalVerdict } = await import("$lib/server/neon");
    const { handlePostEvalVerdict } = await import("./eval-history-handler.js");
    await handlePostEvalVerdict({ locals: gatewayLocals, workspaceId, body: validPostBody });
    expect(vi.mocked(insertConnectEvalVerdict)).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        source: "cli",
        pass: false,
        verdictSchema: CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
      }),
    );
  });

  it("persists the optional diff when provided", async () => {
    const { insertConnectEvalVerdict } = await import("$lib/server/neon");
    const { handlePostEvalVerdict } = await import("./eval-history-handler.js");
    const diff = {
      schema_version: "1.0" as const,
      compared_at: "2026-06-10T12:00:00.000Z",
      baseline_saved_at: "2026-06-09T12:00:00.000Z",
      fingerprint_changed: false,
      tolerance: 2,
      deltas: { ok_pct: -1, unsupported_pct: 1 },
      claims_compared: false,
      new_unsupported_claims: [],
      regression: false,
      regressions: [],
    };
    await handlePostEvalVerdict({
      locals: gatewayLocals,
      workspaceId,
      body: { ...validPostBody, diff },
    });
    expect(vi.mocked(insertConnectEvalVerdict)).toHaveBeenCalledWith(
      expect.objectContaining({ diff }),
    );
  });

  it("500s when the storage layer throws", async () => {
    const { insertConnectEvalVerdict } = await import("$lib/server/neon");
    vi.mocked(insertConnectEvalVerdict).mockRejectedValue(new Error("db error"));
    const { handlePostEvalVerdict } = await import("./eval-history-handler.js");
    const res = await handlePostEvalVerdict({ locals: gatewayLocals, workspaceId, body: validPostBody });
    expect(res).toMatchObject({ ok: false, status: 500 });
  });
});

// ── GET handler ──────────────────────────────────────────────────────────────

describe("handleListEvalVerdicts", () => {
  it("400s when workspace_id is missing", async () => {
    const { handleListEvalVerdicts } = await import("./eval-history-handler.js");
    const res = await handleListEvalVerdicts({
      locals: sessionLocals,
      workspaceId: null,
      limit: null,
      beforeId: null,
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("returns an empty entries array when no verdicts exist", async () => {
    const { handleListEvalVerdicts } = await import("./eval-history-handler.js");
    const res = await handleListEvalVerdicts({
      locals: gatewayLocals,
      workspaceId,
      limit: null,
      beforeId: null,
    });
    expect(res).toMatchObject({ ok: true, status: 200 });
    if (res.ok) {
      expect(res.body.entries).toEqual([]);
      expect(res.body.next_cursor).toBeUndefined();
    }
  });

  it("returns entries shaped as ConnectEvalVerdictEntry", async () => {
    const { listConnectEvalVerdicts } = await import("$lib/server/neon");
    vi.mocked(listConnectEvalVerdicts).mockResolvedValue([
      {
        id: "42",
        workspaceId,
        source: "cli",
        evaluatedAt: "2026-06-10T12:00:00.000Z",
        pass: true,
        verdictSchema: "1.0",
        verdict: minimalVerdict,
        diff: null,
        recordedAt: "2026-06-10T12:00:01.000Z",
        sourceRunId: null,
      },
    ]);
    const { handleListEvalVerdicts } = await import("./eval-history-handler.js");
    const res = await handleListEvalVerdicts({
      locals: gatewayLocals,
      workspaceId,
      limit: null,
      beforeId: null,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.entries).toHaveLength(1);
      const entry = res.body.entries[0];
      expect(entry.id).toBe("42");
      expect(entry.source).toBe("cli");
      expect(entry.workspace_id).toBe(workspaceId);
    }
  });

  it("sets next_cursor when there are more rows than the page size", async () => {
    const { listConnectEvalVerdicts } = await import("$lib/server/neon");
    // Return pageSize+1 rows to trigger pagination (pageSize defaults to 25).
    const rows = Array.from({ length: 26 }, (_, i) => ({
      id: String(i + 1),
      workspaceId,
      source: "cli",
      evaluatedAt: `2026-06-${String(10 - Math.floor(i / 10)).padStart(2, "0")}T12:00:00.000Z`,
      pass: true,
      verdictSchema: "1.0",
      verdict: minimalVerdict,
      diff: null,
      recordedAt: `2026-06-${String(10 - Math.floor(i / 10)).padStart(2, "0")}T12:00:01.000Z`,
      sourceRunId: null,
    }));
    vi.mocked(listConnectEvalVerdicts).mockResolvedValue(rows);
    const { handleListEvalVerdicts } = await import("./eval-history-handler.js");
    const res = await handleListEvalVerdicts({
      locals: gatewayLocals,
      workspaceId,
      limit: 25,
      beforeId: null,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.entries).toHaveLength(25);
      expect(res.body.next_cursor).toBe("25"); // id of the last included row
    }
  });

  it("passes beforeId to the storage layer for cursor-based pagination", async () => {
    const { listConnectEvalVerdicts } = await import("$lib/server/neon");
    const { handleListEvalVerdicts } = await import("./eval-history-handler.js");
    await handleListEvalVerdicts({
      locals: gatewayLocals,
      workspaceId,
      limit: 10,
      beforeId: "50",
    });
    expect(vi.mocked(listConnectEvalVerdicts)).toHaveBeenCalledWith(
      expect.objectContaining({ beforeId: "50", limit: 11 }),
    );
  });

  it("502s when the storage layer throws", async () => {
    const { listConnectEvalVerdicts } = await import("$lib/server/neon");
    vi.mocked(listConnectEvalVerdicts).mockRejectedValue(new Error("db down"));
    const { handleListEvalVerdicts } = await import("./eval-history-handler.js");
    const res = await handleListEvalVerdicts({
      locals: gatewayLocals,
      workspaceId,
      limit: null,
      beforeId: null,
    });
    expect(res).toMatchObject({ ok: false, status: 502 });
  });
});
