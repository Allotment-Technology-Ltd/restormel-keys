/**
 * Stage 1.6 durable runs — lease/heartbeat/reclaim correctness for ingest jobs.
 *
 * Concurrency contract under test: claim, reclaim and requeue are each a SINGLE
 * conditional `UPDATE … WHERE … RETURNING` (no read-modify-write), so Postgres row
 * locking guarantees two concurrent claimers can never both win the same row — the
 * loser re-evaluates the WHERE after the winner commits and matches nothing. The
 * tests pin (a) the one-statement shape and (b) the WHERE/SET predicates that make
 * lease expiry, fencing and the worker_lost transition correct.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Captured = { text: string; params: unknown[] };
const captured: Captured[] = [];
/** Test-controlled responder; return null to fall back to []. */
let respond: (text: string, params: unknown[]) => unknown[] | null = () => null;

vi.mock("@neondatabase/serverless", () => ({
  neon: () => {
    const tag = (strings: TemplateStringsArray, ...values: unknown[]) => {
      const text = strings.join("$");
      captured.push({ text, params: values });
      return Promise.resolve(respond(text, values) ?? []);
    };
    return tag;
  },
}));

// P3a dual-driver: a neon.tech host routes through the (here-mocked) neon-http
// path — the capturing stub these tests assert against. A plain postgres:// URL
// would now route to a real pg Pool (the adapter's purpose) and open a socket.
process.env.DATABASE_URL = "postgres://test:test@ep-test-123.neon.tech/test";

// $env/dynamic/private snapshots at vite startup in tests — point it at process.env.
vi.mock("$env/dynamic/private", () => ({ env: process.env }));

function jobRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "job-1",
    workspace_id: "ws-1",
    project_id: null,
    status: "running",
    label: null,
    current_stage: null,
    current_action: null,
    progress: null,
    stages: [],
    sources: [],
    stop_after_stage: null,
    pipeline_profile_id: null,
    domain_pack_id: null,
    graph_target_id: null,
    error: null,
    created_at: 1,
    updated_at: 1,
    worker_id: null,
    lease_expires_at: null,
    worker_heartbeat_at: null,
    reclaim_count: 0,
    ...overrides,
  };
}

const isClaim = (c: Captured) => c.text.includes("FOR UPDATE SKIP LOCKED");
const isReclaim = (c: Captured) =>
  c.text.includes("UPDATE knowledge_ingest_jobs") && c.text.includes("reclaim_count = reclaim_count + 1");
const touchesJobs = (c: Captured) =>
  c.text.includes("knowledge_ingest_jobs") && !c.text.includes("ALTER TABLE") && !c.text.includes("CREATE ");

describe("claimNextPendingConnectIngestJob (lease at claim time)", () => {
  beforeEach(() => {
    captured.length = 0;
    respond = () => null;
  });

  it("claims with worker id + lease + heartbeat in ONE atomic statement", async () => {
    respond = (text) => (text.includes("FOR UPDATE SKIP LOCKED") ? [jobRow({ worker_id: "w-1" })] : null);
    const { claimNextPendingConnectIngestJob } = await import("$lib/server/neon");
    const before = Date.now();
    const job = await claimNextPendingConnectIngestJob({ workerId: "w-1", leaseMs: 60_000 });
    const after = Date.now();

    const claims = captured.filter(isClaim);
    expect(claims).toHaveLength(1);
    const claim = claims[0]!;
    // Single conditional UPDATE — the SQL-level atomicity that prevents double-claim.
    expect(claim.text).toContain("UPDATE knowledge_ingest_jobs");
    expect(claim.text).toContain("RETURNING");
    expect(claim.text).toContain("status = 'pending'");
    expect(claim.text).toContain("worker_id =");
    expect(claim.text).toContain("lease_expires_at =");
    expect(claim.text).toContain("worker_heartbeat_at =");
    expect(claim.params).toContain("w-1");
    // Lease expiry parameter is now + leaseMs.
    const leaseParam = claim.params.find(
      (p) => typeof p === "number" && p >= before + 60_000 && p <= after + 60_000,
    );
    expect(leaseParam).toBeDefined();
    expect(job?.workerId).toBe("w-1");
  });

  it("two concurrent claimers cannot both win (row visible to exactly one UPDATE)", async () => {
    // Emulates Postgres row-lock semantics for the single-statement claim: the
    // first conditional UPDATE consumes the row; the second matches nothing.
    let available: Record<string, unknown>[] = [jobRow()];
    respond = (text) => {
      if (!text.includes("FOR UPDATE SKIP LOCKED")) return null;
      const won = available;
      available = [];
      return won;
    };
    const { claimNextPendingConnectIngestJob } = await import("$lib/server/neon");
    const [a, b] = await Promise.all([
      claimNextPendingConnectIngestJob({ workerId: "w-a" }),
      claimNextPendingConnectIngestJob({ workerId: "w-b" }),
    ]);
    const winners = [a, b].filter(Boolean);
    expect(winners).toHaveLength(1);
    // And each claimer issued exactly one job-queue statement — no SELECT-then-UPDATE.
    expect(captured.filter(isClaim)).toHaveLength(2);
    expect(captured.filter(touchesJobs)).toHaveLength(2);
  });
});

describe("reclaimStaleRunningConnectIngestJobs (lease expiry → restartable failure)", () => {
  beforeEach(() => {
    captured.length = 0;
    respond = () => null;
  });

  it("is one atomic UPDATE … RETURNING that only matches expired leases", async () => {
    const now = 1_000_000;
    respond = (text) =>
      isReclaim({ text, params: [] }) ? [jobRow({ status: "failed", error: "worker_lost: x" })] : null;
    const { reclaimStaleRunningConnectIngestJobs } = await import("$lib/server/neon");
    const reclaimed = await reclaimStaleRunningConnectIngestJobs({ staleMs: 300_000, now });

    const stmts = captured.filter(isReclaim);
    expect(stmts).toHaveLength(1);
    const stmt = stmts[0]!;
    // Lease expiry is enforced INSIDE the statement (atomic with the transition).
    expect(stmt.text).toContain("WHERE status = 'running'");
    expect(stmt.text).toContain("lease_expires_at IS NOT NULL AND lease_expires_at <");
    // Legacy rows without a lease fall back to updated_at staleness.
    expect(stmt.text).toContain("lease_expires_at IS NULL AND updated_at <");
    expect(stmt.text).toContain("RETURNING");
    // Bound clock values: the lease comparison uses `now`; the legacy fallback `now - staleMs`.
    expect(stmt.params).toContain(now);
    expect(stmt.params).toContain(now - 300_000);
    // The transition is to a VISIBLE, RESTARTABLE failure — never a silent re-run.
    expect(stmt.text).toContain("status = 'failed'");
    expect(stmt.params.some((p) => typeof p === "string" && p.startsWith("worker_lost"))).toBe(true);
    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0]!.status).toBe("failed");
  });

  it("two concurrent reclaimers cannot both reclaim the same job", async () => {
    let available: Record<string, unknown>[] = [jobRow()];
    respond = (text) => {
      if (!isReclaim({ text, params: [] })) return null;
      const won = available;
      available = [];
      return won;
    };
    const { reclaimStaleRunningConnectIngestJobs } = await import("$lib/server/neon");
    const [a, b] = await Promise.all([
      reclaimStaleRunningConnectIngestJobs(),
      reclaimStaleRunningConnectIngestJobs(),
    ]);
    expect(a.length + b.length).toBe(1);
  });
});

describe("heartbeatConnectIngestJobLease (worker fencing)", () => {
  beforeEach(() => {
    captured.length = 0;
    respond = () => null;
  });

  it("extends the lease only while the job is still this worker's running job", async () => {
    respond = (text) => (text.includes("worker_heartbeat_at =") && text.includes("WHERE id =") ? [{ id: "job-1" }] : null);
    const { heartbeatConnectIngestJobLease } = await import("$lib/server/neon");
    const ok = await heartbeatConnectIngestJobLease({ id: "job-1", workerId: "w-1", leaseMs: 60_000 });
    expect(ok).toBe(true);
    const beat = captured.find((c) => c.text.includes("worker_heartbeat_at =") && c.text.includes("WHERE id ="))!;
    expect(beat.text).toContain("status = 'running'");
    expect(beat.text).toContain("worker_id =");
    expect(beat.params).toContain("w-1");
  });

  it("returns false once the job was reclaimed or cancelled (no row matches)", async () => {
    respond = () => null; // no rows
    const { heartbeatConnectIngestJobLease } = await import("$lib/server/neon");
    const ok = await heartbeatConnectIngestJobLease({ id: "job-1", workerId: "w-1" });
    expect(ok).toBe(false);
  });
});

describe("requeueReclaimedConnectIngestJob (checkpointed restart)", () => {
  beforeEach(() => {
    captured.length = 0;
    respond = () => null;
  });

  it("only re-queues a worker_lost failure, atomically, preserving stages/progress", async () => {
    respond = (text) =>
      text.includes("status = 'pending'") && text.includes("error LIKE")
        ? [jobRow({ status: "pending", error: null })]
        : null;
    const { requeueReclaimedConnectIngestJob } = await import("$lib/server/neon");
    const job = await requeueReclaimedConnectIngestJob({ id: "job-1", workspaceId: "ws-1" });
    expect(job?.status).toBe("pending");
    const stmt = captured.find((c) => c.text.includes("error LIKE"))!;
    expect(stmt.text).toContain("status = 'failed'");
    expect(stmt.params).toContain("worker_lost%");
    // Stages + progress (the resume checkpoint) are NOT touched by the requeue.
    expect(stmt.text).not.toContain("stages =");
    expect(stmt.text).not.toContain("progress =");
  });

  it("returns null when the job is not a reclaimed failure (raced or wrong state)", async () => {
    const { requeueReclaimedConnectIngestJob } = await import("$lib/server/neon");
    expect(await requeueReclaimedConnectIngestJob({ id: "job-1", workspaceId: "ws-1" })).toBeNull();
  });
});

describe("updateConnectIngestJobById (zombie-worker fencing)", () => {
  beforeEach(() => {
    captured.length = 0;
    respond = () => null;
  });

  it("guards worker updates by non-terminal status and the worker fencing token", async () => {
    const { updateConnectIngestJobById } = await import("$lib/server/neon");
    await updateConnectIngestJobById({
      id: "job-1",
      status: "running",
      currentAction: "extracting",
      workerId: "w-1",
    });
    const stmt = captured.filter(
      (c) => c.text.includes("UPDATE knowledge_ingest_jobs") && c.text.includes("WHERE id ="),
    );
    expect(stmt).toHaveLength(1);
    expect(stmt[0]!.text).toContain("status IN ('pending', 'running')");
    expect(stmt[0]!.text).toContain("OR worker_id =");
    expect(stmt[0]!.params).toContain("w-1");
  });
});
