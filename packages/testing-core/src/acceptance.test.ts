import { describe, expect, it } from "vitest";
import { aggregateAcceptanceCriterionResults } from "./acceptance.js";

describe("aggregateAcceptanceCriterionResults", () => {
  it("uses acSequenceSteps for per-criterion verdict when present", () => {
    const defs = [
      { id: "ac1", text: "t1" },
      { id: "ac2", text: "t2" },
    ];
    const goalRuns = [
      {
        goalId: "g1",
        verdict: "failed" as const,
        reasonCode: "AC_SEQUENCE_FAILED",
        summary: "Roll-up failed",
        retriesUsed: 0,
        evidenceRefs: [] as string[],
        acceptanceCriterionIds: ["ac1", "ac2"],
        acSequenceSteps: [
          {
            criterionId: "ac1",
            verdict: "passed" as const,
            reasonCode: "AC_STEP_OK",
            summary: "ok",
            agentRoundsUsed: 1,
            evidenceRefs: [] as string[],
          },
          {
            criterionId: "ac2",
            verdict: "failed" as const,
            reasonCode: "AC_STEP_FAILED",
            summary: "bad",
            agentRoundsUsed: 2,
            evidenceRefs: ["goals/g1/ac-sequence/attempt-0-ac2.png"],
          },
        ],
      },
    ];
    const out = aggregateAcceptanceCriterionResults(defs, goalRuns);
    expect(out).toBeDefined();
    const ac1 = out!.find((x) => x.id === "ac1");
    const ac2 = out!.find((x) => x.id === "ac2");
    expect(ac1?.verdict).toBe("passed");
    expect(ac2?.verdict).toBe("failed");
    expect(ac2?.evidenceRefs).toContain("goals/g1/ac-sequence/attempt-0-ac2.png");
  });
});
