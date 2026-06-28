/**
 * M3 Store — non-destructive store-move decision (RES-113 PR-K, REC-ADR-017).
 *
 * Env-INDEPENDENT unit tests for the pure decision core:
 *   - the use/add/keep-separate decision for a non-empty target,
 *   - the empty-target collapse to a single copy-in plan,
 *   - the offered-options gate (none when empty/unreachable),
 *   - and the NON-DESTRUCTIVENESS INVARIANT held across every option × probe
 *     combination (no plan is ever destructive / overwriting / irreversible, the
 *     managed copy is always retained, and "add alongside" never merges).
 *
 * The actual cross-store copy / read re-point is ENV-PENDING and asserted only via
 * the `envPending` flags here — not executed.
 */
import { describe, expect, it } from "vitest";
import {
  STORE_MOVE_GUARANTEE,
  STORE_MOVE_OPTIONS,
  assertNonDestructiveStoreMovePlan,
  isTargetEmpty,
  offeredStoreMoveOptions,
  planStoreMove,
  previewStoreMovePlans,
  type StoreMoveEngine,
  type StoreMoveOption,
  type StoreMovePlan,
  type TargetStoreProbeSummary,
} from "./store-move-plan";

function probe(over: Partial<TargetStoreProbeSummary> = {}): TargetStoreProbeSummary {
  return {
    engine: "surreal",
    reachable: true,
    nodeCount: 4210,
    lastWriteAt: "2026-06-25T09:00:00.000Z",
    ...over,
  };
}

const ENGINES: StoreMoveEngine[] = ["postgres", "surreal", "neo4j"];

describe("offeredStoreMoveOptions", () => {
  it("offers all three options for a non-empty reachable target", () => {
    expect(offeredStoreMoveOptions(probe({ nodeCount: 4210 }))).toEqual([
      "use_existing",
      "add_alongside",
      "keep_separate",
    ]);
  });

  it("offers NO choice for an empty target (collapses to copy-in)", () => {
    expect(offeredStoreMoveOptions(probe({ nodeCount: 0 }))).toEqual([]);
  });

  it("offers no choice when the target is unreachable", () => {
    expect(offeredStoreMoveOptions(probe({ reachable: false, nodeCount: null }))).toEqual([]);
  });

  it("offers the full choice when the count is unknown (null ≠ empty)", () => {
    expect(offeredStoreMoveOptions(probe({ nodeCount: null }))).toHaveLength(3);
  });
});

describe("isTargetEmpty", () => {
  it("is empty only on a definite zero", () => {
    expect(isTargetEmpty(probe({ nodeCount: 0 }))).toBe(true);
    expect(isTargetEmpty(probe({ nodeCount: 1 }))).toBe(false);
    expect(isTargetEmpty(probe({ nodeCount: null }))).toBe(false); // unknown is NOT empty
  });
});

describe("planStoreMove — non-empty target", () => {
  it("use_existing serves the existing graph and copies nothing", () => {
    const r = planStoreMove(probe(), "use_existing");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.readsServedFrom).toBe("target_existing");
    expect(r.plan.copyManagedGraphIn).toBe(false);
    expect(r.plan.targetNamespaceStrategy).toBe("existing");
    expect(r.plan.duplicateHandling).toBe("none");
    // No copy → copyExecution not pending; only the read re-point needs the env.
    expect(r.plan.envPending.copyExecution).toBe(false);
    expect(r.plan.envPending.repointVerification).toBe(true);
    expect(r.plan.summary).toMatch(/4,210 nodes/);
    expect(r.plan.summary).toMatch(/untouched copy/i);
  });

  it("add_alongside copies in next to existing data and FLAGS duplicates (never merges)", () => {
    const r = planStoreMove(probe(), "add_alongside");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.readsServedFrom).toBe("managed_copy_into_target");
    expect(r.plan.copyManagedGraphIn).toBe(true);
    expect(r.plan.duplicateHandling).toBe("flag_not_merge");
    expect(r.plan.targetNamespaceStrategy).toBe("existing");
    expect(r.plan.envPending.copyExecution).toBe(true);
    expect(r.plan.summary).toMatch(/flagged for review, never merged or overwritten/i);
  });

  it("keep_separate places the managed graph in a new namespace, leaving existing untouched", () => {
    const r = planStoreMove(probe(), "keep_separate");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.targetNamespaceStrategy).toBe("new_namespace");
    expect(r.plan.copyManagedGraphIn).toBe(true);
    expect(r.plan.duplicateHandling).toBe("none");
    expect(r.plan.envPending.copyExecution).toBe(true);
    expect(r.plan.summary).toMatch(/untouched/i);
  });

  it("includes the last-write timestamp in use_existing copy when known", () => {
    const r = planStoreMove(probe({ lastWriteAt: "2026-06-25T09:00:00.000Z" }), "use_existing");
    expect(r.ok && r.plan.summary).toMatch(/last write 2026-06-25/);
  });

  it("singularises the node phrase for a one-node target", () => {
    const r = planStoreMove(probe({ nodeCount: 1 }), "use_existing");
    expect(r.ok && r.plan.summary).toMatch(/\b1 node\b/);
    expect(r.ok && r.plan.summary).not.toMatch(/1 nodes/);
  });

  it("describes an unknown count generically rather than printing null", () => {
    const r = planStoreMove(probe({ nodeCount: null }), "add_alongside");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.summary).toMatch(/an existing graph/);
    expect(r.plan.summary).not.toMatch(/null/);
  });
});

describe("planStoreMove — empty target collapse", () => {
  it("collapses every option to a single non-destructive copy-in plan", () => {
    for (const option of STORE_MOVE_OPTIONS) {
      const r = planStoreMove(probe({ nodeCount: 0 }), option);
      expect(r.ok).toBe(true);
      if (!r.ok) continue;
      expect(r.plan.collapsedFromEmptyTarget).toBe(true);
      expect(r.plan.copyManagedGraphIn).toBe(true);
      expect(r.plan.readsServedFrom).toBe("managed_copy_into_target");
      expect(r.plan.targetNamespaceStrategy).toBe("existing");
      expect(r.plan.summary).toMatch(/Empty — we'll copy your graph in/);
    }
  });
});

describe("planStoreMove — unreachable target", () => {
  it("refuses to plan a binding against an unreachable store", () => {
    const r = planStoreMove(probe({ reachable: false, nodeCount: null }), "use_existing");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe("unreachable");
  });
});

describe("NON-DESTRUCTIVENESS INVARIANT (REC-ADR-017)", () => {
  // Enumerate every option against empty / non-empty / unknown / multi-engine probes.
  const counts: (number | null)[] = [0, 1, 4210, null];

  it("every produced plan is non-destructive, reversible, and retains the managed copy", () => {
    for (const engine of ENGINES) {
      for (const nodeCount of counts) {
        for (const option of STORE_MOVE_OPTIONS) {
          const r = planStoreMove(probe({ engine, nodeCount }), option);
          expect(r.ok).toBe(true);
          if (!r.ok) continue;
          const p: StoreMovePlan = r.plan;
          expect(p.destructive).toBe(false);
          expect(p.overwritesExistingData).toBe(false);
          expect(p.managedCopyRetained).toBe(true);
          expect(p.reversible).toBe(true);
          expect(p.guarantee).toBe(STORE_MOVE_GUARANTEE);
          // The invariant guard must also accept every plan we produce.
          expect(() => assertNonDestructiveStoreMovePlan(p)).not.toThrow();
        }
      }
    }
  });

  it("no plan ever auto-merges duplicates", () => {
    for (const nodeCount of counts) {
      for (const option of STORE_MOVE_OPTIONS) {
        const r = planStoreMove(probe({ nodeCount }), option);
        if (!r.ok) continue;
        // The only duplicate handling that ever appears is "flag", never "merge".
        expect(["flag_not_merge", "none"]).toContain(r.plan.duplicateHandling);
      }
    }
  });

  it("assertNonDestructiveStoreMovePlan throws on a tampered destructive plan", () => {
    const r = planStoreMove(probe(), "add_alongside");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const tampered = { ...r.plan, overwritesExistingData: true } as unknown as StoreMovePlan;
    expect(() => assertNonDestructiveStoreMovePlan(tampered)).toThrow(/invariant violated/i);
  });

  it("assertNonDestructiveStoreMovePlan throws when add_alongside is mutated to merge", () => {
    const r = planStoreMove(probe(), "add_alongside");
    if (!r.ok) return;
    const tampered = { ...r.plan, duplicateHandling: "merge" } as unknown as StoreMovePlan;
    expect(() => assertNonDestructiveStoreMovePlan(tampered)).toThrow(/flag duplicates/i);
  });

  it("assertNonDestructiveStoreMovePlan throws when the managed copy is dropped", () => {
    const r = planStoreMove(probe(), "use_existing");
    if (!r.ok) return;
    const tampered = { ...r.plan, managedCopyRetained: false } as unknown as StoreMovePlan;
    expect(() => assertNonDestructiveStoreMovePlan(tampered)).toThrow(/managedCopyRetained/);
  });
});

describe("previewStoreMovePlans", () => {
  it("returns one non-destructive plan per offered option (non-empty target)", () => {
    const previews = previewStoreMovePlans(probe({ nodeCount: 4210 }));
    expect(previews.map((p) => p.option)).toEqual([
      "use_existing",
      "add_alongside",
      "keep_separate",
    ]);
    for (const { plan } of previews) {
      expect(() => assertNonDestructiveStoreMovePlan(plan)).not.toThrow();
    }
  });

  it("returns no previews for an empty or unreachable target", () => {
    expect(previewStoreMovePlans(probe({ nodeCount: 0 }))).toEqual([]);
    expect(previewStoreMovePlans(probe({ reachable: false, nodeCount: null }))).toEqual([]);
  });
});
