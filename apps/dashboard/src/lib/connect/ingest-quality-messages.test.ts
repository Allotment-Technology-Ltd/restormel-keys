import { describe, expect, it } from "vitest";
import {
  describeG2Gate,
  describeNoThresholdsFired,
  isG2AwaitingData,
} from "./ingest-quality-messages";

describe("ingest-quality-messages", () => {
  it("returns null when G2 passes", () => {
    expect(
      describeG2Gate({
        pass: true,
        reasons: [],
        ok_pct: 95,
        unsupported_pct: 1,
        sample_jobs: 3,
      }),
    ).toBeNull();
  });

  it("explains awaiting-data state", () => {
    const msg = describeG2Gate({
      pass: false,
      reasons: ["No recent production ingest runs"],
      ok_pct: 0,
      unsupported_pct: 0,
      sample_jobs: 0,
    });
    expect(msg?.variant).toBe("info");
    expect(msg?.title).toContain("awaiting");
    expect(isG2AwaitingData({ pass: false, reasons: [], ok_pct: 0, unsupported_pct: 0, sample_jobs: 0 })).toBe(
      true,
    );
  });

  it("explains blocked G2 with metrics", () => {
    const msg = describeG2Gate({
      pass: false,
      reasons: ["ok_pct 43% < 90%"],
      ok_pct: 43,
      unsupported_pct: 5,
      sample_jobs: 4,
    });
    expect(msg?.variant).toBe("error");
    expect(msg?.summary).toContain("43%");
    expect(msg?.nextSteps.length).toBeGreaterThan(0);
  });

  it("explains no thresholds fired", () => {
    const msg = describeNoThresholdsFired(7);
    expect(msg.variant).toBe("info");
    expect(msg.summary).toContain("7");
  });
});
