import { describe, it, expect } from "vitest";
import {
  VerificationRuleSetSchema,
  VerificationRulePolicySchema,
  DomainPackVerificationRulesSchema,
} from "./verification-rules.js";

const validDimension = (id: string, weight: number) => ({
  id,
  name: id,
  description: "desc",
  weight,
  prompt_template: "score it",
  passing_threshold: 0.6,
});

const validRuleSet = {
  id: "restormel-core-v1",
  name: "Restormel Core v1",
  version: "1.0.0",
  description: "default",
  dimensions: [
    validDimension("logical_structure", 0.25),
    validDimension("evidence_grounding", 0.2),
    validDimension("counterargument_coverage", 0.2),
    validDimension("scope_calibration", 0.15),
    validDimension("assumption_transparency", 0.1),
    validDimension("internal_consistency", 0.1),
  ],
  policies: [{ id: "balanced", name: "balanced", min_overall_score: 0.6, weak_threshold: 0.45 }],
  domain_hints: ["philosophy"],
};

describe("VerificationRuleSetSchema", () => {
  it("accepts a well-formed rule set", () => {
    expect(() => VerificationRuleSetSchema.parse(validRuleSet)).not.toThrow();
  });

  it("requires exactly six dimensions", () => {
    expect(() =>
      VerificationRuleSetSchema.parse({ ...validRuleSet, dimensions: validRuleSet.dimensions.slice(0, 5) }),
    ).toThrow();
  });

  it("rejects a non-semver version", () => {
    expect(() => VerificationRuleSetSchema.parse({ ...validRuleSet, version: "1.0" })).toThrow();
  });

  it("rejects an unknown dimension id", () => {
    expect(() =>
      VerificationRulePolicySchema.parse({ id: "x", name: "nope", min_overall_score: 0.6, weak_threshold: 0.4 }),
    ).toThrow();
  });
});

describe("DomainPackVerificationRulesSchema", () => {
  it("accepts a rule_set_ref override", () => {
    expect(() =>
      DomainPackVerificationRulesSchema.parse({ type: "rule_set_ref", rule_set_id: "restormel-core-v1" }),
    ).not.toThrow();
  });

  it("accepts inline_overrides", () => {
    expect(() =>
      DomainPackVerificationRulesSchema.parse({
        type: "inline_overrides",
        dimension_overrides: { logical_structure: 0.4 },
      }),
    ).not.toThrow();
  });

  it("rejects an unknown override type", () => {
    expect(() => DomainPackVerificationRulesSchema.parse({ type: "bogus" })).toThrow();
  });
});
