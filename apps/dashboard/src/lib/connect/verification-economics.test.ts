/**
 * RES-113 PR-8 — verification-engine economics derivation (placement spec §3.3 /
 * §5 item 9; copy pack §2.8). Pins:
 *  - every §2.8 string byte-for-byte (labels, glosses, line template, singulars);
 *  - ABSENT-NOT-ZERO — a missing measurement yields no row / no segment, never a
 *    fabricated `0` or `—` (rubric Blocker "fabricated state");
 *  - a run/corpus with no recorded economics renders nothing at all;
 *  - derivation from the merged cascade economics module's per-corpus report
 *    (packages/connect-core/src/cascade/economics.ts);
 *  - no tier/cache/cascade vocabulary in any output string (§2.8: "no tier or
 *    cache vocabulary anywhere").
 */
import { describe, it, expect } from "vitest";
import type { EconomicsReport } from "@restormel/connect-core/cascade";
import {
  VERIFICATION_ECONOMICS_ROW_COPY,
  VERIFICATION_ECONOMICS_SECTION_HEADING,
  aggregateEconomicsByCorpus,
  buildRunEconomicsSummary,
  economicsFromReport,
  formatSpendUsd,
  parseRunVerificationEconomics,
  resolveVerificationEconomicsRows,
} from "./verification-economics";

const FULL = {
  corpus: "Contracts",
  facts_checked: 1204,
  reused_from_earlier_builds: 302,
  sent_for_closer_look: 41,
  awaiting_review: 7,
  spend_usd: 1.42,
};

function report(overrides: Partial<EconomicsReport> = {}): EconomicsReport {
  const est = (value: number, n: number) => ({ value, se: 0, ci95: 0, n });
  return {
    corpus: "Contracts",
    mode: "batch",
    claims: 1204,
    costPerVerifiedClaim: est(0.002, 700),
    cacheHitRate: est(302 / 1204, 1204),
    tierDistribution: {},
    abstentionRate: est(7 / 1204, 1204),
    latencyPerTierMs: {},
    escalationRate: est(41 / 1204, 1204),
    claimsWithAuthoritativeCost: 700,
    cacheAvoidedCostUsd: null,
    ...overrides,
  };
}

describe("copy pack §2.8 strings — byte-for-byte", () => {
  it("Metrics row labels and glosses are the registered strings", () => {
    expect(VERIFICATION_ECONOMICS_ROW_COPY.facts_checked.label).toBe("Facts checked");
    expect(VERIFICATION_ECONOMICS_ROW_COPY.facts_checked.gloss).toBe(
      "How many facts were checked against the documents they came from.",
    );
    expect(VERIFICATION_ECONOMICS_ROW_COPY.reused_from_earlier_builds.label).toBe(
      "Re-used from earlier builds",
    );
    expect(VERIFICATION_ECONOMICS_ROW_COPY.reused_from_earlier_builds.gloss).toBe(
      "Results carried over from an earlier build instead of being checked again.",
    );
    expect(VERIFICATION_ECONOMICS_ROW_COPY.sent_for_closer_look.label).toBe(
      "Sent for a closer look",
    );
    expect(VERIFICATION_ECONOMICS_ROW_COPY.sent_for_closer_look.gloss).toBe(
      "Facts the quick check couldn't settle, passed to a stronger check.",
    );
    expect(VERIFICATION_ECONOMICS_ROW_COPY.awaiting_review.label).toBe("Awaiting review");
    expect(VERIFICATION_ECONOMICS_ROW_COPY.awaiting_review.gloss).toBe(
      "Facts waiting for your verdict in Verify.",
    );
    expect(VERIFICATION_ECONOMICS_ROW_COPY.spend_usd.label).toBe("Spend");
    expect(VERIFICATION_ECONOMICS_ROW_COPY.spend_usd.gloss).toBe(
      "What the checks cost to run, across providers.",
    );
  });

  it("the section heading is the §0 stage-table name (reference, not a new string)", () => {
    expect(VERIFICATION_ECONOMICS_SECTION_HEADING).toBe("Checking against sources");
  });

  it("per-run summary line matches the registered template exactly", () => {
    expect(buildRunEconomicsSummary(FULL)).toBe(
      "Checked 1,204 facts · 302 re-used from earlier builds · 41 sent for a closer look · 7 awaiting your review · $1.42 spent.",
    );
  });

  it("segment singulars match the registered variants", () => {
    expect(
      buildRunEconomicsSummary({
        facts_checked: 1,
        reused_from_earlier_builds: 1,
        sent_for_closer_look: 1,
        awaiting_review: 1,
      }),
    ).toBe(
      "Checked 1 fact · 1 re-used from an earlier build · 1 sent for a closer look · 1 awaiting your review.",
    );
  });
});

describe("honest absence — ABSENT-NOT-ZERO (§2.8, load-bearing)", () => {
  it("a missing measurement yields NO row — never a 0 or — placeholder", () => {
    const rows = resolveVerificationEconomicsRows({ facts_checked: 12, awaiting_review: 3 });
    expect(rows.map((r) => r.key)).toEqual(["facts_checked", "awaiting_review"]);
    for (const row of rows) {
      expect(row.value).not.toBe("0");
      expect(row.value).not.toBe("—");
    }
  });

  it("a RECORDED zero is a real counted unit and does render", () => {
    const rows = resolveVerificationEconomicsRows({
      facts_checked: 12,
      reused_from_earlier_builds: 0,
    });
    expect(rows.map((r) => r.key)).toEqual(["facts_checked", "reused_from_earlier_builds"]);
    expect(rows[1]!.value).toBe("0");
  });

  it("no recorded measurements ⇒ zero rows (the section earns no pixels)", () => {
    expect(resolveVerificationEconomicsRows({})).toEqual([]);
    expect(resolveVerificationEconomicsRows({ corpus: "Contracts" })).toEqual([]);
  });

  it("each line segment renders independently; missing segments are absent", () => {
    expect(buildRunEconomicsSummary({ awaiting_review: 1 })).toBe("1 awaiting your review.");
    expect(buildRunEconomicsSummary({ facts_checked: 2, spend_usd: 0.31 })).toBe(
      "Checked 2 facts · $0.31 spent.",
    );
  });

  it("a run with no recorded economics renders no summary line at all", () => {
    expect(buildRunEconomicsSummary(null)).toBeNull();
    expect(buildRunEconomicsSummary(undefined)).toBeNull();
    expect(buildRunEconomicsSummary([])).toBeNull();
    expect(buildRunEconomicsSummary({})).toBeNull();
  });

  it("rows render in the pack's table order regardless of input", () => {
    expect(resolveVerificationEconomicsRows(FULL).map((r) => r.label)).toEqual([
      "Facts checked",
      "Re-used from earlier builds",
      "Sent for a closer look",
      "Awaiting review",
      "Spend",
    ]);
  });
});

describe("derivation from the cascade economics module (per-corpus states)", () => {
  it("recovers the real counted units from a per-corpus EconomicsReport", () => {
    const m = economicsFromReport(report());
    expect(m).toEqual({
      corpus: "Contracts",
      facts_checked: 1204,
      reused_from_earlier_builds: 302,
      sent_for_closer_look: 41,
      awaiting_review: 7,
      spend_usd: 0.002 * 700,
    });
  });

  it("a report over zero claims recorded nothing → null, never zero rows", () => {
    expect(economicsFromReport(report({ claims: 0 }))).toBeNull();
  });

  it("spend is ABSENT when no claim carried an authoritative cost — never $0.00", () => {
    const m = economicsFromReport(report({ claimsWithAuthoritativeCost: 0 }));
    expect(m).not.toBeNull();
    expect(m!.spend_usd).toBeUndefined();
    const rows = resolveVerificationEconomicsRows(m!);
    expect(rows.some((r) => r.key === "spend_usd")).toBe(false);
    expect(buildRunEconomicsSummary(m!)).not.toContain("spent");
  });
});

describe("aggregation and defensive parsing", () => {
  it("aggregates per corpus; absent fields stay absent across runs", () => {
    const out = aggregateEconomicsByCorpus([
      { corpus: "Contracts", facts_checked: 10, spend_usd: 0.5 },
      { corpus: "Contracts", facts_checked: 5, awaiting_review: 2 },
      { corpus: "Policies", facts_checked: 3 },
    ]);
    expect(out).toEqual([
      { corpus: "Contracts", facts_checked: 15, awaiting_review: 2, spend_usd: 0.5 },
      { corpus: "Policies", facts_checked: 3 },
    ]);
    expect(out[0]!.reused_from_earlier_builds).toBeUndefined();
    expect(out[0]!.sent_for_closer_look).toBeUndefined();
  });

  it("parse drops junk, negative, and non-finite values field-by-field", () => {
    const parsed = parseRunVerificationEconomics([
      { corpus: "Contracts", facts_checked: 7, awaiting_review: -1, spend_usd: "12" },
      { facts_checked: Number.NaN },
      "junk",
      null,
    ]);
    expect(parsed).toEqual([{ corpus: "Contracts", facts_checked: 7 }]);
  });

  it("parse of an entry with no recorded measurement yields nothing", () => {
    expect(parseRunVerificationEconomics([{ corpus: "Contracts" }])).toEqual([]);
    expect(parseRunVerificationEconomics(undefined)).toEqual([]);
  });
});

describe("vocabulary guard — no tier/cache jargon, no fabricated dashes", () => {
  it("no output string ever carries tier/cache/cascade/escalation vocabulary", () => {
    const banned = /tier|cache|cascade|escalat|corpus|token|frontier/i;
    const rows = resolveVerificationEconomicsRows(FULL);
    for (const row of rows) {
      expect(row.label).not.toMatch(banned);
      expect(row.gloss).not.toMatch(banned);
      expect(row.value).not.toMatch(banned);
    }
    expect(buildRunEconomicsSummary(FULL)).not.toMatch(banned);
    expect(VERIFICATION_ECONOMICS_SECTION_HEADING).not.toMatch(banned);
  });

  it("sub-cent authoritative spend keeps precision instead of faking $0.00", () => {
    expect(formatSpendUsd(0.0042)).toBe("$0.0042");
    expect(formatSpendUsd(1.4)).toBe("$1.40");
    expect(formatSpendUsd(0)).toBe("$0.00");
  });
});
