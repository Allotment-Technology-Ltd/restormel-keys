import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PHILOSOPHY_DOMAIN_PACK } from "@restormel/contracts/connect";
import {
  aggregateRuns,
  collectValidationVerdicts,
  scoreOutcomes,
  validateEfficacyFixture,
  type ClaimVerdict,
  type EfficacyClaim,
  type EfficacyFixture,
} from "../ingest/verifier-efficacy.js";

const fixturePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../ingest/golden/fixtures/verifier-efficacy-v1.json",
);
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as EfficacyFixture;

function hydratePack() {
  return {
    id: "00000000-0000-4000-8000-000000000000",
    workspace_id: "00000000-0000-4000-8000-000000000001",
    is_builtin: false,
    created_at: "2026-06-09T00:00:00.000Z",
    updated_at: "2026-06-09T00:00:00.000Z",
    ...PHILOSOPHY_DOMAIN_PACK,
    prompts: PHILOSOPHY_DOMAIN_PACK.prompts ?? {},
  } as Parameters<typeof collectValidationVerdicts>[0]["pack"];
}

describe("verifier-efficacy fixture v1", () => {
  it("is structurally valid", () => {
    expect(validateEfficacyFixture(fixture)).toEqual([]);
  });

  it("has all three tiers populated and a supported majority signal", () => {
    const byTier = (t: string) => fixture.claims.filter((c) => c.tier === t).length;
    expect(byTier("fabricated")).toBeGreaterThanOrEqual(3);
    expect(byTier("overstated")).toBeGreaterThanOrEqual(3);
    expect(byTier("misattributed")).toBeGreaterThanOrEqual(3);
    expect(fixture.claims.filter((c) => c.label === "supported").length).toBeGreaterThanOrEqual(12);
  });

  it("hard tier geometry: beyond_window evidence really is past the 12k validation window", () => {
    // buildValidationUserPrompt slices sourceText to 12000 chars; the H2 probe is only
    // valid if the late evidence genuinely falls outside that slice. Guard the fixture's
    // geometry so future edits to the survey text can't silently break the probe.
    const survey = fixture.sources.find((s) => s.id === "src-survey-long")!;
    expect(survey.text.length).toBeGreaterThan(12000);
    for (const marker of [
      "caring-for",
      "holism of reasons",
      "Care ethicists criticise",
      "gratuitous pain",
      "justice and care are complementary",
    ]) {
      expect(survey.text.indexOf(marker)).toBeGreaterThan(12000);
    }
    // And the early-window supported claims' evidence must be INSIDE the slice.
    expect(survey.text.indexOf("reflective equilibrium")).toBeLessThan(12000);
    expect(survey.text.indexOf("no fixed ranking")).toBeLessThan(12000);
    const beyond = fixture.claims.filter((c) => c.beyond_window);
    expect(beyond.length).toBeGreaterThanOrEqual(7);
    for (const c of beyond) expect(c.source_id).toBe("src-survey-long");
  });

  it("misattributed claims cite a source that does not contain them but evidence source plausibly does", () => {
    const textById = new Map(fixture.sources.map((s) => [s.id, s.text.toLowerCase()]));
    for (const claim of fixture.claims.filter((c) => c.tier === "misattributed")) {
      // A distinctive fragment of the claim should NOT appear in the cited source.
      const fragment = claim.text.toLowerCase().slice(0, 40);
      expect(textById.get(claim.source_id)).not.toContain(fragment);
      expect(claim.evidence_source_id).toBeTruthy();
    }
  });
});

describe("scoreOutcomes", () => {
  const claims: EfficacyClaim[] = [
    { id: "g1", source_id: "s", text: "good", label: "supported", rationale: "r" },
    { id: "g2", source_id: "s", text: "good", label: "supported", rationale: "r" },
    { id: "g3", source_id: "s", text: "good", label: "supported", rationale: "r" },
    { id: "b1", source_id: "s", text: "bad", label: "unsupported", tier: "fabricated", rationale: "r" },
    { id: "b2", source_id: "s", text: "bad", label: "unsupported", tier: "fabricated", rationale: "r" },
    { id: "b3", source_id: "s", text: "bad", label: "unsupported", tier: "overstated", rationale: "r" },
    {
      id: "b4", source_id: "s", text: "bad", label: "unsupported", tier: "misattributed",
      evidence_source_id: "s2", rationale: "r",
    },
  ];

  it("separates caught-by-verdict from defaulted-by-coverage (the PR #189 rule)", () => {
    const verdicts = new Map<string, ClaimVerdict>([
      ["g1", "ok"],
      ["g2", "weak"], // false flag
      ["g3", "omitted"], // coverage gap on a good claim
      ["b1", "unsupported"], // true catch
      ["b2", "omitted"], // NOT a catch — coverage default
      ["b3", "ok"], // miss
      ["b4", "weak"], // true catch
    ]);
    const r = scoreOutcomes(claims, verdicts);
    expect(r.supported).toEqual({ total: 3, correct: 1, false_flag: 1, omitted: 1, false_flag_rate: 0.5 });
    expect(r.tiers.fabricated.caught_by_verdict).toBe(1);
    expect(r.tiers.fabricated.defaulted_by_coverage).toBe(1);
    expect(r.tiers.fabricated.recall_strict).toBe(0.5);
    expect(r.tiers.fabricated.recall_with_coverage).toBe(1);
    expect(r.tiers.overstated.missed).toBe(1);
    expect(r.tiers.overstated.recall_strict).toBe(0);
    expect(r.tiers.misattributed.recall_strict).toBe(1);
    expect(r.all_bad.total).toBe(4);
    expect(r.all_bad.caught_by_verdict).toBe(2);
    expect(r.all_bad.recall_strict).toBe(0.5);
    expect(r.all_bad.verdict_weak).toBe(1);
    expect(r.all_bad.verdict_unsupported).toBe(1);
    expect(r.unscored).toEqual([]);
  });

  it("reports unscored claims instead of silently dropping them", () => {
    const r = scoreOutcomes(claims, new Map([["g1", "ok" as ClaimVerdict]]));
    expect(r.unscored.sort()).toEqual(["b1", "b2", "b3", "b4", "g2", "g3"]);
  });

  it("window probe: affirming unseen evidence counts as failing open", () => {
    const probeClaims: EfficacyClaim[] = [
      { id: "sl1", source_id: "s", text: "late good", label: "supported", beyond_window: true, rationale: "r" },
      { id: "sl2", source_id: "s", text: "late good", label: "supported", beyond_window: true, rationale: "r" },
      { id: "bl1", source_id: "s", text: "late bad", label: "unsupported", tier: "fabricated", beyond_window: true, rationale: "r" },
      { id: "e1", source_id: "s", text: "early good", label: "supported", rationale: "r" },
    ];
    const r = scoreOutcomes(probeClaims, new Map<string, ClaimVerdict>([
      ["sl1", "ok"], // affirmed without visible evidence — fail-open
      ["sl2", "weak"], // safe flag under truncation
      ["bl1", "ok"], // missed bad-late claim — also fail-open
      ["e1", "ok"],
    ]));
    expect(r.window_probe.supported_late).toEqual({
      total: 2, affirmed_unseen: 1, flagged: 1, omitted: 0, affirm_unseen_rate: 0.5,
    });
    expect(r.window_probe.bad_late.total).toBe(1);
    expect(r.window_probe.bad_late.missed).toBe(1);
    expect(r.window_probe.bad_late.recall_strict).toBe(0);
    // beyond_window bad claims still count in their tier + all_bad too.
    expect(r.tiers.fabricated.missed).toBe(1);
  });
});

describe("collectValidationVerdicts", () => {
  it("tracks omissions explicitly and remaps short refs (independent of finalize semantics)", async () => {
    // Stub validator: returns verdicts for v1 and v2 only; v3 is omitted.
    const stubGenerate = async () =>
      JSON.stringify({
        results: [
          { ref: "v1", status: "ok" },
          { ref: "v2", status: "unsupported", note: "no basis" },
        ],
      });
    const verdicts = await collectValidationVerdicts({
      units: [
        { ref: "claim:aaa", text: "A" },
        { ref: "claim:bbb", text: "B" },
        { ref: "claim:ccc", text: "C" },
      ],
      sourceText: "Some source text.",
      pack: hydratePack(),
      generate: stubGenerate,
    });
    expect(verdicts.get("claim:aaa")).toBe("ok");
    expect(verdicts.get("claim:bbb")).toBe("unsupported");
    expect(verdicts.get("claim:ccc")).toBe("omitted");
  });

  it("treats a fully garbled response as all-omitted (parse loss is not a catch)", async () => {
    const verdicts = await collectValidationVerdicts({
      units: [
        { ref: "a", text: "A" },
        { ref: "b", text: "B" },
      ],
      sourceText: "Source.",
      pack: hydratePack(),
      generate: async () => "not json at all",
    });
    expect(verdicts.get("a")).toBe("omitted");
    expect(verdicts.get("b")).toBe("omitted");
  });
});

describe("aggregateRuns", () => {
  it("computes mean and spread across stochastic runs", () => {
    const claims: EfficacyClaim[] = [
      { id: "b1", source_id: "s", text: "bad", label: "unsupported", tier: "fabricated", rationale: "r" },
      { id: "b2", source_id: "s", text: "bad", label: "unsupported", tier: "fabricated", rationale: "r" },
      { id: "g1", source_id: "s", text: "good", label: "supported", rationale: "r" },
    ];
    const run1 = scoreOutcomes(claims, new Map<string, ClaimVerdict>([
      ["b1", "unsupported"], ["b2", "unsupported"], ["g1", "ok"],
    ]));
    const run2 = scoreOutcomes(claims, new Map<string, ClaimVerdict>([
      ["b1", "unsupported"], ["b2", "ok"], ["g1", "weak"],
    ]));
    const agg = aggregateRuns([run1, run2]);
    expect(agg.runs).toBe(2);
    expect(agg.tiers.fabricated.recall_strict.mean).toBeCloseTo(0.75);
    expect(agg.tiers.fabricated.recall_strict.min).toBe(0.5);
    expect(agg.tiers.fabricated.recall_strict.max).toBe(1);
    expect(agg.tiers.fabricated.recall_strict.stddev).toBeCloseTo(0.25);
    expect(agg.supported_false_flag_rate.mean).toBeCloseTo(0.5);
  });
});
