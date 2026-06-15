import { describe, it, expect } from "vitest";
import {
  resolveCostPerMillion,
  projectedRunCostUsd,
  formatCostPerMillion,
  formatRunCost,
  type RateResolver,
} from "./cost";

const fixed: RateResolver = () => ({ inputPerMillion: 2, outputPerMillion: 8 });
const none: RateResolver = () => null;
const zero: RateResolver = () => ({ inputPerMillion: 0, outputPerMillion: 0 });

describe("cost resolution — never $0 for an unpriced model", () => {
  it("resolves known rates", () => {
    const r = resolveCostPerMillion("any", fixed);
    expect(r.known).toBe(true);
    if (r.known) expect(r.perMillion.inputPerMillion).toBe(2);
  });
  it("returns known:false when pricing is absent", () => {
    expect(resolveCostPerMillion("any", none).known).toBe(false);
  });
  it("treats all-zero rates as unknown (the $0 bug guard)", () => {
    expect(resolveCostPerMillion("any", zero).known).toBe(false);
  });
});

describe("projected $/run", () => {
  it("computes from per-stage token estimates", () => {
    // extraction = 13k in / 4k out; rates 2/8 per 1M → (13000*2 + 4000*8)/1e6
    const est = projectedRunCostUsd("any", "extraction", fixed);
    expect(est.known).toBe(true);
    if (est.known) expect(est.usd).toBeCloseTo((13000 * 2 + 4000 * 8) / 1_000_000, 9);
  });
  it("is unknown when unpriced", () => {
    expect(projectedRunCostUsd("any", "extraction", none).known).toBe(false);
  });
});

describe("UI labels never render $0 for unpriced", () => {
  it("formats 'cost unknown'", () => {
    expect(formatCostPerMillion(resolveCostPerMillion("any", none))).toBe("cost unknown");
    expect(formatRunCost(projectedRunCostUsd("any", "extraction", none))).toBe("cost unknown");
  });
  it("formats known cost", () => {
    expect(formatCostPerMillion(resolveCostPerMillion("any", fixed))).toMatch(/\$2\.00 in/);
  });
});
