/**
 * M3 Store — service orchestration (RES-113 PR-K). Env-INDEPENDENT: the I/O ports
 * (neon, the Surreal query path, the Neo4j adapter probe) are mocked, so this
 * exercises the real probe→plan→audit orchestration without a DB or live store.
 *
 * The live cross-engine probe + the actual move remain ENV-PENDING; here we prove
 * the orchestration shape: read-only probe dispatch, the empty/non-empty offer
 * gate, non-destructive decisions, audit persistence, graceful degradation when
 * migration 074 is pending, and the unreachable refusal.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/neon", () => ({
  getConnectGraphStats: vi.fn(),
  getConnectGraphTargetById: vi.fn(),
  getConnectGraphTargetForWorkspace: vi.fn(),
  recordConnectStoreMoveDecision: vi.fn(),
}));
vi.mock("$lib/server/connect/graph-target-service", () => ({
  decryptGraphTargetSecret: vi.fn(() => "secret"),
  surrealQuery: vi.fn(),
}));
vi.mock("$lib/server/connect/graph-store-config", () => ({
  probeSavedNeo4jNodeCount: vi.fn(),
}));

import {
  getConnectGraphStats,
  getConnectGraphTargetForWorkspace,
  recordConnectStoreMoveDecision,
} from "$lib/server/neon";
import { surrealQuery } from "$lib/server/connect/graph-target-service";
import { probeSavedNeo4jNodeCount } from "$lib/server/connect/graph-store-config";
import {
  decideWorkspaceStoreMove,
  getStoreMoveOverview,
  probeWorkspaceStoreTarget,
} from "./connect-store-move-service";

const WS = "ws-1";

beforeEach(() => {
  vi.clearAllMocks();
  (recordConnectStoreMoveDecision as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "dec-1" });
});

function surrealRow() {
  return {
    id: "gt-1",
    provider: "surreal",
    endpoint: "https://db.example/sql",
    namespace: "acme",
    database: "prod_graph",
    username: "u",
  };
}

describe("probeWorkspaceStoreTarget — postgres managed origin (#288)", () => {
  it("counts via the spine and offers no choice when empty", async () => {
    (getConnectGraphStats as ReturnType<typeof vi.fn>).mockResolvedValue({ units: 0 });
    const probe = await probeWorkspaceStoreTarget(WS, "postgres");
    expect(probe).toMatchObject({ engine: "postgres", reachable: true, nodeCount: 0 });
  });

  it("maps a stats read error to unreachable", async () => {
    (getConnectGraphStats as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("db down"));
    const probe = await probeWorkspaceStoreTarget(WS, "postgres");
    expect(probe.reachable).toBe(false);
    expect(probe.nodeCount).toBeNull();
  });
});

describe("getStoreMoveOverview", () => {
  it("offers the full non-destructive choice for a non-empty target + previews", async () => {
    (getConnectGraphStats as ReturnType<typeof vi.fn>).mockResolvedValue({ units: 128 });
    const ov = await getStoreMoveOverview(WS, "postgres");
    expect(ov.targetEmpty).toBe(false);
    expect(ov.offeredOptions).toEqual(["use_existing", "add_alongside", "keep_separate"]);
    expect(ov.previews).toHaveLength(3);
    for (const p of ov.previews) {
      expect(p.plan.destructive).toBe(false);
      expect(p.plan.managedCopyRetained).toBe(true);
    }
  });

  it("collapses to no choice for an empty target", async () => {
    (getConnectGraphStats as ReturnType<typeof vi.fn>).mockResolvedValue({ units: 0 });
    const ov = await getStoreMoveOverview(WS, "postgres");
    expect(ov.targetEmpty).toBe(true);
    expect(ov.offeredOptions).toEqual([]);
    expect(ov.previews).toEqual([]);
  });
});

describe("probeWorkspaceStoreTarget — surreal BYO", () => {
  it("runs a read-only count over the active graph target", async () => {
    (getConnectGraphTargetForWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(surrealRow());
    (surrealQuery as ReturnType<typeof vi.fn>).mockImplementation(async ({ sql }: { sql: string }) =>
      sql.includes("count()")
        ? { ok: true, data: [{ count: 4210 }] }
        : { ok: true, data: [{ updated_at: "2026-06-25T09:00:00.000Z" }] },
    );
    const probe = await probeWorkspaceStoreTarget(WS, "surreal");
    expect(probe).toMatchObject({ engine: "surreal", reachable: true, nodeCount: 4210 });
    // Every SurrealQL statement dispatched is read-only (no write verbs).
    for (const call of (surrealQuery as ReturnType<typeof vi.fn>).mock.calls) {
      expect(String(call[0].sql)).not.toMatch(/\b(DELETE|REMOVE|UPDATE|CREATE|MERGE)\b/i);
    }
  });

  it("is unreachable when no surreal target is configured", async () => {
    (getConnectGraphTargetForWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const probe = await probeWorkspaceStoreTarget(WS, "surreal");
    expect(probe.reachable).toBe(false);
  });
});

describe("probeWorkspaceStoreTarget — neo4j BYO", () => {
  it("reads the count via the adapter probe", async () => {
    (probeSavedNeo4jNodeCount as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: true, nodeCount: 909 });
    const probe = await probeWorkspaceStoreTarget(WS, "neo4j");
    expect(probe).toMatchObject({ engine: "neo4j", reachable: true, nodeCount: 909 });
  });

  it("is unreachable when the adapter probe fails", async () => {
    (probeSavedNeo4jNodeCount as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, error: "x" });
    const probe = await probeWorkspaceStoreTarget(WS, "neo4j");
    expect(probe.reachable).toBe(false);
  });
});

describe("decideWorkspaceStoreMove", () => {
  it("records a non-destructive decision and marks the move env-pending", async () => {
    (getConnectGraphStats as ReturnType<typeof vi.fn>).mockResolvedValue({ units: 128 });
    const res = await decideWorkspaceStoreMove(WS, "postgres", "add_alongside");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.plan.option).toBe("add_alongside");
    expect(res.plan.duplicateHandling).toBe("flag_not_merge");
    expect(res.decisionId).toBe("dec-1");
    expect(res.auditPersisted).toBe(true);

    // The audit row attests non-destructiveness and env-pending execution.
    const recordArg = (recordConnectStoreMoveDecision as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(recordArg).toMatchObject({
      workspaceId: WS,
      targetEngine: "postgres",
      chosenOption: "add_alongside",
      targetWasEmpty: false,
      executionEnvPending: true,
    });
  });

  it("use_existing copies nothing (still env-pending on the read re-point)", async () => {
    (getConnectGraphStats as ReturnType<typeof vi.fn>).mockResolvedValue({ units: 128 });
    const res = await decideWorkspaceStoreMove(WS, "postgres", "use_existing");
    expect(res.ok && res.plan.copyManagedGraphIn).toBe(false);
    expect(res.ok && res.plan.envPending.copyExecution).toBe(false);
    expect(res.ok && res.plan.envPending.repointVerification).toBe(true);
  });

  it("still returns the plan when migration 074 is pending (audit degrades, no crash)", async () => {
    (getConnectGraphStats as ReturnType<typeof vi.fn>).mockResolvedValue({ units: 5 });
    (recordConnectStoreMoveDecision as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await decideWorkspaceStoreMove(WS, "postgres", "keep_separate");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.decisionId).toBeNull();
    expect(res.auditPersisted).toBe(false);
    expect(res.plan.option).toBe("keep_separate");
  });

  it("refuses (409) to decide against an unreachable target and records nothing", async () => {
    (getConnectGraphTargetForWorkspace as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await decideWorkspaceStoreMove(WS, "surreal", "use_existing");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(409);
    expect(recordConnectStoreMoveDecision).not.toHaveBeenCalled();
  });
});
