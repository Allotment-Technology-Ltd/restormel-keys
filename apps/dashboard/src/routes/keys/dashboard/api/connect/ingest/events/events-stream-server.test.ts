/**
 * Live-run SSE endpoint — focused (re)connect catch-up (W3.1 / MAJOR-1).
 *
 * Asserts the resume mechanism end-to-end on the server: a focused connection
 * with `?since=<cursor>` emits a FIRST `snapshot` frame that carries every log
 * line AFTER that cursor plus the advanced `since`, so a reconnect after a 50s
 * budget close (or a hidden-tab gap) loses no log lines. This is what the client's
 * per-connect `urlProvider` resumes against — no `Last-Event-ID`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseLiveRunData, LIVE_RUN_EVENT_NAME } from "$lib/connect/live-run-events";

const getJobMock = vi.fn();
const listLogsMock = vi.fn();
const countLogsMock = vi.fn();

vi.mock("$lib/server/connect-ingest-jobs", () => ({
  getConnectIngestJobForWorkspace: (...a: unknown[]) => getJobMock(...a),
  listConnectIngestJobLogsSince: (...a: unknown[]) => listLogsMock(...a),
  countConnectIngestJobLogs: (...a: unknown[]) => countLogsMock(...a),
  listConnectIngestJobsForWorkspace: vi.fn(async () => []),
  connectIngestJobRecordToApi: (row: Record<string, unknown>) => ({
    id: row.id,
    status: row.status,
    created_at: "2026-06-12T10:00:00.000Z",
  }),
}));

vi.mock("$lib/server/connect/session-context", () => ({
  resolveKnowledgeSessionContext: vi.fn(async () => ({ workspaceId: "ws-1" })),
  isKnowledgeSessionFailure: (ctx: unknown) =>
    typeof ctx === "object" && ctx !== null && "error" in (ctx as Record<string, unknown>),
}));

/** Decode the first SSE data frame from the stream response. */
async function firstFrame(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  // Read until we have one complete event (terminated by a blank line) with data.
  for (let i = 0; i < 50; i += 1) {
    const { value, done } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    const dataLine = buf.split("\n").find((l) => l.startsWith("data: "));
    if (dataLine) {
      void reader.cancel();
      return parseLiveRunData(dataLine.slice(6));
    }
    if (done) break;
  }
  return null;
}

function focusEvent(since: string | null) {
  const url = new URL("http://localhost/api/connect/ingest/events?job=run-1");
  if (since != null) url.searchParams.set("since", since);
  const request = new Request(url, { headers: {} });
  return { locals: {}, url, request } as unknown as Parameters<
    Awaited<ReturnType<typeof importGet>>
  >[0];
}

async function importGet() {
  const mod = await import("./+server");
  return mod.GET;
}

describe("GET /api/connect/ingest/events — focused catch-up snapshot", () => {
  beforeEach(() => {
    getJobMock.mockReset();
    listLogsMock.mockReset();
    countLogsMock.mockReset();
    getJobMock.mockResolvedValue({ id: "run-1", status: "running" });
    countLogsMock.mockResolvedValue(7);
  });

  it("the first frame is a snapshot carrying the catch-up tail after `?since=` and the advanced cursor", async () => {
    // Client reconnects with since=4; server returns lines 5,6,7 (id-ascending).
    listLogsMock.mockResolvedValue([
      { id: 5, line: "[INGEST] line 5", created_at: 5 },
      { id: 6, line: "[INGEST] line 6", created_at: 6 },
      { id: 7, line: "[INGEST] line 7", created_at: 7 },
    ]);
    const GET = await importGet();
    const res = await GET(focusEvent("4"));
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    // The data layer was queried from the cursor the client reconnected with.
    expect(listLogsMock).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: "run-1", sinceId: 4 }),
    );

    const frame = await firstFrame(res);
    expect(frame?.type).toBe("snapshot");
    if (frame?.type !== "snapshot") throw new Error("expected snapshot");
    expect(frame.jobs[0]?.id).toBe("run-1");
    expect(frame.logLines).toEqual(["[INGEST] line 5", "[INGEST] line 6", "[INGEST] line 7"]);
    // `since` advanced to the last fetched id so the NEXT reconnect resumes here.
    expect(frame.since).toBe(7);
    expect(frame.logLineTotal).toBe(7);
  });

  it("still emits a snapshot (no log loss) when nothing is new since the cursor", async () => {
    listLogsMock.mockResolvedValue([]); // caught up — no new lines
    const GET = await importGet();
    const res = await GET(focusEvent("7"));
    const frame = await firstFrame(res);
    // MAJOR-1: the initial frame is ALWAYS a snapshot, even with no new logs, so
    // the console resumes cleanly; `since` holds at the connect cursor.
    expect(frame?.type).toBe("snapshot");
    if (frame?.type !== "snapshot") throw new Error("expected snapshot");
    expect(frame.logLines ?? []).toEqual([]);
    expect(frame.since).toBe(7);
  });

  it("uses a named SSE event line", async () => {
    listLogsMock.mockResolvedValue([]);
    const GET = await importGet();
    const res = await GET(focusEvent("0"));
    const reader = res.body!.getReader();
    const { value } = await reader.read();
    void reader.cancel();
    expect(new TextDecoder().decode(value)).toContain(`event: ${LIVE_RUN_EVENT_NAME}`);
  });
});
