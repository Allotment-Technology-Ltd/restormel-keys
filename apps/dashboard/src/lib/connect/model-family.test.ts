import { describe, it, expect } from "vitest";
import {
  normaliseModelFamily,
  familyLabel,
  isKnownFamily,
  deriveCrossModel,
} from "./model-family";

describe("normaliseModelFamily", () => {
  it("maps known vendor aliases to a canonical family", () => {
    expect(normaliseModelFamily("anthropic")).toBe("anthropic");
    expect(normaliseModelFamily("claude")).toBe("anthropic");
    expect(normaliseModelFamily("OpenAI")).toBe("openai");
    expect(normaliseModelFamily("gpt")).toBe("openai");
    expect(normaliseModelFamily("gemini")).toBe("google");
    expect(normaliseModelFamily("kimi")).toBe("moonshot");
  });

  it("passes through an unknown token lower-cased (never invents a family)", () => {
    expect(normaliseModelFamily("acme-llm")).toBe("acme-llm");
  });

  it("returns null for empty / nullish tokens", () => {
    expect(normaliseModelFamily(null)).toBeNull();
    expect(normaliseModelFamily(undefined)).toBeNull();
    expect(normaliseModelFamily("   ")).toBeNull();
  });
});

describe("familyLabel", () => {
  it("title-cases known families", () => {
    expect(familyLabel("anthropic")).toBe("Anthropic");
    expect(familyLabel("openai")).toBe("OpenAI");
    expect(familyLabel("xai")).toBe("xAI");
  });
  it("upper-cases unknown families", () => {
    expect(familyLabel("acme")).toBe("ACME");
  });
});

describe("isKnownFamily", () => {
  it("is true only for tokens in the alias map", () => {
    expect(isKnownFamily("anthropic")).toBe(true);
    expect(isKnownFamily("claude")).toBe(true);
    expect(isKnownFamily("acme")).toBe(false);
    expect(isKnownFamily(null)).toBe(false);
  });
});

describe("deriveCrossModel — claims-integrity: cross-family ✓ is never unearned", () => {
  it("asserts cross_family ONLY when both sides are known and differ", () => {
    const d = deriveCrossModel("anthropic", "openai");
    expect(d.verdict).toBe("cross_family");
    expect(d.answerLabel).toBe("Anthropic");
    expect(d.validationLabel).toBe("OpenAI");
  });

  it("treats provider aliases on the same family as same_family (no fake cross-check)", () => {
    // claude → anthropic, anthropic → anthropic: same underlying family.
    expect(deriveCrossModel("claude", "anthropic").verdict).toBe("same_family");
    expect(deriveCrossModel("gpt", "openai").verdict).toBe("same_family");
  });

  it("is unverifiable when the validation side is missing", () => {
    expect(deriveCrossModel("anthropic", null).verdict).toBe("unverifiable");
    expect(deriveCrossModel("anthropic", "").verdict).toBe("unverifiable");
  });

  it("is unverifiable when EITHER side is an unknown family (won't claim a tick)", () => {
    expect(deriveCrossModel("anthropic", "acme-llm").verdict).toBe("unverifiable");
    expect(deriveCrossModel("acme-llm", "openai").verdict).toBe("unverifiable");
  });

  it("is unverifiable when both sides are unknown even if strings differ", () => {
    expect(deriveCrossModel("acme-a", "acme-b").verdict).toBe("unverifiable");
  });
});
