import { describe, expect, it, vi } from "vitest";

// buildSuggestions is pure, but the module imports the server-only retrieval path.
vi.mock("./retrieve-structured", () => ({ retrieveStructured: vi.fn() }));

import { buildSuggestions } from "./suggestQuestions";
import type { RetrievalResult } from "@restormel/graphrag-core";

function claim(
  id: string,
  text: string,
  source_title: string,
  extra: Partial<RetrievalResult["claims"][number]> = {},
): RetrievalResult["claims"][number] {
  return {
    id,
    text,
    claim_type: "thesis",
    domain: "philosophy",
    source_title,
    source_author: [],
    confidence: 0.8,
    position_in_source: 0,
    verification_category: "supported",
    ...extra,
  };
}

function rel(
  from_index: number,
  to_index: number,
  relation_type: string,
): RetrievalResult["relations"][number] {
  return { from_index, to_index, relation_type };
}

function result(
  claims: RetrievalResult["claims"],
  relations: RetrievalResult["relations"],
): RetrievalResult {
  return { claims, relations, arguments: [], seed_claim_ids: [], degraded: false };
}

describe("buildSuggestions", () => {
  it("emits one question per detected type (A–E) and caps at 5", () => {
    const claims = [
      claim("c0", "Free will is an illusion produced by prior causes", "Doc A"),
      claim("c1", "Determinism governs every physical event without exception", "Doc B"),
      claim("c2", "Moral responsibility still requires a real choice", "Doc A", {
        verification_category: "weak",
      }),
      claim("c3", "Agents can be held accountable for their actions", "Doc C"),
      claim("c4", "Consciousness is a fundamental feature of reality", "Doc B"),
    ];
    const relations = [
      rel(0, 1, "contradicts"), // TYPE B + TYPE A (Doc A vs Doc B)
      rel(2, 3, "supports"),
      rel(4, 3, "supports"),
      rel(0, 3, "supports"), // index 3 gets 3 incoming supports => TYPE C
      rel(1, 2, "supports"), // weak c2 gains degree => TYPE D
    ];

    const out = buildSuggestions(result(claims, relations));
    const types = out.map((q) => q.type);

    expect(out.length).toBe(5);
    expect(types).toEqual(expect.arrayContaining(["A", "B", "C", "D", "E"]));
    // Typed questions carry seed node ids.
    for (const q of out) {
      if (q.type !== "generic") expect(q.seedNodeIds.length).toBeGreaterThan(0);
    }
  });

  it("never produces self-referential 'my documents' questions (fair comparison)", () => {
    const claims = [
      claim("c0", "Free will is an illusion produced by prior causes", "Doc A"),
      claim("c1", "Determinism governs every physical event", "Doc B"),
      claim("c2", "Moral responsibility requires a real choice", "Doc A", {
        verification_category: "weak",
      }),
    ];
    const relations = [rel(0, 1, "contradicts"), rel(1, 2, "supports")];
    const out = buildSuggestions(result(claims, relations));

    expect(out.length).toBeGreaterThan(0);
    for (const q of out) {
      expect(q.question.toLowerCase()).not.toMatch(
        /my (ingested |)documents|my sources|my knowledge base|my graph/,
      );
      // Source document titles must not leak into the question text.
      expect(q.question).not.toContain("Doc A");
      expect(q.question).not.toContain("Doc B");
    }
  });

  it("truncates long claim text to 60 chars with an ellipsis", () => {
    const long = "x".repeat(120);
    const out = buildSuggestions(
      result([claim("c0", long, "Doc A")], [rel(0, 0, "supports")]),
    );
    const central = out.find((q) => q.type === "E");
    expect(central).toBeTruthy();
    expect(central!.question).toContain("…");
    expect(central!.question).not.toContain("x".repeat(61));
  });

  it("returns no suggestions when the graph has no claims (rather than faking them)", () => {
    expect(buildSuggestions(result([], []))).toEqual([]);
  });

  it("fills remaining slots from claim content, not self-referential boilerplate", () => {
    const claims = Array.from({ length: 6 }, (_, i) =>
      claim(`c${i}`, `Distinct substantive claim number ${i} about the subject`, "Doc A"),
    );
    // No typed relations, so slots fill from claim-derived 'is it true that…' questions.
    const out = buildSuggestions(result(claims, []));
    expect(out.length).toBe(5);
    expect(out.some((q) => q.question.startsWith("Is it true that"))).toBe(true);
  });
});
