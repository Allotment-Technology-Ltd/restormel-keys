import { describe, expect, it } from "vitest";
import {
  packContext,
  summariseSubgraph,
  defaultTokenizer,
  estimateClaimTokens,
  type RetrievedClaim,
  type RetrievedRelation,
} from "../index.js";

const longText = (label: string) => `${label} ` + "lorem ipsum dolor sit amet ".repeat(8);

const claim = (id: string, text: string, over: Partial<RetrievedClaim> = {}): RetrievedClaim => ({
  id,
  text,
  claim_type: "premise",
  domain: "ethics",
  source_title: `Source ${id}`,
  source_author: [],
  confidence: 0.7,
  position_in_source: 0,
  verification_state: "validated",
  trust_score: 80,
  verification_category: "supported",
  ...over,
});

describe("packContext", () => {
  const claims: RetrievedClaim[] = [
    claim("seed", longText("seed claim")),
    claim("n1", longText("neighbour one")),
    claim("n2", longText("neighbour two")),
    claim("n3", longText("neighbour three")),
    claim("n4", longText("neighbour four")),
  ];
  const relations: RetrievedRelation[] = [
    { from_index: 1, to_index: 0, relation_type: "supports" },
  ];

  it("never exceeds maxTokens for non-seeds and never drops a seed", () => {
    const seedCost = estimateClaimTokens(claims[0], defaultTokenizer);
    const budget = seedCost * 2 + 5; // room for the seed + ~1 neighbour
    const result = packContext({
      claims,
      relations,
      seedClaimIds: ["seed"],
      maxTokens: budget,
    });

    expect(result.claims.some((c) => c.id === "seed")).toBe(true);
    expect(result.tokensUsed).toBeLessThanOrEqual(budget);
    expect(result.nodesDropped).toBeGreaterThan(0);
    expect(result.claims.length).toBe(claims.length - result.nodesDropped);
  });

  it("keeps the seed even when a single seed exceeds the budget", () => {
    const result = packContext({
      claims,
      relations,
      seedClaimIds: ["seed"],
      maxTokens: 1,
    });
    expect(result.claims.map((c) => c.id)).toEqual(["seed"]);
    expect(result.nodesDropped).toBe(4);
  });

  it("re-indexes surviving relations to the kept claims", () => {
    const result = packContext({
      claims,
      relations,
      seedClaimIds: ["seed"],
      maxTokens: 100_000, // keep everything
    });
    // 'supports' relation n1 -> seed survives and points at valid indices
    const rel = result.relations[0];
    expect(rel.relation_type).toBe("supports");
    expect(result.claims[rel.to_index].id).toBe("seed");
    expect(result.claims[rel.from_index].id).toBe("n1");
  });
});

describe("summariseSubgraph", () => {
  it("dedups + prunes to reduce tokens while preserving the seed (no llm)", async () => {
    const nodes: RetrievedClaim[] = [
      claim("seed", longText("the central thesis")),
      claim("dup1", "Animals deserve moral consideration because they feel pain."),
      claim("dup2", "Animals deserve moral consideration because they feel pain too."),
      claim("other", longText("an unrelated tangent about epistemology")),
    ];
    const before = nodes.reduce((s, n) => s + estimateClaimTokens(n, defaultTokenizer), 0);

    const result = await summariseSubgraph({
      nodes,
      edges: [],
      seedClaimIds: ["seed"],
      maxTokens: before, // generous; dedup alone should shrink it
    });

    expect(result.nodes.some((n) => n.id === "seed")).toBe(true);
    expect(result.tokensUsed).toBeLessThan(before); // near-identical dup removed
    // exactly one of dup1/dup2 survives
    const dups = result.nodes.filter((n) => n.id === "dup1" || n.id === "dup2");
    expect(dups.length).toBe(1);
  });

  it("collapses a dense cluster into a synthesised node with provenance (llm)", async () => {
    const nodes: RetrievedClaim[] = [
      claim("seed", longText("seed")),
      claim("a", "Free will is compatible with determinism under the right analysis."),
      claim("b", "Free will is compatible with determinism if we redefine freedom."),
      claim("c", "Free will is compatible with determinism on a compatibilist reading."),
    ];

    const result = await summariseSubgraph({
      nodes,
      edges: [],
      seedClaimIds: ["seed"],
      maxTokens: 100_000,
      clusterThreshold: 0.4,
      llmCallback: async (cluster) => `Synthesis of ${cluster.length} compatibilist claims.`,
    });

    expect(result.synthesizedCount).toBe(1);
    const synth = result.nodes.find((n) => n.synthesized);
    expect(synth?.provenance?.sort()).toEqual(["a", "b", "c"]);
    expect(result.nodes.some((n) => n.id === "seed")).toBe(true);
    // original cluster members replaced by the synthesised node
    expect(result.nodes.some((n) => n.id === "a")).toBe(false);
  });
});
