import { describe, expect, it } from "vitest";
import {
  retrieveContext,
  buildContextBlock,
  philosophyRetrievalConfig,
  type GraphRagDeps,
  type GraphStore,
  type RetrievalConfig,
} from "../index.js";

/**
 * Proves the engine is genuinely domain-agnostic: driven by a synthetic *legal* config
 * (holding/dicta claim types, cites/overrules relations) with no philosophy assumptions.
 */

const legalConfig: RetrievalConfig = {
  ...philosophyRetrievalConfig,
  claimTaxonomy: {
    thesisTypes: ["holding"],
    objectionTypes: ["dissent"],
    replyTypes: ["concurrence"],
    thesisFallbackTypes: ["dicta"],
  },
  relations: {
    traversalEdges: [
      { table: "cites", edgePrior: 1.1 },
      { table: "overrules", edgePrior: 1.25 },
    ],
    fetchEdges: [
      { table: "cites", relationType: "cites" },
      { table: "overrules", relationType: "overrules" },
    ],
    contradictionEdge: "overrules",
    replyEdge: "distinguishes",
    strengthWeights: { strong: 1.08, weak: 0.86, default: 1 },
  },
  arguments: {
    membershipEdge: "comprises",
    conclusionRole: "holding",
    keyPremiseRole: "rationale",
    supportingPremiseRole: "factor",
    membershipRoleRank: { holding: 0, rationale: 1, factor: 2 },
  },
  domain: { enabled: false, fallbackDomain: "general", fallbackClaimType: "dicta" },
  entityEnrichment: undefined,
  presentation: {
    header: "=== LEGAL AUTHORITIES ===",
    intro: "The following are cited authorities from the case-law graph.",
    footer: "Verify each authority against the official reporter.",
    annotateVerification: true,
  },
};

const SEED_ROW = (over: Record<string, unknown>) => ({
  text: "",
  claim_type: "holding",
  domain: "general",
  confidence: 0.9,
  embedding: [1, 0, 0],
  position_in_source: 0,
  review_state: undefined,
  verification_state: "validated",
  trust_score: 90,
  section_context: null,
  source_id: "source:1",
  source_url: null,
  source_source_type: null,
  source_title: "Reporter v. State",
  source_author: ["Hand, J."],
  ...over,
});

const GRAPH_CLAIM = (over: Record<string, unknown>) => ({
  text: "",
  claim_type: "holding",
  domain: "general",
  confidence: 0.9,
  position_in_source: 0,
  review_state: undefined,
  verification_state: "validated",
  trust_score: 88,
  source: { id: "source:2", title: "Appeals Reporter", author: ["Cardozo, J."] },
  ...over,
});

/** In-memory graph store that answers the engine's SQL by shape (no SurrealDB). */
function makeLegalStore(): GraphStore {
  return {
    async query<T>(sql: string): Promise<T> {
      const out = (rows: unknown[]): T => rows as unknown as T;

      if (sql.includes("count() AS count")) return out([{ count: 0 }]); // untrusted graph → permissive filters
      if (sql.includes("FROM passage WHERE source")) return out([{ id: "passage:1" }]); // source has coverage

      // Dense candidate generation (vector KNN).
      if (sql.includes("WHERE embedding <")) {
        return out([
          SEED_ROW({ id: "claim:h1", text: "The statute bars the claim.", claim_type: "holding" }),
          SEED_ROW({
            id: "claim:d1",
            text: "In dicta, the court mused on policy.",
            claim_type: "dicta",
            embedding: [0.9, 0.1, 0],
            source_id: "source:3",
            source_title: "Treatise",
          }),
        ]);
      }

      // Beam traversal / closure neighbour lookups (project in_claim/out_claim).
      if (sql.includes("AS in_claim")) {
        if (sql.includes("FROM cites")) {
          return out([
            {
              in: "claim:h1",
              out: "claim:h2",
              in_claim: GRAPH_CLAIM({ id: "claim:h1", text: "The statute bars the claim." }),
              out_claim: GRAPH_CLAIM({
                id: "claim:h2",
                text: "Precedent establishing the bar.",
                source: { id: "source:2", title: "Appeals Reporter", author: ["Cardozo, J."] },
              }),
            },
          ]);
        }
        return out([]); // overrules / distinguishes: no neighbours
      }

      // Inter-claim relation resolution.
      if (sql.includes("AS relation_type")) {
        if (sql.includes("FROM cites")) {
          return out([{ in: "claim:h1", out: "claim:h2" }]);
        }
        return out([]);
      }

      // Argument membership lookups — none in this fixture.
      if (sql.includes("AS arg_id")) return out([]);
      return out([]);
    },
    isDatabaseUnavailable() {
      return false;
    },
  };
}

const deps = (): GraphRagDeps => ({
  store: makeLegalStore(),
  embedder: { embedQuery: async () => [1, 0, 0] },
  resolveOriginBucket: () => "other",
});

describe("domain-agnostic engine (legal config)", () => {
  it("retrieves with no philosophy assumptions and reports the legal traversal mode", async () => {
    const result = await retrieveContext("does the statute bar the claim?", deps(), {
      topK: 4,
      config: legalConfig,
    });

    expect(result.degraded).toBe(false);
    expect(result.seed_claim_ids.length).toBeGreaterThan(0);

    // Seed claims came back, including a domain-specific 'holding' claim type.
    const claimTypes = new Set(result.claims.map((c) => c.claim_type));
    expect(claimTypes.has("holding")).toBe(true);
    expect(result.claims.some((c) => c.id === "claim:h1")).toBe(true);

    // Traversal followed the legal 'cites' edge and resolved it as a relation.
    expect(result.claims.some((c) => c.id === "claim:h2")).toBe(true);
    expect(result.relations.some((r) => r.relation_type === "cites")).toBe(true);

    // Trace is preserved and reflects the legal config.
    expect(result.trace?.traversal_mode).toBe(legalConfig.traversal.mode);
    expect(result.trace?.traversal_domain_aware).toBe(false); // domain disabled for legal
    expect(result.trace?.traversal_edge_priors).toMatchObject({ cites: 1.1, overrules: 1.25 });
  });

  it("renders the legal presentation strings, not philosophy prose", async () => {
    const result = await retrieveContext("statute bar", deps(), { topK: 4, config: legalConfig });
    const block = buildContextBlock(result, legalConfig);
    expect(block).toContain("=== LEGAL AUTHORITIES ===");
    expect(block).toContain("official reporter");
    expect(block).not.toContain("PHILOSOPHICAL");
  });
});
