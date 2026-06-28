/**
 * M3 Store — non-destructive store-move decision logic (RES-113 PR-K, REC-ADR-017).
 *
 * This module is the PURE, env-independent core of the M3 "own your store" step:
 * given a read-only probe of the target store (see store-node-count-probe.ts) and
 * the operator's chosen option, it produces a {@link StoreMovePlan} that is, by
 * construction, **non-destructive and reversible**.
 *
 * The decision encodes REC-ADR-017's three commitments verbatim:
 *  1. Connecting only proves *reach* — the data decision is a separate, explicit step.
 *  2. A non-empty target yields a three-way choice, never an automatic overwrite:
 *       use_existing · add_alongside · keep_separate.
 *     An empty target collapses to a single "copy your graph in" line.
 *  3. The choice carries an explicit safety guarantee: nothing is deleted or
 *     overwritten; the managed copy is retained until the user confirms; switch
 *     back at any time.
 *
 * NON-DESTRUCTIVENESS IS TYPE-ENFORCED: every plan's `destructive` /
 * `overwritesExistingData` are the literal `false` and `managedCopyRetained` /
 * `reversible` the literal `true`, so a destructive plan cannot even typecheck.
 * {@link assertNonDestructiveStoreMovePlan} re-checks the same invariant at runtime
 * as a belt-and-braces guard the route also calls before persisting anything.
 *
 * IMPORTANT — what is NOT here: the actual cross-store *copy* (add_alongside /
 * keep_separate) and the live re-point of reads (use_existing) are deferred and
 * ENV-PENDING; this module only decides and describes them. Plans carry an
 * `envPending` block naming exactly what still needs the live integration env.
 */

/** Store engines M3 can target. Managed = the host-managed Postgres origin (#288). */
export type StoreMoveEngine = "postgres" | "surreal" | "neo4j";

/**
 * The three non-destructive options offered when the target store is NOT empty
 * (REC-ADR-017 §2). The empty-target case offers no choice — it collapses to a
 * single copy-in line (see {@link offeredStoreMoveOptions}).
 */
export type StoreMoveOption = "use_existing" | "add_alongside" | "keep_separate";

export const STORE_MOVE_OPTIONS: readonly StoreMoveOption[] = [
  "use_existing",
  "add_alongside",
  "keep_separate",
] as const;

/**
 * The minimal, read-only summary of a target store the decision needs. Produced
 * by the node-count probe; `nodeCount === null` means the count could not be
 * established (e.g. the engine's count path is unsupported) — treated as
 * "unknown, assume not-empty" so we never collapse to the silent copy-in path
 * on incomplete information.
 */
export interface TargetStoreProbeSummary {
  engine: StoreMoveEngine;
  reachable: boolean;
  /** Node count of the target store, or null when it could not be established. */
  nodeCount: number | null;
  /** ISO-8601 timestamp of the target store's last write, when known. */
  lastWriteAt: string | null;
}

/** Where reads are served from once the (env-pending) move is executed. */
export type ReadsServedFrom = "target_existing" | "managed_copy_into_target";

/** How apparent duplicates are handled — flagged for review, NEVER auto-merged. */
export type DuplicateHandling = "flag_not_merge" | "none";

/** Namespace placement for the managed graph when it is copied in. */
export type TargetNamespaceStrategy = "existing" | "new_namespace";

/**
 * The load-bearing safety guarantee shown with every option (REC-ADR-017 §3).
 * Copy, not decoration — keep it verbatim with the design.
 */
export const STORE_MOVE_GUARANTEE =
  "Nothing is deleted or overwritten. Your managed copy remains until you confirm the switch — and you can switch back at any time.";

/**
 * A non-destructive, reversible store-move plan. The `false`/`true` *literal*
 * types make the safety contract part of the type — a plan that overwrites or
 * drops the managed copy is unrepresentable.
 */
export interface StoreMovePlan {
  option: StoreMoveOption;
  /** True only when the target was empty and the three-way choice collapsed to copy-in. */
  collapsedFromEmptyTarget: boolean;

  // ── Safety invariant (type-enforced) ──────────────────────────────────────
  destructive: false;
  overwritesExistingData: false;
  managedCopyRetained: true;
  reversible: true;

  // ── What the plan actually does ───────────────────────────────────────────
  readsServedFrom: ReadsServedFrom;
  /** Whether the managed graph is copied into the target (true for add/keep-separate). */
  copyManagedGraphIn: boolean;
  duplicateHandling: DuplicateHandling;
  targetNamespaceStrategy: TargetNamespaceStrategy;

  // ── Copy shown to the operator ────────────────────────────────────────────
  guarantee: typeof STORE_MOVE_GUARANTEE;
  /** Plain-language "what's here / what will happen" line. */
  summary: string;

  // ── Honesty: what still needs the live integration env to actually run ────
  envPending: {
    /** True when an actual cross-store copy of the managed graph is required. */
    copyExecution: boolean;
    /** True when re-pointing reads at the target must be verified end-to-end. */
    repointVerification: boolean;
    reason: string;
  };
}

export type StoreMovePlanResult =
  | { ok: true; plan: StoreMovePlan }
  | { ok: false; error: "unreachable" | "empty_target_no_choice"; message: string };

/** Treat a probe as "empty" only on a definite zero — null (unknown) is NOT empty. */
export function isTargetEmpty(probe: TargetStoreProbeSummary): boolean {
  return probe.nodeCount === 0;
}

/**
 * The options to offer for this probe. A non-empty (or unknown) target offers the
 * full three-way choice; an empty target offers NONE — it collapses to a single
 * "we'll copy your graph in" line, which {@link planStoreMove} produces directly.
 */
export function offeredStoreMoveOptions(probe: TargetStoreProbeSummary): StoreMoveOption[] {
  if (!probe.reachable) return [];
  if (isTargetEmpty(probe)) return [];
  return [...STORE_MOVE_OPTIONS];
}

function nodeCountPhrase(probe: TargetStoreProbeSummary): string {
  if (probe.nodeCount === null) return "an existing graph";
  const n = probe.nodeCount.toLocaleString("en-GB");
  return `${n} node${probe.nodeCount === 1 ? "" : "s"}`;
}

/**
 * Build the non-destructive plan for an empty target: regardless of which option
 * the UI nominally carried, an empty store has nothing to preserve, so the plan
 * is simply "copy your graph in" into the existing namespace (REC-ADR-017 §2).
 */
function planForEmptyTarget(option: StoreMoveOption): StoreMovePlan {
  return {
    option,
    collapsedFromEmptyTarget: true,
    destructive: false,
    overwritesExistingData: false,
    managedCopyRetained: true,
    reversible: true,
    readsServedFrom: "managed_copy_into_target",
    copyManagedGraphIn: true,
    duplicateHandling: "none",
    targetNamespaceStrategy: "existing",
    guarantee: STORE_MOVE_GUARANTEE,
    summary: "Empty — we'll copy your graph in. Your managed copy stays until you confirm.",
    envPending: {
      copyExecution: true,
      repointVerification: true,
      reason:
        "Copying your managed graph into the target store runs on the live integration environment; nothing is copied at planning time.",
    },
  };
}

/**
 * Decide the non-destructive store-move plan for a chosen option against a probed
 * target. Pure: no I/O, no side effects. Returns a typed error when the target is
 * unreachable (we won't plan a binding against a store we can't read).
 */
export function planStoreMove(
  probe: TargetStoreProbeSummary,
  option: StoreMoveOption,
): StoreMovePlanResult {
  if (!probe.reachable) {
    return {
      ok: false,
      error: "unreachable",
      message:
        "We couldn't reach the target store, so there's no store to bind to yet. Re-run the connection check first.",
    };
  }

  if (isTargetEmpty(probe)) {
    // No existing data to preserve → the three-way choice collapses to copy-in.
    return { ok: true, plan: planForEmptyTarget(option) };
  }

  const here = nodeCountPhrase(probe);
  const lastWrite = probe.lastWriteAt ? `, last write ${probe.lastWriteAt}` : "";

  let plan: StoreMovePlan;
  switch (option) {
    case "use_existing":
      // Serve the graph that's already there; the managed graph stays as a
      // separate, untouched copy. No copy is performed — only reads re-point.
      plan = {
        option,
        collapsedFromEmptyTarget: false,
        destructive: false,
        overwritesExistingData: false,
        managedCopyRetained: true,
        reversible: true,
        readsServedFrom: "target_existing",
        copyManagedGraphIn: false,
        duplicateHandling: "none",
        targetNamespaceStrategy: "existing",
        guarantee: STORE_MOVE_GUARANTEE,
        summary: `Use the graph that's already here (${here}${lastWrite}). We'll serve answers from it; your managed graph stays as a separate, untouched copy.`,
        envPending: {
          copyExecution: false,
          repointVerification: true,
          reason:
            "Re-pointing reads at your store and verifying retrieval runs on the live integration environment; nothing is copied or written.",
        },
      };
      break;

    case "add_alongside":
      // Copy the managed graph in NEXT TO the existing data; duplicates are
      // FLAGGED for review, never merged or overwritten (REC-ADR-021 M3).
      plan = {
        option,
        collapsedFromEmptyTarget: false,
        destructive: false,
        overwritesExistingData: false,
        managedCopyRetained: true,
        reversible: true,
        readsServedFrom: "managed_copy_into_target",
        copyManagedGraphIn: true,
        duplicateHandling: "flag_not_merge",
        targetNamespaceStrategy: "existing",
        guarantee: STORE_MOVE_GUARANTEE,
        summary: `Add your managed graph alongside the ${here} already here. We copy it in next to the existing data — apparent duplicates are flagged for review, never merged or overwritten.`,
        envPending: {
          copyExecution: true,
          repointVerification: true,
          reason:
            "Copying your managed graph alongside the existing data (with duplicate-flagging) runs on the live integration environment; real merge tooling is deferred. Nothing is copied at planning time.",
        },
      };
      break;

    case "keep_separate":
      // Leave the existing graph alone; place the managed graph in a NEW namespace.
      plan = {
        option,
        collapsedFromEmptyTarget: false,
        destructive: false,
        overwritesExistingData: false,
        managedCopyRetained: true,
        reversible: true,
        readsServedFrom: "managed_copy_into_target",
        copyManagedGraphIn: true,
        duplicateHandling: "none",
        targetNamespaceStrategy: "new_namespace",
        guarantee: STORE_MOVE_GUARANTEE,
        summary: `Keep them separate. We leave the ${here} already here untouched and place your managed graph in a new namespace.`,
        envPending: {
          copyExecution: true,
          repointVerification: true,
          reason:
            "Provisioning a new namespace and copying your managed graph into it runs on the live integration environment; nothing is copied at planning time.",
        },
      };
      break;
  }

  // Belt-and-braces: never return a plan that violates the safety contract.
  assertNonDestructiveStoreMovePlan(plan);
  return { ok: true, plan };
}

/** Build the non-destructive plans for every option offered for this probe. */
export function previewStoreMovePlans(
  probe: TargetStoreProbeSummary,
): { option: StoreMoveOption; plan: StoreMovePlan }[] {
  const options = offeredStoreMoveOptions(probe);
  const out: { option: StoreMoveOption; plan: StoreMovePlan }[] = [];
  for (const option of options) {
    const r = planStoreMove(probe, option);
    if (r.ok) out.push({ option, plan: r.plan });
  }
  return out;
}

/**
 * Runtime guard for the non-destructiveness invariant (REC-ADR-017). Throws if a
 * plan would ever delete, overwrite, drop the managed copy, lose reversibility,
 * or silently merge duplicates. The route calls this defensively before it
 * persists or surfaces any plan.
 */
export function assertNonDestructiveStoreMovePlan(plan: StoreMovePlan): void {
  const violations: string[] = [];
  if ((plan.destructive as boolean) !== false) violations.push("destructive must be false");
  if ((plan.overwritesExistingData as boolean) !== false) {
    violations.push("overwritesExistingData must be false");
  }
  if ((plan.managedCopyRetained as boolean) !== true) {
    violations.push("managedCopyRetained must be true");
  }
  if ((plan.reversible as boolean) !== true) violations.push("reversible must be true");
  // "Add alongside" into a non-empty store must flag duplicates, never merge them.
  // (The empty-target collapse copies into an empty store, so there are no
  // duplicates to handle — "none" is correct there and not a merge.)
  if (
    plan.option === "add_alongside" &&
    !plan.collapsedFromEmptyTarget &&
    plan.duplicateHandling !== "flag_not_merge"
  ) {
    violations.push("add_alongside must flag duplicates, not merge them");
  }
  // The guarantee copy is load-bearing — it must be present and unaltered.
  if (plan.guarantee !== STORE_MOVE_GUARANTEE) {
    violations.push("safety guarantee copy must be present and unaltered");
  }
  if (violations.length > 0) {
    throw new Error(`Non-destructive store-move invariant violated: ${violations.join("; ")}`);
  }
}
