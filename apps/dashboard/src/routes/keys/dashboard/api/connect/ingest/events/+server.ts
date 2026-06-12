/**
 * GET /keys/dashboard/api/connect/ingest/events — workspace live-run SSE (Stage W3.1).
 *
 * ONE channel replacing the per-surface status polling: the topbar chip, the runs
 * list, and the run console all subscribe here. Auth is identical to the polled
 * endpoints (session → workspace; no UUIDs in the URL).
 *
 * Frames (see `$lib/connect/live-run-events`):
 *  - `snapshot`  — full workspace run set on connect + when the set changes
 *  - `delta`     — one run's status/progress changed; carries new log lines when a
 *                  single run is focused (`?job=<id>`, the console's case)
 *  - `heartbeat` — keep-alive + live clock; bare SSE comments also pad idle gaps
 *
 * Lifetime: the stream self-closes at STREAM_BUDGET_MS (50s) — under the Vercel
 * Hobby 60s function ceiling — and the client reconnects. Resume carries no
 * `Last-Event-ID`: the client rebuilds its URL per connect with the console's
 * CURRENT log `since`, the server seeds `logSince` from that `?since=`, and the
 * FIRST focused frame is a `snapshot` carrying every log line after that cursor
 * (plus the new `since`). So a 50s reconnect or a hidden-tab gap loses no log
 * lines — the snapshot replays the gap from the cursor the client last advanced
 * to. On adapter-node (Coolify) the same loop simply re-establishes every 50s
 * with no user-visible churn. The server tick is bounded by the budget, so this
 * adds no unbounded background polling (X8 poll-diet: the existing 30s/2.5s polls
 * become the documented fallback, not a second live path).
 */
import {
  connectIngestJobRecordToApi,
  listConnectIngestJobsForWorkspace,
  getConnectIngestJobForWorkspace,
  listConnectIngestJobLogsSince,
  countConnectIngestJobLogs,
} from "$lib/server/connect-ingest-jobs";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import {
  encodeLiveRunFrame,
  encodeSseComment,
  STREAM_BUDGET_MS,
  STREAM_HEARTBEAT_MS,
  STREAM_TICK_FOCUSED_ACTIVE_MS,
  STREAM_TICK_FOCUSED_IDLE_MS,
  STREAM_TICK_WORKSPACE_ACTIVE_MS,
  STREAM_TICK_WORKSPACE_IDLE_MS,
  type LiveRunEventJob,
  type LiveRunStreamEvent,
} from "$lib/connect/live-run-events";
import type { RequestHandler } from "./$types";

// Keep the function in the Node runtime so the ReadableStream + timers behave
// (matches the proof stream + the drain endpoint).
export const config = { runtime: "nodejs22.x" as const };

/** Fields that decide whether a run row materially changed (avoids noisy deltas). */
function jobFingerprint(j: LiveRunEventJob): string {
  return [
    j.id,
    j.status,
    j.current_stage ?? "",
    j.progress?.percent ?? "",
    j.worker_heartbeat_at ?? "",
    j.lease_expires_at ?? "",
    j.reclaim_count ?? "",
  ].join("|");
}

function isActive(status: string): boolean {
  return status === "pending" || status === "running";
}

async function loadWorkspaceJobs(workspaceId: string): Promise<LiveRunEventJob[]> {
  // The chip + list only need the most-recent runs; the live set is small.
  const rows = await listConnectIngestJobsForWorkspace({ workspaceId, limit: 50 });
  return rows.map((row) => connectIngestJobRecordToApi(row) as LiveRunEventJob);
}

export const GET: RequestHandler = async ({ locals, url, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals, { includeProjects: false });
  if (isKnowledgeSessionFailure(ctx)) {
    return new Response("Unauthorized", { status: 401 });
  }
  const workspaceId = ctx.workspaceId;

  // Optional single-run focus (the run console) — streams that run's log tail too.
  const focusJobId = url.searchParams.get("job");
  // The console passes its CURRENT log cursor on every (re)connect via `?since=`
  // (the client rebuilds the URL per connect). We seed the server cursor from it
  // and the first snapshot replays everything after it — that is the resume
  // mechanism (no Last-Event-ID; the stream `id:` is a sequence, not a log id).
  const sinceParam = url.searchParams.get("since");
  let logSince = sinceParam != null ? Math.max(0, Number.parseInt(sinceParam, 10) || 0) : 0;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let cursor = 0;
      let lastFingerprints = new Map<string, string>();
      let tickTimer: ReturnType<typeof setTimeout> | null = null;
      let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
      let budgetTimer: ReturnType<typeof setTimeout> | null = null;

      const teardown = (): void => {
        if (tickTimer) clearTimeout(tickTimer);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        if (budgetTimer) clearTimeout(budgetTimer);
        tickTimer = heartbeatTimer = budgetTimer = null;
      };
      const close = (): void => {
        if (closed) return;
        closed = true;
        teardown();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      const send = (event: LiveRunStreamEvent): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeLiveRunFrame(event)));
        } catch {
          close();
        }
      };
      const comment = (): void => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(encodeSseComment()));
        } catch {
          close();
        }
      };

      // Abort promptly when the client disconnects (back/forward, tab close).
      request.signal.addEventListener("abort", close);

      // Tracks whether the most recent tick saw anything active, so the next tick
      // can slow down when the workspace/run is idle (keeps the chip stream open
      // without hammering Neon).
      let lastSawActive = true;

      const emitSnapshot = (jobs: LiveRunEventJob[]): void => {
        cursor += 1;
        lastFingerprints = new Map(jobs.map((j) => [j.id, jobFingerprint(j)]));
        send({ type: "snapshot", jobs, cursor });
      };

      const emitWorkspaceDeltas = (jobs: LiveRunEventJob[]): void => {
        // Detect set churn (added/removed runs) → re-snapshot; otherwise per-run deltas.
        const sameSet =
          jobs.length === lastFingerprints.size && jobs.every((j) => lastFingerprints.has(j.id));
        if (!sameSet) {
          emitSnapshot(jobs);
          return;
        }
        for (const j of jobs) {
          if (lastFingerprints.get(j.id) !== jobFingerprint(j)) {
            cursor += 1;
            lastFingerprints.set(j.id, jobFingerprint(j));
            send({ type: "delta", job: j, cursor });
          }
        }
      };

      /**
       * Focused stream (run console): query ONLY the focused run + its log tail —
       * never the whole workspace list. Three Neon queries/tick at most, identical
       * to the pre-W3.1 /status poll, but pushed instead of pulled.
       */
      const tickFocused = async (initial: boolean): Promise<void> => {
        const [row, logRows, logTotal] = await Promise.all([
          getConnectIngestJobForWorkspace({ jobId: focusJobId!, workspaceId }),
          listConnectIngestJobLogsSince({
            jobId: focusJobId!,
            sinceId: logSince > 0 ? logSince : undefined,
          }),
          countConnectIngestJobLogs(focusJobId!),
        ]);
        if (!row) {
          lastSawActive = false;
          return;
        }
        const apiJob = connectIngestJobRecordToApi(row) as LiveRunEventJob;
        lastSawActive = isActive(apiJob.status);
        const fp = jobFingerprint(apiJob);
        const changed = initial || lastFingerprints.get(apiJob.id) !== fp;
        const newLogs = logRows.length > 0;
        // The initial frame is ALWAYS sent so the console resumes its tail on
        // every reconnect: it carries the catch-up `logLines` (everything after
        // the `?since=` the client connected with) and the advanced `since`, even
        // when the run's fingerprint hasn't changed. Deltas are sent only on
        // actual change or new logs (cheap steady state).
        if (newLogs) logSince = logRows[logRows.length - 1]!.id;
        if (initial || changed || newLogs) {
          lastFingerprints.set(apiJob.id, fp);
          cursor += 1;
          if (initial) {
            send({
              type: "snapshot",
              jobs: [apiJob],
              ...(newLogs ? { logLines: logRows.map((r) => r.line) } : {}),
              logLineTotal: logTotal,
              since: logSince,
              cursor,
            });
          } else {
            send({
              type: "delta",
              job: apiJob,
              ...(newLogs
                ? { logLines: logRows.map((r) => r.line), logLineTotal: logTotal, since: logSince }
                : {}),
              cursor,
            });
          }
        }
      };

      /** Workspace stream (chip / runs list): one list query/tick → snapshot or deltas. */
      const tickWorkspace = async (initial: boolean): Promise<void> => {
        const jobs = await loadWorkspaceJobs(workspaceId);
        lastSawActive = jobs.some((j) => isActive(j.status));
        if (initial) emitSnapshot(jobs);
        else emitWorkspaceDeltas(jobs);
      };

      const tick = async (initial: boolean): Promise<void> => {
        if (closed) return;
        try {
          if (focusJobId) await tickFocused(initial);
          else await tickWorkspace(initial);
        } catch {
          // Transient data-layer error: heartbeat so the client keeps the connection
          // (and its last-known state) rather than flapping to fallback.
          cursor += 1;
          send({ type: "heartbeat", nowMs: Date.now(), cursor });
        }

        if (closed) return;
        const delay = focusJobId
          ? lastSawActive
            ? STREAM_TICK_FOCUSED_ACTIVE_MS
            : STREAM_TICK_FOCUSED_IDLE_MS
          : lastSawActive
            ? STREAM_TICK_WORKSPACE_ACTIVE_MS
            : STREAM_TICK_WORKSPACE_IDLE_MS;
        tickTimer = setTimeout(() => void tick(false), delay);
      };

      // Heartbeat: refresh the client clock + keep proxies from idling us out.
      heartbeatTimer = setInterval(() => {
        if (closed) return;
        cursor += 1;
        send({ type: "heartbeat", nowMs: Date.now(), cursor });
        comment();
      }, STREAM_HEARTBEAT_MS);

      // Self-close under the platform function-duration cap; client reconnects.
      budgetTimer = setTimeout(close, STREAM_BUDGET_MS);

      await tick(true);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
};
