/**
 * Phase 3 Stage 1 — Postgres-spine retrieval: lexical seeding, 1-hop traversal,
 * evidence-bound verdict mapping, policy filtering, and the designed abstention
 * state. The spine readers are injected, so this is a hermetic unit test.
 */
import { describe, it, expect, vi } from "vitest";

// The retrieval module's DEFAULT readers import the (heavy) neon module graph;
// our tests inject readers, so we stub neon to keep this hermetic + fast.
vi.mock("$lib/server/neon", () => ({
  lexicalSeedGraphSpineUnits: vi.fn(),
  readGraphSpineUnitsByIds: vi.fn(),
  readGraphSpineRelationsForUnits: vi.fn(),
}));

import {
  retrieveFromPostgresSpine,
  tokeniseQuery,
  deriveVerification,
  type GraphSpineReaders,
} from "./postgres-graph-retrieve";

// Local mirror of the spine row types (type-only; avoids importing the neon module).
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
type GraphSpineRelationRow = {
  fromUnitId: string;
  toUnitId: string;
  relationType: string;
};

function unit(over: Partial<GraphSpineUnitRow> & { id: string; text: string }): GraphSpineUnitRow {
  return {
    unitType: "claim",
    domain: "philosophy",
    validationStatus: null,
    validationNote: null,
    sourceId: "src-1",
    sourceTitle: "Starter: The trolley problem",
    sourceUrl: null,
    sourceKind: "demo",
    position: 0,
    ...over,
  };
}

/** Build readers backed by an in-memory unit/relation set with real lexical scoring. */
function makeReaders(
  units: GraphSpineUnitRow[],
  relations: GraphSpineRelationRow[] = [],
): GraphSpineReaders {
  const byId = new Map<string, GraphSpineUnitRow>(units.map((u) => [u.id, u]));
  return {
    lexicalSeed: vi.fn(async ({ terms, limit }: { terms: string[]; limit: number }) => {
      const scored = units
        .map((u) => {
          const text = u.text.toLowerCase();
          const score = terms.filter((t: string) => text.includes(t)).length;
          return { ...u, lexicalScore: score };
        })
        .filter((u) => u.lexicalScore > 0)
        .sort((a, b) => b.lexicalScore - a.lexicalScore)
        .slice(0, limit);
      return scored;
    }),
    readByIds: vi.fn(async ({ unitIds }: { unitIds: string[] }) =>
      unitIds.map((id: string) => byId.get(id)).filter((u): u is GraphSpineUnitRow => Boolean(u)),
    ),
    readRelations: vi.fn(async ({ unitIds }: { unitIds: string[] }) => {
      const set = new Set(unitIds);
      return relations.filter((r) => set.has(r.fromUnitId) || set.has(r.toUnitId));
    }),
  } as unknown as GraphSpineReaders;
}

describe("tokeniseQuery", () => {
  it("drops stopwords and short tokens, dedupes, lowercases", () => {
    const terms = tokeniseQuery("Why is the LEVER different from the lever?");
    expect(terms).toContain("lever");
    expect(terms).not.toContain("the");
    expect(terms).not.toContain("is");
    // 'lever' deduped despite appearing twice.
    expect(terms.filter((t) => t === "lever")).toHaveLength(1);
  });
});

describe("deriveVerification", () => {
  it("maps validation status to the trust vocabulary", () => {
    expect(deriveVerification(unit({ id: "a", text: "x", validationStatus: "ok" }))).toMatchObject({
      verification_category: "supported",
      trust_score: 90,
    });
    expect(deriveVerification(unit({ id: "b", text: "x", validationStatus: "weak" }))).toMatchObject(
      { verification_category: "weak" },
    );
    expect(
      deriveVerification(unit({ id: "c", text: "x", validationStatus: "unsupported" })),
    ).toMatchObject({ verification_category: "unsupported" });
  });

  it("treats curated/unvalidated demo units as supported but withholds a trust number", () => {
    const v = deriveVerification(unit({ id: "d", text: "x", validationStatus: null }));
    expect(v.verification_category).toBe("supported");
    expect(v.trust_score).toBeNull();
  });
});

describe("retrieveFromPostgresSpine", () => {
  const lever = unit({
    id: "trolley-1",
    text: "Diverting the trolley by pulling the lever to kill one instead of five is permissible.",
  });
  const bridge = unit({
    id: "trolley-2",
    text: "Pushing one large person off the footbridge to stop the trolley is judged differently.",
  });
  const distinction = unit({
    id: "trolley-3",
    text: "The difference turns on intending harm as a means versus a foreseen side effect.",
  });

  it("answers a lexically-matching question with cited claims + evidence passages", async () => {
    const readers = makeReaders(
      [lever, bridge, distinction],
      [{ fromUnitId: "trolley-3", toUnitId: "trolley-1", relationType: "explains" }],
    );
    const out = await retrieveFromPostgresSpine(
      { workspaceId: "ws-1", query: "Why is pulling the lever permissible?" },
      readers,
    );

    expect(out.degraded).toBe(false);
    expect(out.result.claims.length).toBeGreaterThan(0);
    // The lever claim is retrieved and carries its source title (citation).
    const leverClaim = out.result.claims.find((c) => c.id === "trolley-1");
    expect(leverClaim).toBeTruthy();
    expect(leverClaim?.source_title).toMatch(/trolley/i);
    // Every claim has an evidence passage = its exact quoted span.
    expect(out.result.evidence_passages?.length).toBe(out.result.claims.length);
    expect(out.result.evidence_passages?.[0]?.excerpt).toBeTruthy();
    // The context block is non-empty and quotes a claim.
    expect(out.contextBlock).toContain("lever");
  });

  it("traverses one hop to pull in connected claims", async () => {
    const readers = makeReaders(
      [lever, bridge, distinction],
      [{ fromUnitId: "trolley-3", toUnitId: "trolley-1", relationType: "explains" }],
    );
    const out = await retrieveFromPostgresSpine(
      { workspaceId: "ws-1", query: "lever permissible" },
      readers,
    );
    const ids = out.result.claims.map((c) => c.id);
    // The seed (trolley-1) plus its relation neighbour (trolley-3) are both present.
    expect(ids).toContain("trolley-1");
    expect(ids).toContain("trolley-3");
    expect(out.result.relations.length).toBeGreaterThan(0);
    // Relations reference claims by index, and indices are valid.
    for (const r of out.result.relations) {
      expect(out.result.claims[r.from_index]).toBeTruthy();
      expect(out.result.claims[r.to_index]).toBeTruthy();
    }
  });

  it("abstains (degraded, zero claims) when nothing matches — a designed state", async () => {
    const readers = makeReaders([lever, bridge, distinction]);
    const out = await retrieveFromPostgresSpine(
      { workspaceId: "ws-1", query: "What did Kant say about quantum mechanics?" },
      readers,
    );
    expect(out.degraded).toBe(true);
    expect(out.result.claims).toHaveLength(0);
    expect(out.degradedReason).toBeTruthy();
    expect(out.contextBlock).toBe("");
  });

  it("honours forced seed claim ids (deep-link / suggested question)", async () => {
    const readers = makeReaders([lever, bridge, distinction]);
    const out = await retrieveFromPostgresSpine(
      { workspaceId: "ws-1", query: "anything", seedClaimIds: ["trolley-2"] },
      readers,
    );
    expect(out.result.claims.some((c) => c.id === "trolley-2")).toBe(true);
    // Forced seeds skip lexical search entirely.
    expect(readers.lexicalSeed).not.toHaveBeenCalled();
  });

  it("excludes flagged (unsupported) claims under the default policy", async () => {
    const flagged = unit({
      id: "flagged-1",
      text: "lever claim that the validation stage flagged as unsupported",
      validationStatus: "unsupported",
    });
    const readers = makeReaders([flagged]);
    const out = await retrieveFromPostgresSpine(
      { workspaceId: "ws-1", query: "lever claim" },
      readers,
    );
    // The only matching unit is flagged → policy drops it → honest abstention.
    expect(out.degraded).toBe(true);
    expect(out.result.claims).toHaveLength(0);
  });

  it("includes weak claims when policy opts them in", async () => {
    const weak = unit({
      id: "weak-1",
      text: "a weak lever claim awaiting stronger evidence",
      validationStatus: "weak",
    });
    const readers = makeReaders([weak]);
    const out = await retrieveFromPostgresSpine(
      {
        workspaceId: "ws-1",
        query: "lever claim",
        verificationPolicy: { include: ["supported", "weak"], excludeFlagged: true },
      },
      readers,
    );
    expect(out.result.claims.some((c) => c.id === "weak-1")).toBe(true);
    expect(out.result.claims[0]?.verification_category).toBe("weak");
  });

  it("abstains gracefully when the store read throws", async () => {
    const readers = makeReaders([lever]);
    (readers.lexicalSeed as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("db down"));
    const out = await retrieveFromPostgresSpine(
      { workspaceId: "ws-1", query: "lever permissible" },
      readers,
    );
    expect(out.degraded).toBe(true);
    expect(out.result.claims).toHaveLength(0);
  });
});
