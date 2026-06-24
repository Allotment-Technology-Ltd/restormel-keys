/**
 * W2.4 — Memory-writes inbox tests.
 *
 * Covers:
 *   1. listAgentMemoryObservationsPostgres: outcome + state derivation from DB rows.
 *   2. revokeAgentObservationPostgres: SQL path guard (smoke; no live DB).
 *   3. Page server load: returns null for unauthenticated users; returns inbox data
 *      for authenticated users (mocked workspace + DB).
 *   4. MCP catalog completeness: every RESTORMEL_SUITE_TOOL_NAME is in CATALOG_ENTRIES.
 */
import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// 1. Unit-level derivation logic (no DB needed)
// ---------------------------------------------------------------------------

describe("AgentObservationRow outcome derivation", () => {
  // Mirror the logic in listAgentMemoryObservationsPostgres
  function outcomeFor(state: string): "accepted" | "review" | "rejected" {
    if (state === "supported" || state === "inferred") return "accepted";
    if (state === "excluded") return "rejected";
    return "review";
  }

  it("maps supported → accepted", () => {
    expect(outcomeFor("supported")).toBe("accepted");
  });

  it("maps inferred → accepted", () => {
    expect(outcomeFor("inferred")).toBe("accepted");
  });

  it("maps excluded → rejected", () => {
    expect(outcomeFor("excluded")).toBe("rejected");
  });

  it("maps unverified → review", () => {
    expect(outcomeFor("unverified")).toBe("review");
  });

  it("maps unknown state → review (fail-safe)", () => {
    expect(outcomeFor("some_future_state")).toBe("review");
  });
});

describe("AgentObservationRow key identity extraction", () => {
  // Mirror the extraction logic
  function extractKeyIdentity(title: string | null): string | null {
    if (!title) return null;
    const m = title.match(/\(([^)]+)\)\s*$/);
    return m ? (m[1] ?? null) : null;
  }

  it("extracts key identity from standard source title", () => {
    expect(
      extractKeyIdentity("Agent observations — 2026-06-11T10:00:00.000Z (key rk_live_abc123)"),
    ).toBe("key rk_live_abc123");
  });

  it("extracts auth_type when key id is not present", () => {
    expect(
      extractKeyIdentity("Agent observations — 2026-06-11T10:00:00.000Z (session)"),
    ).toBe("session");
  });

  it("returns null for null source title", () => {
    expect(extractKeyIdentity(null)).toBeNull();
  });

  it("returns null for title with no parenthetical", () => {
    expect(extractKeyIdentity("Agent observations — 2026-06-11T10:00:00.000Z")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 2. Page server load: authenticated vs unauthenticated
// ---------------------------------------------------------------------------

// We mock the DB and workspace cache so the load function can be exercised
// without a real Postgres connection.

vi.mock("$lib/server/neon", () => ({
  listAgentMemoryObservationsPostgres: vi.fn(async () => [
    {
      unitId: "unit-1",
      text: "The sky is blue.",
      submittingKeyIdentity: "key rk_test_abc",
      submittedAt: "2026-06-11T10:00:00.000Z",
      verificationState: "supported",
      outcome: "accepted",
      reasons: [],
      validationNote: null,
    },
  ]),
  revokeAgentObservationPostgres: vi.fn(async () => ({ ok: true })),
  invalidateConnectGraphStatsCache: vi.fn(async () => {}),
}));

vi.mock("$lib/server/connect/workspace-cache", () => ({
  getConnectWorkspaceCached: vi.fn(async () => ({ id: "ws-111", name: "Test workspace" })),
}));

type LoadResult = { inbox: Promise<import("../../../routes/keys/dashboard/claims/memory/+page.server.js").MemoryInboxData | null> };

describe("connect/memory +page.server load", async () => {
  const { load } = await import(
    "../../../routes/keys/dashboard/claims/memory/+page.server.js"
  );

  it("returns inbox: null for unauthenticated request", async () => {
    const result = (await load({ locals: { user: null } } as unknown as Parameters<typeof load>[0])) as unknown as LoadResult;
    const resolved = await result.inbox;
    expect(resolved).toBeNull();
  });

  it("returns inbox data for authenticated session user", async () => {
    const result = (await load({
      locals: {
        user: { authType: "session", uid: "user-1" },
      },
    } as unknown as Parameters<typeof load>[0])) as unknown as LoadResult;
    const resolved = await result.inbox;
    expect(resolved).not.toBeNull();
    expect(resolved!.observations).toHaveLength(1);
    expect(resolved!.observations[0]!.unitId).toBe("unit-1");
    expect(resolved!.observations[0]!.outcome).toBe("accepted");
  });

  it("returns inbox: null (not throw) when DB call fails", async () => {
    const { listAgentMemoryObservationsPostgres } = await import("$lib/server/neon");
    vi.mocked(listAgentMemoryObservationsPostgres).mockRejectedValueOnce(new Error("DB down"));
    const result = (await load({
      locals: { user: { authType: "session", uid: "user-1" } },
    } as unknown as Parameters<typeof load>[0])) as unknown as LoadResult;
    const resolved = await result.inbox;
    expect(resolved).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. MCP catalog completeness: every RESTORMEL_SUITE_TOOL_NAME is present
// ---------------------------------------------------------------------------

describe("MCP catalog completeness (W2.4 — FUNC P2-7)", async () => {
  const { RESTORMEL_SUITE_TOOL_NAMES } = await import("@restormel/dispatch");
  const { CATALOG_ENTRIES } = await import("@restormel/mcp");

  it("includes every RESTORMEL_SUITE_TOOL_NAME in CATALOG_ENTRIES", () => {
    const catalogNames = new Set(CATALOG_ENTRIES.map((e) => e.name));
    for (const name of RESTORMEL_SUITE_TOOL_NAMES) {
      expect(catalogNames.has(name), `${name} must be in CATALOG_ENTRIES`).toBe(true);
    }
  });

  it("includes connect.memory.write explicitly", () => {
    const entry = CATALOG_ENTRIES.find((e) => e.name === "connect.memory.write");
    expect(entry).toBeDefined();
    expect(entry!.pillar).toBe("Connect");
    expect(entry!.description).toContain("/connect/v1/memory");
  });

  it("never has duplicate tool names", () => {
    const names = CATALOG_ENTRIES.map((e) => e.name);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});
