/**
 * RES-113 verification-UI PR-0 byte-identity pins (placement spec §5 item 1).
 *
 * PR-0 (cascade → triage feeder) is server-only and touches NO dashboard derivation.
 * These pins lock the exact shipped strings/verdicts the spec names as must-not-change:
 *   • the three make-ready gate detail/label strings ("{n} flagged of {m}", "all triaged", …),
 *   • `resolveMarkReady`'s verbatim block reason,
 *   • `deriveHomeState().showVerifyGhost` gating.
 * A byte-level diff in any of these fails here — the guard the spec requires that PR-0
 * leave the flag-OFF surface pixel/byte-identical.
 */
import { describe, it, expect } from "vitest";
import {
  buildValidateGate,
  buildSourcesGate,
  buildEmbedGate,
  resolveMarkReady,
  type MakeReadySignals,
} from "./make-ready-hub";
import { deriveHomeState, type HomeStateSignals } from "./home-state";

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

describe("PR-0 pin — gate strings byte-identical", () => {
  it("Validate gate flagged/triaged strings are unchanged", () => {
    const flagged = buildValidateGate(
      signals({ validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 } }),
    );
    // considered = triaged (1157) + awaitingTriage (47) = 1,204.
    expect(flagged.detail).toBe("47 flagged of 1,204");
    expect(flagged.chipLabel).toBe("Needs review");
    expect(buildValidateGate(signals()).detail).toBe("0 flagged · all triaged");
  });

  it("Sources + Embed gate receipt strings are unchanged", () => {
    expect(buildSourcesGate(signals()).detail).toBe("all 1,204 grounded");
    expect(
      buildSourcesGate(signals({ evidence: { bound: 1040, unbound: 150, noEvidence: 14, boundPct: 86 } })).detail,
    ).toBe("164 need a link");
    expect(buildEmbedGate(signals()).detail).toBe("1,204 vectors");
  });
});

describe("PR-0 pin — resolveMarkReady verbatim reasons unchanged", () => {
  it("blocks with the exact multi-claim triage reason", () => {
    const v = resolveMarkReady(
      signals({ validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 } }),
    );
    expect(v.ready).toBe(false);
    expect(v.reason).toBe(
      "47 claims still need a verdict — triage them (Accept, Weaken, or Unsupported).",
    );
  });

  it("blocks with the exact single-claim reason", () => {
    const v = resolveMarkReady(
      signals({ validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 1, unsupportedUntriaged: 0 } }),
    );
    expect(v.reason).toBe(
      "1 claim still needs a verdict — triage it (Accept, Weaken, or Unsupported).",
    );
  });

  it("clears when every claim is triaged", () => {
    expect(resolveMarkReady(signals()).ready).toBe(true);
  });
});

describe("PR-0 pin — showVerifyGhost gating unchanged", () => {
  function home(over: Partial<HomeStateSignals> = {}): HomeStateSignals {
    return {
      trustScore: 88,
      units: 1204,
      connectionCount: 1,
      latestJob: { id: "j", status: "succeeded" },
      awaitingTriage: 0,
      ...over,
    };
  }

  it("no ghost with zero outstanding triage", () => {
    expect(deriveHomeState(home()).showVerifyGhost).toBe(false);
  });

  it("ghost shows with outstanding triage on a built+connected graph, carrying the flagged count", () => {
    const s = deriveHomeState(home({ awaitingTriage: 47 }));
    expect(s.showVerifyGhost).toBe(true);
    expect(s.flaggedCount).toBe(47);
  });
});
