/**
 * Stage 3.2 — incremental re-ingest wiring helpers (pure, store-free).
 * Plan→writer-call mapping: claim-version bindings, supersession rows, soft-exclusions,
 * and carried validation verdicts (docs/decisions/verified-memory-incremental-ingest.md).
 */
import { describe, expect, it } from "vitest";
import { bindEvidenceSpan, type ReingestPlan } from "@restormel/connect-core";
import type { PriorClaimVersion } from "@restormel/connect-core";
import {
  buildCarriedValidationRows,
  buildClaimVersionBindings,
  buildSupersededUnitExclusions,
  buildSupersessionRows,
  computeNextClaims,
  sourceKeyForIngestSource,
  SUPERSEDED_NOTE_PREFIX,
} from "./incremental-reingest";
import type { EvidenceRow } from "./evidence-persist";

const SOURCE = "Bentham founded utilitarianism. Mill ranked pleasures.";

function row(unitId: string, text: string, quote: string | null): EvidenceRow {
  return {
    unitId,
    text,
    quote,
    binding: bindEvidenceSpan({ quote: quote ?? "", sourceText: SOURCE, sourceHash: "h1" }),
  };
}

function prior(
  over: Partial<PriorClaimVersion> & Pick<PriorClaimVersion, "versionId" | "unitId">,
): PriorClaimVersion {
  return {
    claimKey: "k",
    versionNo: 1,
    text: "t",
    verificationState: "supported",
    judgedBy: "judge#1",
    judgedAt: "2026-06-01T00:00:00.000Z",
    validationStatus: "ok",
    validationNote: null,
    ...over,
  };
}

describe("sourceKeyForIngestSource", () => {
  it("prefers provenance canonical url over url over title", () => {
    expect(
      sourceKeyForIngestSource({
        url: "https://b.example/page",
        provenance: { canonical_url: "https://a.example/canonical" },
      }),
    ).toBe("url:https://a.example/canonical");
    expect(sourceKeyForIngestSource({ url: "https://b.example/page" })).toBe(
      "url:https://b.example/page",
    );
    expect(sourceKeyForIngestSource({ title: "My  Notes" })).toBe(
      sourceKeyForIngestSource({ title: "my notes" }),
    );
  });
});

describe("computeNextClaims", () => {
  it("derives one deterministic key per unit, quote-anchored when a quote exists", async () => {
    const rows = [
      row("u-1", "Bentham founded utilitarianism (claim).", "Bentham founded utilitarianism."),
      row("u-2", "A quote-less claim.", null),
    ];
    const a = await computeNextClaims({ sourceKey: "url:x", rows });
    const b = await computeNextClaims({
      sourceKey: "url:x",
      rows: [
        // Same quote, reworded claim text → same key (identity hangs off the evidence).
        row("u-9", "Utilitarianism was founded by Bentham.", "Bentham  founded utilitarianism."),
      ],
    });
    expect(a).toHaveLength(2);
    expect(a[0]!.claimKey).toBe(b[0]!.claimKey);
    expect(a[1]!.claimKey).not.toBe(a[0]!.claimKey);
  });
});

describe("buildClaimVersionBindings", () => {
  it("carries verification state + version chains for matched claims; new claims start at v1", async () => {
    const rows = [
      row("new-a", "Same claim.", "Bentham founded utilitarianism."),
      row("new-b", "Changed claim wording.", "Mill ranked pleasures."),
      row("new-c", "Brand new claim.", null),
    ];
    const next = await computeNextClaims({ sourceKey: "url:x", rows });
    const plan: ReingestPlan = {
      carried: [
        {
          next: next[0]!,
          prior: prior({ versionId: "10", unitId: "old-a", versionNo: 3 }),
        },
      ],
      changed: [
        {
          next: next[1]!,
          prior: prior({ versionId: "11", unitId: "old-b", versionNo: 1 }),
        },
      ],
      added: [next[2]!],
      removed: [],
    };
    const bindings = buildClaimVersionBindings({ rows, next, plan });
    expect(bindings).toHaveLength(3);
    const [a, b, c] = bindings;
    expect(a!.versionNo).toBe(4);
    expect(a!.carried).toEqual({
      verificationState: "supported",
      judgedBy: "judge#1",
      judgedAt: "2026-06-01T00:00:00.000Z",
    });
    // Changed claims version forward but are NOT carried — they get re-judged.
    expect(b!.versionNo).toBe(2);
    expect(b!.carried).toBeNull();
    expect(c!.versionNo).toBe(1);
    expect(c!.carried).toBeNull();
    expect(bindings.every((x) => x.claimKey)).toBe(true);
  });
});

describe("buildSupersessionRows", () => {
  it("chains replaced versions to their successor and closes removed versions with none", () => {
    const plan: ReingestPlan = {
      carried: [
        {
          next: { unitId: "new-a", text: "t", claimKey: "k1" },
          prior: prior({ versionId: "10", unitId: "old-a", claimKey: "k1" }),
        },
      ],
      changed: [
        {
          next: { unitId: "new-b", text: "t2", claimKey: "k2" },
          prior: prior({ versionId: "11", unitId: "old-b", claimKey: "k2" }),
        },
      ],
      added: [],
      removed: [prior({ versionId: "12", unitId: "old-c", claimKey: "k3" })],
    };
    const rows = buildSupersessionRows({
      plan,
      versionIdByUnitId: new Map([
        ["new-a", "20"],
        ["new-b", "21"],
      ]),
    });
    expect(rows).toEqual([
      { versionId: "10", supersededBy: "20" },
      { versionId: "11", supersededBy: "21" },
      { versionId: "12", supersededBy: null },
    ]);
  });
});

describe("buildSupersededUnitExclusions / buildCarriedValidationRows", () => {
  const plan: ReingestPlan = {
    carried: [
      {
        next: { unitId: "new-a", text: "t", claimKey: "k1" },
        prior: prior({ versionId: "10", unitId: "old-a", validationStatus: "ok" }),
      },
    ],
    changed: [
      {
        next: { unitId: "new-b", text: "t2", claimKey: "k2" },
        prior: prior({ versionId: "11", unitId: "old-b" }),
      },
    ],
    added: [],
    removed: [prior({ versionId: "12", unitId: "old-c" })],
  };

  it("soft-excludes every replaced/removed prior unit with a greppable note", () => {
    const exclusions = buildSupersededUnitExclusions(plan);
    expect(exclusions.map((e) => e.unitId)).toEqual(["old-a", "old-b", "old-c"]);
    expect(exclusions.every((e) => e.note.startsWith(SUPERSEDED_NOTE_PREFIX))).toBe(true);
  });

  it("copies the unit-level validation verdict only for carried claims", () => {
    const validations = buildCarriedValidationRows(plan);
    expect(validations).toEqual([{ unitId: "new-a", status: "ok", note: null }]);
  });
});
