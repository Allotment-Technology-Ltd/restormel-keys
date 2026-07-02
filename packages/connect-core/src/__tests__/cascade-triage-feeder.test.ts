/**
 * Cascade → triage feeder tests (RES-113 verification-UI PR-0; placement spec §3.2, §5).
 *
 * Pins the two feeder contracts the placement spec requires:
 *   1. `abstained` lands in EBV `unverified` (the shipped `abstained` inbound alias's
 *      write-side mirror); `unverifiable` does too — both route to human review.
 *   2. `awaitingTriage` counts every non-decisive verdict — the number that feeds
 *      `MakeReadyValidation.awaitingTriage`. Tested WITH abstained inputs.
 * Plus the honesty guard: a cascade `supported` verdict with no bound span degrades to
 * `inferred`, never a fabricated `supported` (skill §4 — nothing laundered into a pass).
 */
import { describe, it, expect } from "vitest";
import {
  ebvStateFromVerdict,
  verdictAwaitsTriage,
  buildTriageFeed,
  type CascadeClaimOutcome,
} from "../cascade/triage-feeder.js";
import type { EvidenceBinding } from "../ingest/evidence-binding.js";
import type { Verdict } from "../cascade/verdict.js";

const BOUND: EvidenceBinding = {
  status: "bound",
  span: { quote: "the term of three years", start: 10, end: 33, source_hash: "abc", match: "exact" },
};
const UNBOUND: EvidenceBinding = { status: "unbound", reason: "quote_not_found" };

describe("ebvStateFromVerdict (cascade Verdict → EBV state)", () => {
  it("abstained lands in EBV 'unverified' (write-side mirror of the shipped abstained alias)", () => {
    expect(ebvStateFromVerdict("abstained", BOUND)).toBe("unverified");
    expect(ebvStateFromVerdict("abstained", UNBOUND)).toBe("unverified");
    expect(ebvStateFromVerdict("abstained")).toBe("unverified");
  });

  it("unverifiable (span silent) also routes to 'unverified' review", () => {
    expect(ebvStateFromVerdict("unverifiable", BOUND)).toBe("unverified");
    expect(ebvStateFromVerdict("unverifiable")).toBe("unverified");
  });

  it("supported requires a bound span — degrades to 'inferred' when unbound or absent (never fabricated)", () => {
    expect(ebvStateFromVerdict("supported", BOUND)).toBe("supported");
    expect(ebvStateFromVerdict("supported", UNBOUND)).toBe("inferred");
    expect(ebvStateFromVerdict("supported")).toBe("inferred");
    expect(ebvStateFromVerdict("supported", null)).toBe("inferred");
  });

  it("contradicted maps straight through", () => {
    expect(ebvStateFromVerdict("contradicted", BOUND)).toBe("contradicted");
  });
});

describe("verdictAwaitsTriage (which verdicts feed awaitingTriage)", () => {
  it("decisive verdicts (supported/contradicted) do NOT await triage", () => {
    expect(verdictAwaitsTriage("supported")).toBe(false);
    expect(verdictAwaitsTriage("contradicted")).toBe(false);
  });

  it("non-decisive verdicts (abstained/unverifiable) DO await triage — never swallowed", () => {
    expect(verdictAwaitsTriage("abstained")).toBe(true);
    expect(verdictAwaitsTriage("unverifiable")).toBe(true);
  });
});

describe("buildTriageFeed (batch projection feeding MakeReadyValidation.awaitingTriage)", () => {
  it("derives awaitingTriage from abstained + unverifiable inputs, with the abstained sub-count", () => {
    const outcomes: CascadeClaimOutcome[] = [
      { ref: "e1", verdict: "supported", binding: BOUND },
      { ref: "e2", verdict: "contradicted", binding: BOUND },
      { ref: "e3", verdict: "abstained", binding: BOUND },
      { ref: "e4", verdict: "abstained", binding: UNBOUND },
      { ref: "e5", verdict: "unverifiable", binding: BOUND },
      { ref: "e6", verdict: "supported", binding: UNBOUND }, // inferred, still decisive → not triaged
    ];
    const feed = buildTriageFeed(outcomes);

    // 2 abstained + 1 unverifiable route to triage; supported/contradicted/inferred do not.
    expect(feed.awaitingTriage).toBe(3);
    expect(feed.abstained).toBe(2);
    expect(feed.awaitingTriageRefs).toEqual(["e3", "e4", "e5"]);
  });

  it("every abstained/unverifiable claim persists as EBV 'unverified'; supported honours binding", () => {
    const outcomes: CascadeClaimOutcome[] = [
      { ref: "e1", verdict: "supported", binding: BOUND },
      { ref: "e2", verdict: "supported", binding: UNBOUND },
      { ref: "e3", verdict: "abstained", binding: BOUND },
      { ref: "e4", verdict: "unverifiable", binding: BOUND },
      { ref: "e5", verdict: "contradicted", binding: BOUND },
    ];
    const feed = buildTriageFeed(outcomes);

    expect(feed.states).toEqual([
      { ref: "e1", state: "supported" },
      { ref: "e2", state: "inferred" },
      { ref: "e3", state: "unverified" },
      { ref: "e4", state: "unverified" },
      { ref: "e5", state: "contradicted" },
    ]);
    expect(feed.counts).toEqual({
      supported: 1,
      inferred: 1,
      unverified: 2,
      contradicted: 1,
      excluded: 0,
    });
  });

  it("an all-abstained batch feeds awaitingTriage = n and marks every claim unverified (never a silent pass)", () => {
    const outcomes: CascadeClaimOutcome[] = Array.from({ length: 47 }, (_, i) => ({
      ref: `e${i}`,
      verdict: "abstained" as Verdict,
      binding: BOUND,
    }));
    const feed = buildTriageFeed(outcomes);

    expect(feed.awaitingTriage).toBe(47);
    expect(feed.abstained).toBe(47);
    expect(feed.counts.unverified).toBe(47);
    expect(feed.counts.supported).toBe(0);
  });

  it("an empty batch yields zeros — an honest absent state, never a fabricated count", () => {
    const feed = buildTriageFeed([]);
    expect(feed.awaitingTriage).toBe(0);
    expect(feed.abstained).toBe(0);
    expect(feed.awaitingTriageRefs).toEqual([]);
    expect(feed.states).toEqual([]);
    expect(feed.counts).toEqual({
      supported: 0,
      inferred: 0,
      unverified: 0,
      contradicted: 0,
      excluded: 0,
    });
  });
});
