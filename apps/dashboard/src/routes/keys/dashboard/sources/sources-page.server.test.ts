/**
 * Sources page server load — streaming shape test (nav-pending-fix).
 *
 * Asserts:
 *  1. `panels` is a streaming Promise (not a plain resolved value).
 *  2. Signed-out guard — no user → signed-out shape with immediately-resolving panels.
 *  3. Workspace-lookup failure → signed-in shape, panels resolve to loadFailed=true.
 *  4. Successful load → panels resolve with correct shape (graphs/packs/documents/selectedPackId).
 *  5. Panel-query failure → panels resolve to loadFailed=true (never rejects).
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Module-level mocks (hoisted by Vitest) ─────────────────────────────

vi.mock("$lib/server/session-user", () => ({
  isSignedInSession: vi.fn().mockReturnValue(true),
  sessionUser: vi.fn().mockReturnValue(null),
}));

vi.mock("$lib/server/connect/workspace-cache", () => ({
  requireConnectWorkspace: vi.fn().mockResolvedValue({ id: "ws-sources-1" }),
}));

vi.mock("$lib/server/connect/graph-target-service", () => ({
  listGraphTargetsForUi: vi.fn().mockResolvedValue([{ id: "gt-1", status: "ok" }]),
}));

vi.mock("$lib/server/connect/domain-pack-service", () => ({
  listDomainPacksForUi: vi.fn().mockResolvedValue([{ id: "p-1", title: "Default pack", slug: "default" }]),
  getSelectedDomainPackId: vi.fn().mockResolvedValue("p-1"),
}));

vi.mock("$lib/server/connect/source-documents", () => ({
  listSourceDocuments: vi.fn().mockResolvedValue([
    { id: "d-1", name: "doc.pdf", source_kind: "upload", status: "parsed", char_count: 1200, chunk_count: 4 },
  ]),
}));

vi.mock("$lib/server/connect/source-health", () => ({
  loadSourceHealthSummary: vi.fn().mockResolvedValue({
    cards: [
      { kind: "upload", indexed: 1, failed: 0, pending: 0, lastSyncedAt: "2026-06-20T00:00:00.000Z", status: "healthy" },
    ],
    exceptions: [],
    totals: { indexed: 1, failed: 0, pending: 0, exceptions: 0 },
    lastSyncedAt: "2026-06-20T00:00:00.000Z",
  }),
}));

vi.mock("$lib/debug/server-perf", () => ({
  perfSpan: vi.fn().mockReturnValue(() => {}),
}));

// ── Type helpers ───────────────────────────────────────────────────────

type PanelResult = {
  graphs: { id: string; status: string }[];
  packs: { id: string; title: string; slug: string }[];
  documents: { id: string; name: string; source_kind: string; status: string; char_count: number; chunk_count: number }[];
  health: {
    cards: unknown[];
    exceptions: unknown[];
    totals: { indexed: number; failed: number; pending: number; exceptions: number };
    lastSyncedAt: string | null;
  };
  selectedPackId: string | null;
  loadFailed: boolean;
};

type LoadResult = {
  signedIn: boolean;
  panels: Promise<PanelResult>;
};

// ── Helper ──────────────────────────────────────────────────────────────

async function runLoad(overrides: { locals?: object } = {}): Promise<LoadResult> {
  const { load } = await import("./+page.server");
  const result = await load({
    locals: overrides.locals ?? { user: { uid: "u-src-1", authType: "session" } },
    parent: async () => ({ connectWorkspace: { id: "ws-sources-1", userId: "u-src-1" } }),
    depends: vi.fn(),
    url: new URL("https://restormel.dev/keys/dashboard/sources"),
  } as never);
  return result as LoadResult;
}

// ── Tests ───────────────────────────────────────────────────────────────

describe("Sources page server load — streaming shape (nav-pending-fix)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("panels is a Promise (not a plain value) — SvelteKit can stream it", async () => {
    const result = await runLoad();
    expect(result.panels).toBeInstanceOf(Promise);
  });

  it("panels resolves to the expected shape for a signed-in user with data", async () => {
    const result = await runLoad();
    const panels = await result.panels;
    expect(panels.loadFailed).toBe(false);
    expect(panels.graphs).toHaveLength(1);
    expect(panels.packs).toHaveLength(1);
    expect(panels.packs[0]).toEqual({ id: "p-1", title: "Default pack", slug: "default" });
    expect(panels.documents).toHaveLength(1);
    expect(panels.documents[0].id).toBe("d-1");
    expect(panels.selectedPackId).toBe("p-1");
    // Phase 3 Stage 3 — watched-source health is part of the streamed panels.
    expect(panels.health.totals.indexed).toBe(1);
    expect(panels.health.cards).toHaveLength(1);
    expect(panels.health.exceptions).toEqual([]);
  });

  it("signed-out guard — signedIn false, panels resolves immediately to empty", async () => {
    const { isSignedInSession } = await import("$lib/server/session-user");
    vi.mocked(isSignedInSession).mockReturnValueOnce(false);

    const result = await runLoad({ locals: {} });
    expect(result.signedIn).toBe(false);
    const panels = await result.panels;
    expect(panels.loadFailed).toBe(false);
    expect(panels.graphs).toEqual([]);
    expect(panels.packs).toEqual([]);
    expect(panels.documents).toEqual([]);
    expect(panels.selectedPackId).toBeNull();
  });

  it("workspace-lookup failure → signedIn true, panels resolve with loadFailed=true", async () => {
    const { requireConnectWorkspace } = await import("$lib/server/connect/workspace-cache");
    vi.mocked(requireConnectWorkspace).mockRejectedValueOnce(new Error("DB unavailable"));

    const result = await runLoad();
    expect(result.signedIn).toBe(true);
    const panels = await result.panels;
    expect(panels.loadFailed).toBe(true);
    expect(panels.documents).toEqual([]);
  });

  it("panel-query failure → panels resolve to loadFailed=true (never rejects)", async () => {
    const { listSourceDocuments } = await import("$lib/server/connect/source-documents");
    vi.mocked(listSourceDocuments).mockRejectedValueOnce(new Error("Neon timeout"));

    const result = await runLoad();
    // The Promise must not reject — the page's {:catch} branch handles errors too,
    // but the preferred path is that the catch inside panelsPromise converts errors
    // to loadFailed=true so the Documents section renders the error banner.
    await expect(result.panels).resolves.toMatchObject({ loadFailed: true });
  });

  it("panels result never rejects even when all panel queries fail", async () => {
    const { listGraphTargetsForUi } = await import("$lib/server/connect/graph-target-service");
    const { listDomainPacksForUi } = await import("$lib/server/connect/domain-pack-service");
    const { listSourceDocuments } = await import("$lib/server/connect/source-documents");
    vi.mocked(listGraphTargetsForUi).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(listDomainPacksForUi).mockRejectedValueOnce(new Error("fail"));
    vi.mocked(listSourceDocuments).mockRejectedValueOnce(new Error("fail"));

    const result = await runLoad();
    await expect(result.panels).resolves.toMatchObject({ loadFailed: true });
  });
});
