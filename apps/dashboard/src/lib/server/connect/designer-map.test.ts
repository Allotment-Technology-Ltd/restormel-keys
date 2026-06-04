import { describe, expect, it } from "vitest";
import { buildDomainPackDraft, slugify } from "./designer-map";

describe("buildDomainPackDraft", () => {
  it("maps a complete designer proposal into a valid pack draft", () => {
    const { draft, rationale } = buildDomainPackDraft({
      title: "Case Law",
      slug: "Case Law!",
      description: "Legal holdings and how cases relate",
      unit_noun: "holding",
      group_noun: "case",
      domains: ["contract", "tort"],
      unit_types: ["holding", "dictum"],
      relation_types: [
        { name: "affirms", description: "Later case affirms an earlier holding" },
        "distinguishes",
      ],
      group_roles: ["majority", "dissent"],
      relationship_patterns: [
        { from_unit_type: "holding", relation: "affirms", to_unit_type: "holding" },
        { from_unit_type: "x", relation: "" }, // dropped (incomplete)
      ],
      schema_mode: "strict",
      rationale: "Captures precedent relationships.",
    });
    expect(draft.slug).toBe("case-law");
    expect(draft.ontology.unit_noun).toBe("holding");
    expect(draft.ontology.relation_types.map((r) => r.name)).toContain("distinguishes");
    expect(draft.ontology.relationship_patterns).toHaveLength(1);
    expect(draft.ontology.schema_mode).toBe("strict");
    expect(draft.graph_schema.unit_table).toBe("holding");
    expect(draft.graph_schema.relation_edges).toContain("affirms");
    expect(rationale).toContain("precedent");
  });

  it("falls back to generic defaults for an empty/garbage proposal", () => {
    const { draft } = buildDomainPackDraft({}, { fallbackTitle: "My Domain" });
    expect(draft.title).toBe("My Domain");
    expect(draft.ontology.unit_noun).toBe("statement");
    expect(draft.ontology.relation_types.length).toBeGreaterThan(0);
    expect(draft.ontology.schema_mode).toBe("guided");
  });

  it("avoids reserved slugs", () => {
    expect(buildDomainPackDraft({ title: "generic" }).draft.slug).toBe("generic-custom");
    expect(buildDomainPackDraft({ slug: "philosophy", title: "x" }).draft.slug).toBe("philosophy-custom");
  });

  it("slugify produces kebab-case", () => {
    expect(slugify("Hello World!")).toBe("hello-world");
    expect(slugify("")).toBe("custom");
  });
});
