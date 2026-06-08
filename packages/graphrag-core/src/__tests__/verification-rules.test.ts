import { describe, it, expect } from "vitest";
import { VerificationRuleSetSchema } from "@restormel/contracts/verification-rules";
import {
  RESTORMEL_CORE_RULE_SET,
  RESTORMEL_CORE_RULE_SET_ID,
  dimensionWeightSum,
  resolveVerificationRuleSet,
  classifyByPolicy,
  selectPolicy,
} from "../verification/rules/index.js";

describe("Restormel Core v1 rule set", () => {
  it("is a valid VerificationRuleSet with six dimensions and three policies", () => {
    expect(() => VerificationRuleSetSchema.parse(RESTORMEL_CORE_RULE_SET)).not.toThrow();
    expect(RESTORMEL_CORE_RULE_SET.dimensions).toHaveLength(6);
    expect(RESTORMEL_CORE_RULE_SET.policies.map((p) => p.name)).toEqual(["strict", "balanced", "lenient"]);
  });

  it("has dimension weights that sum to 1.0", () => {
    expect(dimensionWeightSum(RESTORMEL_CORE_RULE_SET)).toBeCloseTo(1.0, 6);
  });

  it("encodes the real reasoning-eval weights", () => {
    const byId = Object.fromEntries(RESTORMEL_CORE_RULE_SET.dimensions.map((d) => [d.id, d.weight]));
    expect(byId).toMatchObject({
      logical_structure: 0.25,
      evidence_grounding: 0.2,
      counterargument_coverage: 0.2,
      scope_calibration: 0.15,
      assumption_transparency: 0.1,
      internal_consistency: 0.1,
    });
  });
});

describe("resolveVerificationRuleSet", () => {
  it("defaults to the built-in core when there is no override", () => {
    expect(resolveVerificationRuleSet().id).toBe(RESTORMEL_CORE_RULE_SET_ID);
    expect(resolveVerificationRuleSet(null).id).toBe(RESTORMEL_CORE_RULE_SET_ID);
  });

  it("resolves a referenced rule set id, falling back to core for unknown ids", () => {
    expect(resolveVerificationRuleSet({ type: "rule_set_ref", rule_set_id: RESTORMEL_CORE_RULE_SET_ID }).id).toBe(
      RESTORMEL_CORE_RULE_SET_ID,
    );
    expect(resolveVerificationRuleSet({ type: "rule_set_ref", rule_set_id: "does-not-exist" }).id).toBe(
      RESTORMEL_CORE_RULE_SET_ID,
    );
  });

  it("applies inline overrides and renormalises weights to 1.0", () => {
    const resolved = resolveVerificationRuleSet({
      type: "inline_overrides",
      dimension_overrides: { logical_structure: 0.5 },
    });
    expect(resolved.id).toBe(`${RESTORMEL_CORE_RULE_SET_ID}+inline`);
    expect(dimensionWeightSum(resolved)).toBeCloseTo(1.0, 6);
    // logical_structure was boosted, so its normalised weight exceeds the core 0.25.
    const ls = resolved.dimensions.find((d) => d.id === "logical_structure");
    expect(ls?.weight).toBeGreaterThan(0.25);
  });
});

describe("classifyByPolicy / selectPolicy", () => {
  const balanced = selectPolicy(RESTORMEL_CORE_RULE_SET);

  it("defaults to the balanced policy", () => {
    expect(balanced.name).toBe("balanced");
  });

  it("classifies overall scores into supported / weak / unsupported", () => {
    expect(classifyByPolicy(0.8, balanced)).toBe("supported");
    expect(classifyByPolicy(0.5, balanced)).toBe("weak");
    expect(classifyByPolicy(0.2, balanced)).toBe("unsupported");
  });

  it("strict raises the bar for supported", () => {
    const strict = selectPolicy(RESTORMEL_CORE_RULE_SET, "strict");
    expect(classifyByPolicy(0.7, strict)).toBe("weak"); // 0.7 < strict.min_overall_score (0.75)
    expect(classifyByPolicy(0.7, balanced)).toBe("supported");
  });
});
