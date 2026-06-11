/**
 * Tests for W3.8 testing-verdict handlers: auth, validation, rate limit,
 * persistence, pagination.
 *
 * All Neon calls are mocked — no database required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TESTING_VERDICT_SCHEMA_VERSION } from "@restormel/contracts";

vi.mock("$lib/server/db", () => ({ getProject: vi.fn(), getProjectInWorkspace: vi.fn() }));
vi.mock("$lib/server/neon", () => ({
  insertTestingVerdict: vi.fn(),
  listTestingVerdicts: vi.fn(),
}));

const workspaceId = "550e8400-e29b-41d4-a716-446655440000";
const projectId = "660e8400-e29b-41d4-a716-446655440001";

const gatewayLocals = {
  user: { uid: "u1", authType: "gateway_key", projectIdForKey: projectId, keyId: "k1" },
} as unknown as App.Locals;

/** Minimal valid TestingVerdictIngest body for tests. */
const minimalBody = {
  schema_version: TESTING_VERDICT_SCHEMA_VERSION,
  suite_id: "my-test-suite",
  evaluated_at: "2026-06-11T10:00:00.000Z",
  pass: true,
  reasons: [],
  source: "ci_action" as const,
};

/** Row shape returned by mocked listTestingVerdicts. */
const sampleRow = {
  id: "1",
  workspaceId,
  evaluatedAt: "2026-06-11T10:00:00.000Z",
  pass: true,
  verdictSchema: TESTING_VERDICT_SCHEMA_VERSION,
  verdict: minimalBody,
  recordedAt: "2026-06-11T10:00:01.000Z",
};

beforeEach(async () => {
  vi.clearAllMocks();

  const { getProject } = await import("$lib/server/db");
  vi.mocked(getProject).mockResolvedValue({
    id: projectId,
    userId: "u1",
    workspaceId,
  } as Awaited<ReturnType<typeof getProject>>);

  const { insertTestingVerdict, listTestingVerdicts } = await import("$lib/server/neon");
  vi.mocked(insertTestingVerdict).mockResolvedValue({
    id: "1",
    recordedAt: "2026-06-11T10:00:01.000Z",
  });
  vi.mocked(listTestingVerdicts).mockResolvedValue([]);

  const { _resetTestingVerdictRateLimit } = await import("./testing-verdict-handler.js");
  _resetTestingVerdictRateLimit();
});

// ── POST handler ─────────────────────────────────────────────────────────────

describe("handlePostTestingVerdict", () => {
  it("400s when workspace_id is missing", async () => {
    const { handlePostTestingVerdict } = await import("./testing-verdict-handler.js");
    const res = await handlePostTestingVerdict({
      locals: gatewayLocals,
      workspaceId: null,
      body: minimalBody,
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("401s when user is not authenticated", async () => {
    const { handlePostTestingVerdict } = await import("./testing-verdict-handler.js");
    const res = await handlePostTestingVerdict({
      locals: { user: null } as unknown as App.Locals,
      workspaceId,
      body: minimalBody,
    });
    expect(res).toMatchObject({ ok: false, status: 401 });
  });

  it("422s when body schema is invalid (missing suite_id)", async () => {
    const { handlePostTestingVerdict } = await import("./testing-verdict-handler.js");
    const { suite_id: _, ...badBody } = minimalBody;
    const res = await handlePostTestingVerdict({
      locals: gatewayLocals,
      workspaceId,
      body: badBody,
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
    if (!res.ok) expect(res.body.error).toBe("validation_error");
  });

  it("422s when schema_version is wrong", async () => {
    const { handlePostTestingVerdict } = await import("./testing-verdict-handler.js");
    const res = await handlePostTestingVerdict({
      locals: gatewayLocals,
      workspaceId,
      body: { ...minimalBody, schema_version: "9.9" },
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("422s when source enum is invalid", async () => {
    const { handlePostTestingVerdict } = await import("./testing-verdict-handler.js");
    const res = await handlePostTestingVerdict({
      locals: gatewayLocals,
      workspaceId,
      body: { ...minimalBody, source: "github" },
    });
    expect(res).toMatchObject({ ok: false, status: 422 });
  });

  it("201s and returns id + recorded_at on success", async () => {
    const { handlePostTestingVerdict } = await import("./testing-verdict-handler.js");
    const res = await handlePostTestingVerdict({
      locals: gatewayLocals,
      workspaceId,
      body: minimalBody,
    });
    expect(res).toMatchObject({ ok: true, status: 201 });
    if (res.ok) {
      expect(res.body.id).toBe("1");
      expect(typeof res.body.recorded_at).toBe("string");
    }
  });

  it("calls insertTestingVerdict with the correct workspace and pass value", async () => {
    const { insertTestingVerdict } = await import("$lib/server/neon");
    const { handlePostTestingVerdict } = await import("./testing-verdict-handler.js");
    await handlePostTestingVerdict({ locals: gatewayLocals, workspaceId, body: minimalBody });
    expect(vi.mocked(insertTestingVerdict)).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId,
        pass: true,
        verdictSchema: TESTING_VERDICT_SCHEMA_VERSION,
      }),
    );
  });

  it("accepts a full body with optional fields", async () => {
    const { handlePostTestingVerdict } = await import("./testing-verdict-handler.js");
    const fullBody = {
      ...minimalBody,
      goals_passed: 8,
      goals_total: 10,
      artifact_ref: "https://example.com/release-pack.zip",
      commit_sha: "abc123",
      repository: "org/repo",
      pr_number: "42",
      reasons: ["test failed"],
      pass: false,
    };
    const res = await handlePostTestingVerdict({
      locals: gatewayLocals,
      workspaceId,
      body: fullBody,
    });
    expect(res).toMatchObject({ ok: true, status: 201 });
  });

  it("429s when rate limit is exceeded", async () => {
    const { handlePostTestingVerdict, _resetTestingVerdictRateLimit } =
      await import("./testing-verdict-handler.js");
    _resetTestingVerdictRateLimit();
    // Exhaust the 20-request window.
    for (let i = 0; i < 20; i++) {
      await handlePostTestingVerdict({ locals: gatewayLocals, workspaceId, body: minimalBody });
    }
    const res = await handlePostTestingVerdict({ locals: gatewayLocals, workspaceId, body: minimalBody });
    expect(res).toMatchObject({ ok: false, status: 429 });
    if (!res.ok) expect(res.body.error).toBe("rate_limited");
  });

  it("500s when the storage layer throws", async () => {
    const { insertTestingVerdict } = await import("$lib/server/neon");
    vi.mocked(insertTestingVerdict).mockRejectedValue(new Error("db error"));
    const { handlePostTestingVerdict } = await import("./testing-verdict-handler.js");
    const res = await handlePostTestingVerdict({ locals: gatewayLocals, workspaceId, body: minimalBody });
    expect(res).toMatchObject({ ok: false, status: 500 });
  });
});

// ── GET handler ──────────────────────────────────────────────────────────────

describe("handleListTestingVerdicts", () => {
  it("400s when workspace_id is missing", async () => {
    const { handleListTestingVerdicts } = await import("./testing-verdict-handler.js");
    const res = await handleListTestingVerdicts({
      locals: gatewayLocals,
      workspaceId: null,
      limit: null,
      beforeId: null,
    });
    expect(res).toMatchObject({ ok: false, status: 400 });
  });

  it("returns empty entries when no verdicts exist", async () => {
    const { handleListTestingVerdicts } = await import("./testing-verdict-handler.js");
    const res = await handleListTestingVerdicts({
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

  it("returns entries shaped as TestingVerdictEntry", async () => {
    const { listTestingVerdicts } = await import("$lib/server/neon");
    vi.mocked(listTestingVerdicts).mockResolvedValue([sampleRow]);
    const { handleListTestingVerdicts } = await import("./testing-verdict-handler.js");
    const res = await handleListTestingVerdicts({
      locals: gatewayLocals,
      workspaceId,
      limit: null,
      beforeId: null,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.entries).toHaveLength(1);
      const entry = res.body.entries[0];
      expect(entry.id).toBe("1");
      expect(entry.workspace_id).toBe(workspaceId);
      expect(entry.verdict.suite_id).toBe("my-test-suite");
    }
  });

  it("sets next_cursor when there are more rows than the page size", async () => {
    const { listTestingVerdicts } = await import("$lib/server/neon");
    const rows = Array.from({ length: 26 }, (_, i) => ({
      ...sampleRow,
      id: String(i + 1),
      evaluatedAt: `2026-06-11T${String(10 - Math.floor(i / 10)).padStart(2, "0")}:00:00.000Z`,
    }));
    vi.mocked(listTestingVerdicts).mockResolvedValue(rows);
    const { handleListTestingVerdicts } = await import("./testing-verdict-handler.js");
    const res = await handleListTestingVerdicts({
      locals: gatewayLocals,
      workspaceId,
      limit: 25,
      beforeId: null,
    });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.entries).toHaveLength(25);
      expect(res.body.next_cursor).toBe("25");
    }
  });

  it("passes beforeId to the storage layer", async () => {
    const { listTestingVerdicts } = await import("$lib/server/neon");
    const { handleListTestingVerdicts } = await import("./testing-verdict-handler.js");
    await handleListTestingVerdicts({
      locals: gatewayLocals,
      workspaceId,
      limit: 10,
      beforeId: "50",
    });
    expect(vi.mocked(listTestingVerdicts)).toHaveBeenCalledWith(
      expect.objectContaining({ beforeId: "50", limit: 11 }),
    );
  });

  it("502s when the storage layer throws", async () => {
    const { listTestingVerdicts } = await import("$lib/server/neon");
    vi.mocked(listTestingVerdicts).mockRejectedValue(new Error("db down"));
    const { handleListTestingVerdicts } = await import("./testing-verdict-handler.js");
    const res = await handleListTestingVerdicts({
      locals: gatewayLocals,
      workspaceId,
      limit: null,
      beforeId: null,
    });
    expect(res).toMatchObject({ ok: false, status: 502 });
  });
});
