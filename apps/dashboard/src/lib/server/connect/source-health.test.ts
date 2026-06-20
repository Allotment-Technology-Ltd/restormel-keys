/**
 * Phase 3 Stage 3 — source-health aggregation unit tests.
 *
 * Pure aggregation of already-persisted documents + runs into health cards + an
 * exceptions queue. Mocks the two data-layer readers; asserts the derived shape,
 * the failure-first ordering, and that the queue surfaces only what needs a human.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("$lib/server/neon", () => ({
  listConnectSourceDocumentsForWorkspace: vi.fn(),
}));

vi.mock("$lib/server/connect-ingest-jobs", () => ({
  listConnectIngestJobsForWorkspace: vi.fn(),
}));

import { loadSourceHealthSummary } from "./source-health";
import { listConnectSourceDocumentsForWorkspace } from "$lib/server/neon";
import { listConnectIngestJobsForWorkspace } from "$lib/server/connect-ingest-jobs";

const docsMock = vi.mocked(listConnectSourceDocumentsForWorkspace);
const runsMock = vi.mocked(listConnectIngestJobsForWorkspace);

function doc(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "d-" + Math.random().toString(36).slice(2, 8),
    workspaceId: "ws-1",
    sourceKind: "upload",
    name: "doc.md",
    mime: null,
    url: null,
    provenance: null,
    text: null,
    charCount: 100,
    chunkCount: 2,
    status: "parsed",
    error: null,
    parserProvider: "builtin",
    createdAt: Date.parse("2026-06-20T10:00:00.000Z"),
    ...over,
  } as never;
}

function run(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "r-" + Math.random().toString(36).slice(2, 8),
    workspaceId: "ws-1",
    status: "completed",
    label: "Run",
    error: null,
    createdAt: Date.parse("2026-06-20T09:00:00.000Z"),
    updatedAt: Date.parse("2026-06-20T09:05:00.000Z"),
    ...over,
  } as never;
}

beforeEach(() => {
  vi.clearAllMocks();
  runsMock.mockResolvedValue([]);
});

describe("loadSourceHealthSummary", () => {
  it("aggregates documents into per-kind health cards (indexed / failed / pending)", async () => {
    docsMock.mockResolvedValue([
      doc({ sourceKind: "upload", status: "parsed" }),
      doc({ sourceKind: "upload", status: "parsed" }),
      doc({ sourceKind: "url", status: "pending" }),
    ]);

    const s = await loadSourceHealthSummary("ws-1");
    const upload = s.cards.find((c) => c.kind === "upload");
    const url = s.cards.find((c) => c.kind === "url");

    expect(upload).toMatchObject({ indexed: 2, failed: 0, pending: 0, status: "healthy" });
    expect(url).toMatchObject({ indexed: 0, failed: 0, pending: 1, status: "syncing" });
    expect(s.totals).toMatchObject({ indexed: 2, pending: 1, failed: 0 });
  });

  it("marks a kind with failures as attention and floats it to the top", async () => {
    docsMock.mockResolvedValue([
      doc({ sourceKind: "upload", status: "parsed" }),
      doc({ sourceKind: "url", status: "failed", error: "Fetch failed (HTTP 404)." }),
    ]);

    const s = await loadSourceHealthSummary("ws-1");
    expect(s.cards[0].kind).toBe("url");
    expect(s.cards[0].status).toBe("attention");
    expect(s.cards[0].failed).toBe(1);
  });

  it("surfaces failed documents AND failed runs in the exceptions queue, newest first", async () => {
    docsMock.mockResolvedValue([
      doc({
        id: "d-fail",
        status: "failed",
        name: "broken.pdf",
        error: "Parse failed: unsupported.",
        createdAt: Date.parse("2026-06-20T11:00:00.000Z"),
      }),
    ]);
    runsMock.mockResolvedValue([
      run({
        id: "r-fail",
        status: "failed",
        label: "Nightly ingest",
        error: "graph_target_not_configured",
        updatedAt: Date.parse("2026-06-20T12:00:00.000Z"),
      }),
    ]);

    const s = await loadSourceHealthSummary("ws-1");
    expect(s.exceptions).toHaveLength(2);
    // Run failed later → first.
    expect(s.exceptions[0]).toMatchObject({ type: "run", id: "r-fail", error: "graph_target_not_configured" });
    expect(s.exceptions[1]).toMatchObject({ type: "document", id: "d-fail" });
    expect(s.totals.exceptions).toBe(2);
  });

  it("returns a clear queue when nothing failed", async () => {
    docsMock.mockResolvedValue([doc({ status: "parsed" })]);
    runsMock.mockResolvedValue([run({ status: "completed" })]);

    const s = await loadSourceHealthSummary("ws-1");
    expect(s.exceptions).toEqual([]);
    expect(s.totals.exceptions).toBe(0);
  });

  it("reports the most recent sync timestamp across kinds", async () => {
    docsMock.mockResolvedValue([
      doc({ sourceKind: "upload", createdAt: Date.parse("2026-06-20T08:00:00.000Z") }),
      doc({ sourceKind: "url", createdAt: Date.parse("2026-06-20T14:00:00.000Z") }),
    ]);

    const s = await loadSourceHealthSummary("ws-1");
    expect(s.lastSyncedAt).toBe("2026-06-20T14:00:00.000Z");
  });

  it("caps the exceptions queue at the requested limit (most-recent first)", async () => {
    docsMock.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) =>
        doc({
          id: `d-${i}`,
          status: "failed",
          error: `err ${i}`,
          createdAt: Date.parse("2026-06-20T00:00:00.000Z") + i * 1000,
        }),
      ),
    );

    const s = await loadSourceHealthSummary("ws-1", { exceptionLimit: 3 });
    expect(s.exceptions).toHaveLength(3);
    // Newest first → d-9, d-8, d-7.
    expect(s.exceptions.map((e) => e.id)).toEqual(["d-9", "d-8", "d-7"]);
    // Total reflects all failures, not just the rendered slice.
    expect(s.totals.exceptions).toBe(10);
  });
});
