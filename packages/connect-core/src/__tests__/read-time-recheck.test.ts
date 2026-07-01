import { describe, expect, it } from "vitest";
import {
  decideServedState,
  decideServedStates,
  summarizeReadTimeRecheck,
  applyDemotionsToSummary,
  buildRecheckAuditRows,
  type ServedClaimRecheck,
  type ReadTimeRecheckResult,
} from "../ingest/read-time-recheck.js";
import {
  bindEvidenceSpan,
  verifyEvidenceSpan,
  contentHash,
  type EvidenceSpan,
} from "../ingest/evidence-binding.js";
import type { ReadTimeRecheckOutcome } from "../ingest/read-time-recheck.js";

function served(
  id: string,
  storedState: ServedClaimRecheck["storedState"],
  outcome: ReadTimeRecheckOutcome,
): ServedClaimRecheck {
  return { id, storedState, outcome };
}

describe("decideServedState — fail-closed read-time freshness", () => {
  it("keeps a supported claim when the fresh Layer-1 pass succeeds", () => {
    const r = decideServedState(served("c1", "supported", { ok: true, match: "exact" }));
    expect(r.effectiveState).toBe("supported");
    expect(r.demoted).toBe(false);
    expect(r.fresh).toBe(true);
    expect(r.match).toBe("exact");
    expect(r.reason).toBeNull();
  });

  it("DEMOTES supported → unverified when the source content hash changed (stale_source)", () => {
    const r = decideServedState(served("c1", "supported", { ok: false, reason: "stale_source" }));
    expect(r.effectiveState).toBe("unverified");
    expect(r.demoted).toBe(true);
    expect(r.fresh).toBe(false);
    expect(r.reason).toBe("stale_source");
  });

  it("DEMOTES supported → unverified when the quote moved off its offsets (span_lost)", () => {
    const r = decideServedState(served("c1", "supported", { ok: false, reason: "span_lost" }));
    expect(r.effectiveState).toBe("unverified");
    expect(r.demoted).toBe(true);
  });

  it("DEMOTES supported when offsets fall out of range", () => {
    const r = decideServedState(served("c1", "supported", { ok: false, reason: "offsets_out_of_range" }));
    expect(r.effectiveState).toBe("unverified");
    expect(r.demoted).toBe(true);
    expect(r.reason).toBe("offsets_out_of_range");
  });

  it("fail-closed: DEMOTES supported when the source text cannot be resolved (no fresh pass possible)", () => {
    const r = decideServedState(served("c1", "supported", { ok: false, reason: "source_unavailable" }));
    expect(r.effectiveState).toBe("unverified");
    expect(r.demoted).toBe(true);
    expect(r.reason).toBe("source_unavailable");
  });

  it("fail-closed: DEMOTES supported with no bound span (a supported claim must carry one)", () => {
    const r = decideServedState(served("c1", "supported", { ok: false, reason: "no_bound_span" }));
    expect(r.effectiveState).toBe("unverified");
    expect(r.demoted).toBe(true);
    expect(r.reason).toBe("no_bound_span");
  });

  it("inferred with no bound span is NOT demoted — its label never asserted a Layer-1 binding", () => {
    const r = decideServedState(served("c1", "inferred", { ok: false, reason: "no_bound_span" }));
    expect(r.effectiveState).toBe("inferred");
    expect(r.demoted).toBe(false);
    expect(r.fresh).toBeNull();
  });

  it("inferred WITH a span that rotted IS demoted", () => {
    const r = decideServedState(served("c1", "inferred", { ok: false, reason: "stale_source" }));
    expect(r.effectiveState).toBe("unverified");
    expect(r.demoted).toBe(true);
  });

  it("NEVER promotes: a passing recheck cannot lift unverified into supported", () => {
    const r = decideServedState(served("c1", "unverified", { ok: true, match: "exact" }));
    expect(r.effectiveState).toBe("unverified");
    expect(r.demoted).toBe(false);
    expect(r.fresh).toBeNull(); // not freshness-gated
  });

  it("passes non-support states straight through (contradicted, excluded)", () => {
    for (const state of ["contradicted", "excluded"] as const) {
      const r = decideServedState(served("c1", state, { ok: false, reason: "stale_source" }));
      expect(r.effectiveState).toBe(state);
      expect(r.demoted).toBe(false);
    }
  });
});

describe("summarizeReadTimeRecheck — served-truth recompute", () => {
  it("counts rechecked/fresh/demoted and groups demotion reasons; applied only when a pass ran", () => {
    const results = decideServedStates([
      served("a", "supported", { ok: true, match: "exact" }),
      served("b", "supported", { ok: false, reason: "stale_source" }),
      served("c", "supported", { ok: false, reason: "stale_source" }),
      served("d", "supported", { ok: false, reason: "span_lost" }),
      served("e", "inferred", { ok: false, reason: "no_bound_span" }), // not gated, no pass
      served("f", "unverified", { ok: true, match: "exact" }), // not gated, no pass
    ]);
    const summary = summarizeReadTimeRecheck(results);
    expect(summary.applied).toBe(true);
    expect(summary.rechecked).toBe(4); // a,b,c,d
    expect(summary.fresh).toBe(1); // a
    expect(summary.demoted).toBe(3); // b,c,d
    expect(summary.demoted_by_reason).toEqual({ stale_source: 2, span_lost: 1 });
  });

  it("reports applied=false when no gated claim had a runnable recheck", () => {
    const results = decideServedStates([
      served("e", "inferred", { ok: false, reason: "no_bound_span" }),
      served("f", "unverified", { ok: true, match: "exact" }),
    ]);
    expect(summarizeReadTimeRecheck(results)).toMatchObject({ applied: false, rechecked: 0, demoted: 0 });
  });
});

describe("applyDemotionsToSummary — adjust the stored per-state map", () => {
  it("moves demoted claims out of their stored bucket into unverified", () => {
    const results = decideServedStates([
      served("a", "supported", { ok: true, match: "exact" }),
      served("b", "supported", { ok: false, reason: "stale_source" }),
      served("c", "supported", { ok: false, reason: "span_lost" }),
    ]);
    const served0 = { supported: 3, unverified: 1 };
    expect(applyDemotionsToSummary(served0, results)).toEqual({ supported: 1, unverified: 3 });
  });

  it("clamps at zero and drops emptied non-unverified buckets", () => {
    const results = decideServedStates([served("b", "supported", { ok: false, reason: "stale_source" })]);
    // inconsistent input (supported count 0): never produces a negative count
    expect(applyDemotionsToSummary({ supported: 1 }, results)).toEqual({ unverified: 1 });
  });

  it("does not mutate the input map", () => {
    const results = decideServedStates([served("b", "supported", { ok: false, reason: "stale_source" })]);
    const input = { supported: 2 };
    applyDemotionsToSummary(input, results);
    expect(input).toEqual({ supported: 2 });
  });
});

describe("buildRecheckAuditRows — persistence projection (migration 074)", () => {
  it("emits one row per attempted recheck: 'fresh' or the failure reason, with the supplied time", () => {
    const at = "2026-06-28T10:00:00.000Z";
    const results = decideServedStates([
      served("a", "supported", { ok: true, match: "normalized" }),
      served("b", "supported", { ok: false, reason: "stale_source" }),
      served("e", "inferred", { ok: false, reason: "no_bound_span" }), // no pass → no row
    ]);
    expect(buildRecheckAuditRows(results, at)).toEqual([
      { unitId: "a", result: "fresh", checkedAt: at },
      { unitId: "b", result: "stale_source", checkedAt: at },
    ]);
  });
});

// ── End-to-end with the REAL deterministic Layer-1 binder/verifier ────────────
// Proves the engine composes correctly with the actual binding code, not just synthetic
// outcomes: bind a quote, then mutate the source so the live recheck fails, and confirm
// the served state demotes.
describe("integration with verifyEvidenceSpan (real Layer-1)", () => {
  const SOURCE =
    "Mill distinguished higher pleasures, those of the intellect, from lower bodily pleasures.";

  function rtOutcomeFor(span: EvidenceSpan, sourceText: string, sourceHash: string): ReadTimeRecheckOutcome {
    const v = verifyEvidenceSpan({ span, sourceText, sourceHash });
    if (v.ok) return { ok: true, match: v.match };
    if (v.reason === "hash_mismatch") return { ok: false, reason: "stale_source" };
    if (v.reason === "text_changed") return { ok: false, reason: "span_lost" };
    return { ok: false, reason: "offsets_out_of_range" };
  }

  it("stays supported against the unchanged source version", async () => {
    const hash = await contentHash(SOURCE);
    const binding = bindEvidenceSpan({
      quote: "higher pleasures",
      sourceText: SOURCE,
      sourceHash: hash,
    });
    expect(binding.status).toBe("bound");
    const span = (binding as { status: "bound"; span: EvidenceSpan }).span;
    const r = decideServedState({
      id: "u1",
      storedState: "supported",
      outcome: rtOutcomeFor(span, SOURCE, hash),
    });
    expect(r.effectiveState).toBe("supported");
  });

  it("demotes supported once the source content (and hash) changes", async () => {
    const hash = await contentHash(SOURCE);
    const binding = bindEvidenceSpan({
      quote: "higher pleasures",
      sourceText: SOURCE,
      sourceHash: hash,
    });
    const span = (binding as { status: "bound"; span: EvidenceSpan }).span;
    const newSource = SOURCE.replace("higher pleasures", "different pleasures");
    const newHash = await contentHash(newSource);
    const r = decideServedState({
      id: "u1",
      storedState: "supported",
      outcome: rtOutcomeFor(span, newSource, newHash),
    });
    expect(r.effectiveState).toBe("unverified");
    expect(r.demoted).toBe(true);
    expect(r.reason).toBe("stale_source");
  });
});
