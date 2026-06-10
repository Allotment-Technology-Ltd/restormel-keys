import { describe, it, expect } from "vitest";
import {
  ConnectDomainPackSchema,
  DEFAULT_GENERIC_DOMAIN_PACK,
  PHILOSOPHY_DOMAIN_PACK,
  type ConnectDomainPack,
  type ConnectDomainPackUpsert,
} from "@restormel/contracts/connect";
import { mapDomainPackToRetrievalConfig } from "./domain-pack-retrieval-config";

function asPack(upsert: ConnectDomainPackUpsert): ConnectDomainPack {
  return ConnectDomainPackSchema.parse({
    ...upsert,
    id: "22222222-2222-4222-8222-222222222222",
    workspace_id: "11111111-1111-4111-8111-111111111111",
    is_builtin: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

describe("mapDomainPackToRetrievalConfig", () => {
  it("maps the philosophy pack to its argumentative taxonomy + claim schema", () => {
    const cfg = mapDomainPackToRetrievalConfig(asPack(PHILOSOPHY_DOMAIN_PACK));

    // Schema: philosophy stores units in `claim`.
    expect(cfg.schema.unitTable).toBe("claim");
    expect(cfg.schema.groupTable).toBe("argument");

    // Relations from the pack's relation_edges, with known priors + reasoning classes.
    expect(cfg.relations.traversalEdges.map((e) => e.table)).toEqual(
      expect.arrayContaining(["supports", "contradicts", "depends_on", "responds_to"]),
    );
    expect(cfg.relations.traversalEdges.find((e) => e.table === "depends_on")?.reasoningClass).toBe("causal");
    expect(cfg.relations.traversalEdges.find((e) => e.table === "responds_to")?.reasoningClass).toBe("temporal");
    expect(cfg.relations.contradictionEdge).toBe("contradicts");
    expect(cfg.relations.replyEdge).toBe("responds_to");

    // Closure taxonomy derived from unit types + relationship patterns.
    expect(cfg.claimTaxonomy.thesisTypes).toEqual(expect.arrayContaining(["thesis", "conclusion"]));
    expect(cfg.claimTaxonomy.objectionTypes).toContain("objection");
    expect(cfg.claimTaxonomy.replyTypes).toContain("reply");
    expect(cfg.closure.enabled).toBe(true);

    // Argument roles + domain.
    expect(cfg.arguments.membershipEdge).toBe("part_of");
    expect(cfg.arguments.conclusionRole).toBe("conclusion");
    expect(cfg.domain.enabled).toBe(true);

    // Presentation reflects the pack title.
    expect(cfg.presentation.header).toContain("KNOWLEDGE GRAPH CONTEXT");
    expect(cfg.presentation.intro).toContain("claim");
  });

  it("maps the generic pack to a neutral schema with closure disabled", () => {
    const cfg = mapDomainPackToRetrievalConfig(asPack(DEFAULT_GENERIC_DOMAIN_PACK));

    // Generic stores units in `statement`, groups in `topic`.
    expect(cfg.schema.unitTable).toBe("statement");
    expect(cfg.schema.groupTable).toBe("topic");

    // No objection/reply unit types → closure off; no domains → domain filtering off.
    expect(cfg.closure.enabled).toBe(false);
    expect(cfg.domain.enabled).toBe(false);

    // Relations carry over (incl. relates_to), contradiction edge resolved by name.
    expect(cfg.relations.traversalEdges.map((e) => e.table)).toContain("relates_to");
    expect(cfg.relations.contradictionEdge).toBe("contradicts");

    // No marker lexicon → no known phrases.
    expect(cfg.lexical.knownPhrases).toEqual([]);
    // 'assertion' is the thesis-like unit type.
    expect(cfg.claimTaxonomy.thesisTypes).toContain("assertion");
  });

  it("classifies EBV verification states alongside the legacy vocabulary (Stage 1.1)", () => {
    const cfg = mapDomainPackToRetrievalConfig(asPack(DEFAULT_GENERIC_DOMAIN_PACK));

    // require_verified / strict policies must admit EBV `supported` claims…
    expect(cfg.verification.supportedStates).toEqual(
      expect.arrayContaining(["validated", "supported"]),
    );
    // …and must treat contradicted/excluded as flagged.
    expect(cfg.verification.flaggedStates).toEqual(
      expect.arrayContaining(["flagged", "contradicted", "excluded"]),
    );
    // inferred/unverified stay in the middle (weak) category — opt-in only, always labeled.
    expect(cfg.verification.supportedStates).not.toContain("inferred");
    expect(cfg.verification.supportedStates).not.toContain("unverified");
    expect(cfg.verification.flaggedStates).not.toContain("inferred");
    expect(cfg.verification.flaggedStates).not.toContain("unverified");
  });
});
