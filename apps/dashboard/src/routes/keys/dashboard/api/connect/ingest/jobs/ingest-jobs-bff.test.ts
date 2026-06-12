/**
 * Ingest-jobs BFF GET — `?cursor`/`?limit` keyset passthrough (W3.1 / P1-4, M-8).
 *
 * The data layer's keyset was already there; this asserts the BFF actually
 * forwards the URL params (it previously ignored the cursor) and returns the
 * additive `next_cursor` + `total_count` fields.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const listMock = vi.fn();
const countMock = vi.fn();

vi.mock("$lib/server/connect-ingest-jobs", () => ({
  listConnectIngestJobsForWorkspace: (...args: unknown[]) => listMock(...args),
  countConnectIngestJobsForWorkspace: (...args: unknown[]) => countMock(...args),
  // Identity-ish mapper — the BFF only needs it to project rows.
  connectIngestJobRecordToApi: (row: { id: string; createdAt?: string }) => ({
    id: row.id,
    status: "running",
    created_at: row.createdAt ?? "2026-06-12T10:00:00.000Z",
  }),
  insertConnectIngestJob: vi.fn(),
  getConnectIngestJobForWorkspace: vi.fn(),
  appendConnectIngestJobLog: vi.fn(),
  bulkCleanupIngestJobsForWorkspace: vi.fn(),
}));

vi.mock("$lib/server/connect/session-context", () => ({
  resolveKnowledgeSessionContext: vi.fn(async () => ({ workspaceId: "ws-1", projects: [] })),
  isKnowledgeSessionFailure: (ctx: unknown) =>
    typeof ctx === "object" && ctx !== null && "error" in (ctx as Record<string, unknown>),
}));

// Raw data-layer record shape: `pageWithCursor` reads `createdAt` to mint the
// keyset cursor; `connectIngestJobRecordToApi` (mocked) projects it to the API shape.
function row(id: string, createdAt: string) {
  return { id, createdAt };
}

function mockEvent(url: URL) {
  return { locals: {}, url } as unknown as Parameters<
    Awaited<ReturnType<typeof importGet>>
  >[0];
}

async function importGet() {
  const mod = await import("./+server");
  return mod.GET;
}

describe("GET /api/connect/ingest/jobs — keyset passthrough", () => {
  beforeEach(() => {
    listMock.mockReset();
    countMock.mockReset();
    countMock.mockResolvedValue(57);
  });

  it("forwards `limit` and `cursor` to the data layer", async () => {
    listMock.mockResolvedValue([row("a", "2026-06-12T10:00:00.000Z")]);
    const GET = await importGet();
    const url = new URL("http://localhost/api/connect/ingest/jobs?limit=5&cursor=abc123");
    const res = await GET(mockEvent(url));
    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1", limit: 5, cursor: "abc123" }),
    );
  });

  it("defaults to limit 20 / no cursor when params are absent", async () => {
    listMock.mockResolvedValue([]);
    const GET = await importGet();
    const url = new URL("http://localhost/api/connect/ingest/jobs");
    await GET(mockEvent(url));
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceId: "ws-1", limit: 20, cursor: undefined }),
    );
  });

  it("clamps an out-of-range limit (1..100)", async () => {
    listMock.mockResolvedValue([]);
    const GET = await importGet();
    await GET(mockEvent(new URL("http://localhost/api/connect/ingest/jobs?limit=9999")));
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
    listMock.mockClear();
    await GET(mockEvent(new URL("http://localhost/api/connect/ingest/jobs?limit=0")));
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it("returns next_cursor when a further page exists (limit+1 fetched) and the honest total", async () => {
    // limit=2 → data layer fetches 3; helper detects the extra row → next_cursor minted.
    listMock.mockResolvedValue([
      row("a", "2026-06-12T10:00:02.000Z"),
      row("b", "2026-06-12T10:00:01.000Z"),
      row("c", "2026-06-12T10:00:00.000Z"),
    ]);
    const GET = await importGet();
    const res = await GET(mockEvent(new URL("http://localhost/api/connect/ingest/jobs?limit=2")));
    const body = await res.json();
    expect(body.jobs.map((j: { id: string }) => j.id)).toEqual(["a", "b"]);
    expect(typeof body.next_cursor).toBe("string");
    expect(body.total_count).toBe(57);
  });

  it("returns a null next_cursor on the last page", async () => {
    listMock.mockResolvedValue([row("a", "2026-06-12T10:00:00.000Z")]);
    const GET = await importGet();
    const res = await GET(mockEvent(new URL("http://localhost/api/connect/ingest/jobs?limit=2")));
    const body = await res.json();
    expect(body.next_cursor).toBeNull();
  });
});
