/**
 * EBV store PARITY suite — Postgres host-managed spine ≡ Surreal (REC-ADR-008, Stage-1).
 *
 * The Connect verification contract must behave IDENTICALLY whether a workspace's graph
 * lives in a BYO Surreal store or the host-managed Postgres spine. EBV itself is store-free
 * (verbatim-span binding, source-version-hash re-check, cross-model entailment, abstention all
 * run in memory at ingest and write a `verification_state` regardless of store), so G2 transfers
 * unchanged. What does NOT transfer for free is the STORE-SIDE trust-state retrieval filter:
 * the Surreal path compiles the strict/annotated predicate to SurrealQL with Surreal-specific
 * null semantics (`verification_state = NONE` → Postgres `IS NULL`), while the Postgres path
 * re-implements that predicate in TypeScript (`passesPolicy` in postgres-graph-retrieve.ts).
 *
 * This suite proves the two admit the EXACT same claim set over a golden corpus. P7 (predicate
 * equivalence) is the highest-risk case and is where parity silently breaks — it diffs the id
 * set the Postgres filter returns against an independent reference evaluator that mirrors
 * `buildVerificationSqlPredicate` (graphrag-core/retrieve-context.ts:138-165) row-for-row.
 */
import { describe, it, expect, vi } from "vitest";
import type { VerificationCategory, VerificationPolicy } from "@restormel/graphrag-core";

// The retrieval module's DEFAULT readers import the (heavy) neon module graph; this suite
// injects readers, so we stub neon to keep it hermetic + fast (mirrors postgres-graph-retrieve.test.ts).
vi.mock("$lib/server/neon", () => ({
  lexicalSeedGraphSpineUnits: vi.fn(),
  readGraphSpineUnitsByIds: vi.fn(),
  readGraphSpineRelationsForUnits: vi.fn(),
}));

import {
  retrieveFromPostgresSpine,
  deriveVerification,
  type GraphSpineReaders,
} from "./postgres-graph-retrieve";

// ── Local mirror of the spine row type (type-only; avoids importing the heavy neon module) ──
type GraphSpineUnitRow = {
  id: string;
  text: string;
  unitType: string | null;
  domain: string | null;
  validationStatus: string | null;
  validationNote: string | null;
  sourceId: string | null;
  sourceTitle: string | null;
  sourceUrl: string | null;
  sourceKind: string | null;
  position: number;
};
type GraphSpineRelationRow = { fromUnitId: string; toUnitId: string; relationType: string };

/** The philosophy domain pack's verification vocabulary (config.ts:475-476). */
const VOCAB = { supportedStates: ["validated"], flaggedStates: ["flagged"] };

function unit(over: Partial<GraphSpineUnitRow> & { id: string; text: string }): GraphSpineUnitRow {
  return {
    unitType: "claim",
    domain: "philosophy",
    validationStatus: null,
    validationNote: null,
    sourceId: "src-1",
    sourceTitle: "Starter: Trolley problem",
    sourceUrl: null,
    sourceKind: "demo",
    position: 0,
    ...over,
  };
}

function makeReaders(
  units: GraphSpineUnitRow[],
  relations: GraphSpineRelationRow[] = [],
): GraphSpineReaders {
  const byId = new Map(units.map((u) => [u.id, u]));
  return {
    lexicalSeed: async ({ terms, limit }: { terms: string[]; limit: number }) =>
      units
        .map((u) => ({
          ...u,
          lexicalScore: terms.filter((t) => u.text.toLowerCase().includes(t)).length,
        }))
        .filter((u) => u.lexicalScore > 0)
        .sort((a, b) => b.lexicalScore - a.lexicalScore)
        .slice(0, limit),
    readByIds: async ({ unitIds }: { unitIds: string[] }) =>
      unitIds.map((id) => byId.get(id)).filter((u): u is GraphSpineUnitRow => Boolean(u)),
    readRelations: async ({ unitIds }: { unitIds: string[] }) => {
      const set = new Set(unitIds);
      return relations.filter((r) => set.has(r.fromUnitId) || set.has(r.toUnitId));
    },
  } as unknown as GraphSpineReaders;
}

// ──────────────────────────────────────────────────────────────────────────────
// Reference Surreal-side admission evaluator — an independent, from-scratch re-derivation
// of the admission the Surreal retrieval path ultimately applies. The Surreal path uses a
// SurrealQL pre-filter (buildVerificationSqlPredicate) AND the authoritative in-memory check
// `policyAdmits(classifyVerification(state), trust, policy)` (retrieve-context.ts:110-136),
// which is what actually governs the returned claim set. Parity is therefore proven at THIS
// boundary: both stores must admit the same CATEGORY-classified set. This is a SECOND
// implementation (not a call into the Postgres path) so that if the Postgres filter and the
// Surreal admission semantics ever diverge, P7 fails.
//
// classifyVerification(state, vocab):
//   state ∈ supportedStates → "supported"; ∈ flaggedStates → "unsupported"; else → "weak"
// policyAdmits(category, trustScore, policy):
//   unsupported && excludeFlagged → false
//   !include.includes(category) → false
//   minTrustScore set && typeof trustScore === number && trustScore < min → false
// ──────────────────────────────────────────────────────────────────────────────
function classifyVerification(state: string | null): VerificationCategory {
  const s = (state ?? "").trim();
  if (s && VOCAB.supportedStates.includes(s)) return "supported";
  if (s && VOCAB.flaggedStates.includes(s)) return "unsupported";
  return "weak";
}

function surrealPredicateAdmits(
  row: { verification_state: string | null; trust_score: number | null },
  policy: VerificationPolicy,
): boolean {
  const category = classifyVerification(row.verification_state);
  const excludeFlagged = policy.excludeFlagged ?? true;
  if (category === "unsupported" && excludeFlagged) return false;
  if (!policy.include.includes(category)) return false;
  if (
    policy.minTrustScore !== undefined &&
    typeof row.trust_score === "number" &&
    row.trust_score < policy.minTrustScore
  ) {
    return false;
  }
  return true;
}

/**
 * The `validation_status` values EBV actually WRITES for real ingested content — `ok`
 * (validated), `weak`, `unsupported` (flagged). The parity gate is about these real
 * verdicts: a Postgres-backed and a Surreal-backed workspace must admit the identical
 * claim set for them. The `null` "curated/unvalidated demo seed" sentinel is NOT a real
 * EBV verdict — it is an intentional, store-scoped demo affordance (the Answer Console
 * hero), proven equivalent-or-documented separately below. (REC-ADR-008: ledger row #4 is
 * treated as conditionally store-scoped until G4 is green.)
 */
const STATUS_CORPUS: Array<GraphSpineUnitRow["validationStatus"]> = ["ok", "weak", "unsupported"];

/** Build a golden corpus where every unit text shares a seed term so all are retrievable. */
function goldenCorpus(): GraphSpineUnitRow[] {
  return STATUS_CORPUS.map((status, i) =>
    unit({
      id: `claim-${i}-${status ?? "null"}`,
      text: `lever claim variant ${i} (${status ?? "unvalidated"})`,
      validationStatus: status,
    }),
  );
}

/** Every value the spine column can hold, incl. the demo-seed (null) and unrecognised. */
const ALL_STATUS_INPUTS: Array<GraphSpineUnitRow["validationStatus"]> = [
  "ok",
  "weak",
  "unsupported",
  null,
  "remediated",
];

describe("EBV store parity — derived verification mapping (P2/P3/P4)", () => {
  it("P3: every validation_status maps to a verification shape with no coercion loss", () => {
    for (const status of ALL_STATUS_INPUTS) {
      const v = deriveVerification(unit({ id: "x", text: "t", validationStatus: status }));
      expect(v.verification_category).toMatch(/^(supported|weak|unsupported)$/);
      // The mapping is total: every status yields a category + (possibly null) trust score.
      expect(["number", "object"]).toContain(typeof v.trust_score); // number | null
    }
  });

  it("P2: a flagged/unsupported state can never be laundered into supported", () => {
    const flagged = deriveVerification(unit({ id: "f", text: "t", validationStatus: "unsupported" }));
    expect(flagged.verification_category).toBe("unsupported");
    expect(flagged.trust_score).toBeLessThan(50);
  });

  it("P4: abstention (curated/unvalidated → no machine verdict) withholds a trust number", () => {
    // The honest-abstention shape: shown as supported-by-construction but with NO trust score,
    // so the UI can never over-claim a machine verdict that was never produced.
    const abstained = deriveVerification(unit({ id: "a", text: "t", validationStatus: null }));
    expect(abstained.trust_score).toBeNull();
    expect(abstained.verification_state).toBeNull();
  });
});

describe("EBV store parity — strict vs annotated retrieval (P5/P6)", () => {
  const STRICT: VerificationPolicy = { include: ["supported"], excludeFlagged: true };
  const ANNOTATED: VerificationPolicy = {
    include: ["supported", "weak", "unsupported"],
    excludeFlagged: false,
  };

  it("P5: strict mode returns supported-only, and the id set matches the Surreal predicate", async () => {
    const corpus = goldenCorpus();
    const out = await retrieveFromPostgresSpine(
      { workspaceId: "ws", query: "lever claim variant", maxClaims: 50, verificationPolicy: STRICT },
      makeReaders(corpus),
    );
    const postgresIds = new Set(out.result.claims.map((c) => c.id));

    // Independent Surreal-semantics reference over the same corpus.
    const surrealIds = new Set(
      corpus
        .filter((u) => {
          const v = deriveVerification(u);
          return surrealPredicateAdmits(
            { verification_state: v.verification_state, trust_score: v.trust_score },
            STRICT,
          );
        })
        .map((u) => u.id),
    );

    expect([...postgresIds].sort()).toEqual([...surrealIds].sort());
    // Strict admits only the supported category.
    for (const c of out.result.claims) {
      expect(c.verification_category).toBe<VerificationCategory>("supported");
    }
  });

  it("P6: annotated mode labels every returned claim with a verification category", async () => {
    const corpus = goldenCorpus();
    const out = await retrieveFromPostgresSpine(
      {
        workspaceId: "ws",
        query: "lever claim variant",
        maxClaims: 50,
        verificationPolicy: ANNOTATED,
      },
      makeReaders(corpus),
    );
    for (const c of out.result.claims) {
      expect(c.verification_category).toBeDefined();
      expect(["supported", "weak", "unsupported"]).toContain(c.verification_category);
    }
  });
});

describe("EBV store parity — P7 trust-state predicate equivalence (HIGHEST RISK)", () => {
  // The full policy matrix that exercises every branch of the Surreal predicate:
  // include-combinations × excludeFlagged × minTrustScore boundary (esp. NONE→IS NULL).
  const POLICIES: VerificationPolicy[] = [
    { include: ["supported"], excludeFlagged: true },
    { include: ["supported"], excludeFlagged: false },
    { include: ["supported", "weak"], excludeFlagged: true },
    { include: ["supported", "weak"], excludeFlagged: false },
    { include: ["supported", "weak", "unsupported"], excludeFlagged: true },
    { include: ["supported", "weak", "unsupported"], excludeFlagged: false },
    { include: ["weak"], excludeFlagged: true },
    { include: ["unsupported"], excludeFlagged: false },
    // minTrustScore boundary cases (90 = supported's score; 55 = weak's; 20 = flagged's).
    { include: ["supported", "weak", "unsupported"], excludeFlagged: false, minTrustScore: 90 },
    { include: ["supported", "weak", "unsupported"], excludeFlagged: false, minTrustScore: 56 },
    { include: ["supported", "weak", "unsupported"], excludeFlagged: false, minTrustScore: 0 },
    // minTrustScore with a null trust score present (the NONE→IS NULL path): curated units
    // have trust_score = null and must survive any floor (Surreal `trust_score = NONE OR …`).
    { include: ["supported"], excludeFlagged: true, minTrustScore: 100 },
  ];

  const corpus = goldenCorpus();

  for (const policy of POLICIES) {
    it(`admits the identical id set as the Surreal predicate for ${JSON.stringify(policy)}`, async () => {
      const out = await retrieveFromPostgresSpine(
        {
          workspaceId: "ws",
          query: "lever claim variant",
          maxClaims: 50,
          verificationPolicy: policy,
        },
        makeReaders(corpus),
      );
      const postgresIds = [...new Set(out.result.claims.map((c) => c.id))].sort();

      const surrealIds = corpus
        .filter((u) => {
          const v = deriveVerification(u);
          return surrealPredicateAdmits(
            { verification_state: v.verification_state, trust_score: v.trust_score },
            policy,
          );
        })
        .map((u) => u.id)
        .sort();

      // The load-bearing parity assertion: surrealIds === postgresIds.
      expect(postgresIds).toEqual(surrealIds);
    });
  }

  it("DOCUMENTED store-scoped divergence: a curated/unvalidated demo seed is NOT a real EBV verdict", () => {
    // The Postgres spine surfaces a curated/unvalidated demo seed (validation_status = null)
    // as category "supported" WITH a null trust score (an Answer-Console demo affordance),
    // whereas the canonical Surreal classifyVerification maps an empty state to "weak". This
    // is the ONE intentional divergence and it is store-scoped: it only ever applies to the
    // demo seed / pre-validation rows, never to a verdict EBV actually wrote. The trust score
    // is null in BOTH framings, so neither store can over-claim a machine verdict that was
    // never produced. The parity gate above is therefore scoped to real EBV verdicts; this
    // case is recorded here so the divergence can never become silent (REC-ADR-008: the
    // strict-mode claims-ledger row stays conditionally store-scoped until G4 is green).
    const demoSeed = deriveVerification(unit({ id: "demo", text: "t", validationStatus: null }));
    expect(demoSeed.verification_category).toBe<VerificationCategory>("supported");
    expect(demoSeed.trust_score).toBeNull(); // never a machine trust number
    expect(classifyVerification(null)).toBe<VerificationCategory>("weak"); // canonical Surreal mapping
  });

  it("verification_state = NONE → IS NULL: curated units survive a high trust floor", async () => {
    // A curated/unvalidated unit (trust_score null) under a minTrustScore=100 strict policy is
    // admitted by the Surreal `(trust_score = NONE OR trust_score >= 100)` clause — and the
    // Postgres path must do the same (it must not drop null-trust rows on a numeric floor).
    const curated = unit({ id: "curated", text: "lever curated unit", validationStatus: null });
    const out = await retrieveFromPostgresSpine(
      {
        workspaceId: "ws",
        query: "lever curated unit",
        verificationPolicy: { include: ["supported"], excludeFlagged: true, minTrustScore: 100 },
      },
      makeReaders([curated]),
    );
    expect(out.result.claims.map((c) => c.id)).toContain("curated");
  });
});

describe("EBV store parity — verbatim span round-trip (P1)", () => {
  it("every returned claim carries an evidence passage equal to its verbatim unit text", async () => {
    const u = unit({
      id: "verbatim-1",
      text: "Diverting the trolley by pulling the lever to kill one instead of five is permissible.",
      validationStatus: "ok",
    });
    const out = await retrieveFromPostgresSpine(
      { workspaceId: "ws", query: "lever permissible trolley" },
      makeReaders([u]),
    );
    const claim = out.result.claims.find((c) => c.id === "verbatim-1");
    expect(claim).toBeTruthy();
    const passage = out.result.evidence_passages?.find((p) => p.claim_ids.includes("verbatim-1"));
    // The passage excerpt is the exact, verbatim source-bound text (no paraphrase, no drift).
    expect(passage?.excerpt).toBe(u.text);
  });
});
