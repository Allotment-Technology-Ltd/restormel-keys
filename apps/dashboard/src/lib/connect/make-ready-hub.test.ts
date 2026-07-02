/**
 * M2 make-ready hub pure-logic tests (RES-113 PR-D).
 *
 * Pins the two honesty invariants the hub exists to protect:
 *   1. "Ready" = every claim triaged, NOT all-green (accept-guard) — a graph with
 *      honestly-weak claims can still be production-grade.
 *   2. The trust meter shows a deferred / verified STATE, never a climbing number.
 */
import { describe, it, expect } from "vitest";
import {
  buildMakeReadyGates,
  buildSourcesGate,
  buildEmbedGate,
  buildValidateGate,
  buildTrustMeter,
  resolveMarkReady,
  makeReadySummary,
  resolveM2Surface,
  isVerifyOutstanding,
  type MakeReadySignals,
  type M2SurfaceSignals,
} from "./make-ready-hub";

function signals(over: Partial<MakeReadySignals> = {}): MakeReadySignals {
  return {
    trustScore: 88,
    lastVerifiedAt: "2026-06-27T10:00:00.000Z",
    units: 1204,
    embedded: 1204,
    evidence: { bound: 1204, unbound: 0, noEvidence: 0, boundPct: 100 },
    validation: { ok: 1157, weak: 35, unsupported: 12, unvalidated: 0, awaitingTriage: 0, unsupportedUntriaged: 0 },
    ...over,
  };
}

describe("make-ready gates", () => {
  it("Sources gate is done·auto when everything is bound, needs-you when not", () => {
    expect(buildSourcesGate(signals()).state).toBe("done_auto");
    const partial = buildSourcesGate(
      signals({ evidence: { bound: 1040, unbound: 150, noEvidence: 14, boundPct: 86 } }),
    );
    expect(partial.state).toBe("needs_you");
    expect(partial.needsYou).toBe(true);
    expect(partial.pct).toBe(86);
    expect(partial.detail).toContain("164 need a link");
  });

  it("Sources gate reports 'computing' (running) when the scorecard could not be read — never fakes done", () => {
    const g = buildSourcesGate(signals({ evidence: null }));
    expect(g.state).toBe("running");
    expect(g.needsYou).toBe(false);
  });

  it("Embed gate runs itself: done·auto at full coverage, running (not done) below it", () => {
    expect(buildEmbedGate(signals()).state).toBe("done_auto");
    const g = buildEmbedGate(signals({ embedded: 900, units: 1204 }));
    expect(g.state).toBe("running");
    expect(g.needsYou).toBe(false); // never asks the user
    expect(g.pct).toBe(75);
  });

  it("Validate gate is needs-review while claims await a verdict, done·auto once triaged", () => {
    const pending = buildValidateGate(
      signals({ validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 } }),
    );
    expect(pending.state).toBe("needs_review");
    expect(pending.chipState).toBe("error");
    expect(pending.detail).toContain("47 flagged");

    const done = buildValidateGate(signals());
    expect(done.state).toBe("done_auto");
    expect(done.detail).toContain("all triaged");
  });
});

describe("pre-graph honesty (units <= 0, retained until PR-6a surface gating)", () => {
  // The M2 hub still mounts unconditionally under the flag, so the gate builders
  // must name the honest pre-graph state on an empty workspace rather than flip to a
  // fabricated DONE (0 unbound ⇒ "grounded", 0 >= 0 ⇒ "vectors", 0 awaiting ⇒
  // "triaged"). REC-ADR-016: never fabricate progress in EITHER direction.
  it("Sources gate reports 'no ideas yet' (running, not done) when there are no units", () => {
    const g = buildSourcesGate(signals({ units: 0, evidence: { bound: 0, unbound: 0, noEvidence: 0, boundPct: 0 } }));
    expect(g.state).toBe("running");
    expect(g.detail).toBe("no ideas yet");
    expect(g.needsYou).toBe(false);
  });

  it("Embed gate reports 'no ideas yet' (running) at units 0 — never '0 vectors · Done'", () => {
    const g = buildEmbedGate(signals({ units: 0, embedded: 0 }));
    expect(g.state).toBe("running");
    expect(g.detail).toBe("no ideas yet");
    expect(g.pct).toBeNull();
  });

  it("Validate gate reports 'no ideas yet' (running) at units 0 — never 'all triaged · Done'", () => {
    const g = buildValidateGate(
      signals({ units: 0, validation: { ok: 0, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 0, unsupportedUntriaged: 0 } }),
    );
    expect(g.state).toBe("running");
    expect(g.detail).toBe("no ideas yet");
    expect(g.needsYou).toBe(false);
  });

  it("no gate needs the user on an empty workspace (summary reads 'all gates clear', but none are DONE)", () => {
    const empty = signals({
      units: 0,
      embedded: 0,
      evidence: { bound: 0, unbound: 0, noEvidence: 0, boundPct: 0 },
      validation: { ok: 0, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 0, unsupportedUntriaged: 0 },
    });
    for (const g of buildMakeReadyGates(empty)) {
      expect(g.state).toBe("running");
      expect(g.needsYou).toBe(false);
    }
  });
});

describe("mark-ready guard (accept-guard honesty)", () => {
  it("clears the bar when every claim is TRIAGED even though weak + unsupported are non-zero", () => {
    // 35 weak + 12 unsupported, but all triaged (awaitingTriage 0) → production-grade.
    const v = resolveMarkReady(signals());
    expect(v.ready).toBe(true);
    expect(v.reason).toBeNull();
    expect(v.outstandingTriage).toBe(0);
  });

  it("does NOT require all-green: a fully-triaged graph with weak claims is still ready", () => {
    const v = resolveMarkReady(
      signals({ validation: { ok: 10, weak: 990, unsupported: 200, unvalidated: 0, awaitingTriage: 0, unsupportedUntriaged: 0 } }),
    );
    expect(v.ready).toBe(true);
  });

  it("blocks with a verbatim reason while claims still await a verdict", () => {
    const v = resolveMarkReady(
      signals({ validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 } }),
    );
    expect(v.ready).toBe(false);
    expect(v.reason).toContain("47 claims still need a verdict");
    expect(v.outstandingTriage).toBe(47);
  });

  // RES-113 PR-2 (REC-ADR-016, honest pre-graph state): the `units <= 0` branch is
  // RETAINED until PR-6a gates the hub on `resolveM2Surface`. `M2VerifyHub` still
  // mounts unconditionally under the flag, so an empty workspace must NOT read as
  // ready — that would be a fabricated DONE. The guard blocks with the honest
  // "No graph yet" reason regardless of the (vacuously-zero) triage count.
  it("does NOT report ready on an empty workspace — blocks with 'No graph yet'", () => {
    const v = resolveMarkReady(signals({ units: 0, trustScore: null }));
    expect(v.ready).toBe(false);
    expect(v.reason).toBe("No graph yet — run an ingest first.");
    expect(v.outstandingTriage).toBe(0);
  });
});

describe("trust meter (deferred, not climbing)", () => {
  it("shows a pending recompute STATE while triage is outstanding (no animated number)", () => {
    const m = buildTrustMeter(
      signals({ trustScore: 88, validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 } }),
    );
    expect(m.score).toBe(88); // quoted as-is, never tweened
    expect(m.recomputeState).toBe("running");
    expect(m.recomputeLabel).toBe("Recompute pending");
  });

  it("shows verified once the queue is clear", () => {
    expect(buildTrustMeter(signals()).recomputeState).toBe("done");
  });

  it("shows 'no graph yet' (idle) when there is nothing to score", () => {
    const m = buildTrustMeter(signals({ units: 0, trustScore: null }));
    expect(m.recomputeState).toBe("idle");
    expect(m.score).toBeNull();
  });

  it("shows 'no graph yet' (idle) at units 0 even if a stale score leaks through", () => {
    // The retained `units <= 0` half of the guard: an empty workspace is pre-graph
    // regardless of any leftover score (until PR-6a gates the hub on resolveM2Surface).
    const m = buildTrustMeter(signals({ units: 0, trustScore: 88 }));
    expect(m.recomputeState).toBe("idle");
    expect(m.recomputeLabel).toBe("No graph yet");
  });
});

describe("make-ready summary tally", () => {
  it("counts how many gates still need the user", () => {
    const s = signals({
      evidence: { bound: 1040, unbound: 164, noEvidence: 0, boundPct: 86 },
      validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 },
    });
    const summary = makeReadySummary(s);
    expect(summary.gatesNeedingYou).toBe(2); // Sources + Validate (Embed runs itself)
    expect(summary.line).toBe("2 of 3 need you");
    expect(buildMakeReadyGates(s)).toHaveLength(3);
  });

  it("reads 'all gates clear' when nothing needs the user", () => {
    expect(makeReadySummary(signals()).line).toBe("all gates clear");
  });
});

describe("resolveM2Surface (plan §3.3 — the single M2 gate)", () => {
  function m2(over: Partial<M2SurfaceSignals> = {}): M2SurfaceSignals {
    return { graphBuilt: true, makeReadyState: "done", reviewState: "done", ...over };
  }

  it("hidden when no graph is built (zero M2 pixels on Home — the nav tab is wayfinding)", () => {
    expect(resolveM2Surface(m2({ graphBuilt: false }))).toBe("hidden");
    // hidden regardless of any leaked stage state — the graph gate wins.
    expect(resolveM2Surface(m2({ graphBuilt: false, makeReadyState: "current" }))).toBe("hidden");
  });

  it("triage when built with make-ready work outstanding (make_ready is current)", () => {
    expect(resolveM2Surface(m2({ makeReadyState: "current" }))).toBe("triage");
  });

  it("triage when built with review work outstanding (review is current)", () => {
    expect(resolveM2Surface(m2({ reviewState: "current" }))).toBe("triage");
  });

  it("ready when built and all verify work is cleared", () => {
    expect(resolveM2Surface(m2())).toBe("ready");
  });

  it("non-'current' spine states (todo/blocked/done/unknown) are NOT outstanding", () => {
    const states = ["todo", "blocked", "done", "unknown"] as const;
    for (const state of states) {
      expect(resolveM2Surface(m2({ makeReadyState: state, reviewState: state }))).toBe("ready");
    }
  });

  it("isVerifyOutstanding matches resolveM2Surface's triage branch exactly", () => {
    const cases: M2SurfaceSignals[] = [
      m2({ graphBuilt: false, makeReadyState: "current" }),
      m2({ makeReadyState: "current" }),
      m2({ reviewState: "current" }),
      m2(),
    ];
    for (const c of cases) {
      expect(isVerifyOutstanding(c)).toBe(resolveM2Surface(c) === "triage");
    }
  });
});
