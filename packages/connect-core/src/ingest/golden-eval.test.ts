import { describe, expect, it } from "vitest";
import {
  assertG2Targets,
  computeG2Metrics,
  goldenExtractionEvalFingerprint,
  loadGoldenExtractionEval,
  PHILOSOPHY_STARTER_GOLDEN,
} from "./golden-eval.js";

describe("goldenExtractionEval", () => {
  it("loads bundled philosophy starter fixture", () => {
    const f = loadGoldenExtractionEval();
    expect(f.version).toBe(1);
    expect(f.items.length).toBeGreaterThanOrEqual(2);
  });

  it("fingerprint is stable for same items", () => {
    const a = goldenExtractionEvalFingerprint(PHILOSOPHY_STARTER_GOLDEN.items);
    const b = goldenExtractionEvalFingerprint([...PHILOSOPHY_STARTER_GOLDEN.items]);
    expect(a).toBe(b);
    expect(a).toHaveLength(16);
  });

  it("G2 metrics pass at quality bar targets", () => {
    const metrics = computeG2Metrics({ ok: 92, weak: 6, unsupported: 2 });
    expect(assertG2Targets(metrics).pass).toBe(true);
  });

  it("G2 metrics fail when unsupported rate too high", () => {
    const metrics = computeG2Metrics({ ok: 80, weak: 10, unsupported: 10 });
    expect(assertG2Targets(metrics).pass).toBe(false);
  });
});
