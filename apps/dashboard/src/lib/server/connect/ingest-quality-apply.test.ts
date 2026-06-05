import { describe, expect, it, vi } from "vitest";

vi.mock("$lib/server/neon", () => ({
  getRecentProductionG2Metrics: vi.fn(),
  bumpBuiltinPackPromptVersionsByArchetypes: vi.fn(),
  getIngestQualityRunById: vi.fn(),
  markIngestQualityRunApplied: vi.fn(),
}));

import { getRecentProductionG2Metrics } from "$lib/server/neon";
import { checkIngestQualityG2Gate } from "./ingest-quality-apply";

describe("checkIngestQualityG2Gate", () => {
  it("calls assertG2Targets when production samples exist", async () => {
    vi.mocked(getRecentProductionG2Metrics).mockResolvedValue({
      ok_pct: 95,
      unsupported_pct: 1,
      sample_jobs: 3,
    });

    const result = await checkIngestQualityG2Gate();
    expect(result.pass).toBe(true);
    expect(result.sample_jobs).toBe(3);
  });

  it("returns awaiting-data copy when sample_jobs is zero", async () => {
    vi.mocked(getRecentProductionG2Metrics).mockResolvedValue({
      ok_pct: 0,
      unsupported_pct: 0,
      sample_jobs: 0,
    });

    const result = await checkIngestQualityG2Gate();
    expect(result.pass).toBe(false);
    expect(result.reasons[0]).toContain("No recent production ingest runs");
  });
});
