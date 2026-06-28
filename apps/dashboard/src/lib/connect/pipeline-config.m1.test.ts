/**
 * RES-113 · PR-C — M1 "Build" friendly reskin model.
 *
 * These cover the additive, flag-gated presentation helpers only. They assert the
 * friendly grouping maps onto the REAL wizard steps / pipeline stages without
 * changing them, and that rung states are derived from honest completion signals
 * (REC-ADR-016) rather than live step position.
 */
import { describe, it, expect } from "vitest";
import {
  M1_BUILD_RUNGS,
  M1_WIZARD_STEP_TO_RUNG,
  M1_FRIENDLY_STAGE_LABELS,
  M1_RUN_FRONT_STAGES,
  M1_RUN_BACK_STAGES,
  M1_RATE_LIMIT_BANNER,
  PIPELINE_STAGES,
  ALL_PIPELINE_WIZARD_STEP_IDS,
  m1RungForWizardStep,
  m1BuildRung,
  m1CompletedRungsFromSteps,
  m1RungVisualState,
  m1RunConsoleRungs,
  m1FriendlyStageLabel,
  isM1RateLimitedStatus,
  isM1StageBackingOff,
  isM1StageRateLimited,
  type M1BuildRungId,
} from "./pipeline-config";

describe("M1 friendly rung model", () => {
  it("has exactly the four friendly rungs in ladder order", () => {
    expect(M1_BUILD_RUNGS.map((r) => r.id)).toEqual(["sources", "configure", "running", "done"]);
  });

  it("maps every live wizard step (incl. demoted store) to a friendly rung", () => {
    for (const step of ALL_PIPELINE_WIZARD_STEP_IDS) {
      expect(M1_WIZARD_STEP_TO_RUNG[step]).toBeDefined();
    }
  });

  it("folds provider key, domain pack and store into Configure", () => {
    expect(m1RungForWizardStep("provider")).toBe("configure");
    expect(m1RungForWizardStep("domain")).toBe("configure");
    expect(m1RungForWizardStep("store")).toBe("configure");
    expect(m1RungForWizardStep("launch")).toBe("configure");
    expect(m1RungForWizardStep("sources")).toBe("sources");
  });

  it("resolves a rung definition by id with a safe fallback", () => {
    expect(m1BuildRung("done").title).toBe("Ask your own data");
    expect(m1BuildRung("nope" as M1BuildRungId).id).toBe("sources");
  });
});

describe("m1CompletedRungsFromSteps", () => {
  it("marks Sources complete once a source step is done", () => {
    expect(m1CompletedRungsFromSteps(["sources"])).toEqual(["sources"]);
  });

  it("marks Configure complete on a domain pack OR a provider key", () => {
    expect(m1CompletedRungsFromSteps(["domain"])).toEqual(["configure"]);
    expect(m1CompletedRungsFromSteps(["provider"])).toEqual(["configure"]);
  });

  it("never marks Running or Done complete inside the wizard", () => {
    const done = m1CompletedRungsFromSteps(["provider", "sources", "domain"]);
    expect(done).toContain("sources");
    expect(done).toContain("configure");
    expect(done).not.toContain("running");
    expect(done).not.toContain("done");
  });

  it("is empty when nothing is configured yet", () => {
    expect(m1CompletedRungsFromSteps([])).toEqual([]);
  });
});

describe("m1RungVisualState", () => {
  const ctx = { activeRung: "configure" as M1BuildRungId, completedRungs: ["sources"] as M1BuildRungId[] };

  it("is active for the active rung", () => {
    expect(m1RungVisualState("configure", ctx)).toBe("active");
  });
  it("is completed for a completed rung", () => {
    expect(m1RungVisualState("sources", ctx)).toBe("completed");
  });
  it("is upcoming otherwise", () => {
    expect(m1RungVisualState("running", ctx)).toBe("upcoming");
    expect(m1RungVisualState("done", ctx)).toBe("upcoming");
  });
});

describe("m1RunConsoleRungs", () => {
  it("runs as active with Sources+Configure behind, while a run is in flight", () => {
    const r = m1RunConsoleRungs({ isCompleted: false });
    expect(r.activeRung).toBe("running");
    expect(r.completedRungs).toEqual(["sources", "configure"]);
  });

  it("flips to Done only once the run actually completes", () => {
    const r = m1RunConsoleRungs({ isCompleted: true });
    expect(r.activeRung).toBe("done");
    expect(r.completedRungs).toEqual(["sources", "configure", "running"]);
  });
});

describe("M1 friendly stage labels", () => {
  it("relabels every real pipeline stage", () => {
    for (const stage of PIPELINE_STAGES) {
      expect(M1_FRIENDLY_STAGE_LABELS[stage]).toBeTruthy();
    }
  });

  it("partitions the real stages into front (build) and back (check & store) halves", () => {
    const union = [...M1_RUN_FRONT_STAGES, ...M1_RUN_BACK_STAGES].sort();
    expect(union).toEqual([...PIPELINE_STAGES].sort());
  });

  it("falls back to the raw key for an unknown stage", () => {
    expect(m1FriendlyStageLabel("extracting")).toBe("Reading your documents");
    expect(m1FriendlyStageLabel("mystery")).toBe("mystery");
  });
});

describe("M1 rate-limit state (presentational, honest)", () => {
  it("recognises transient backoff statuses an engine may emit", () => {
    expect(isM1RateLimitedStatus("rate_limited")).toBe(true);
    expect(isM1RateLimitedStatus("rate-limited")).toBe(true);
    expect(isM1RateLimitedStatus("throttled")).toBe(true);
    expect(isM1RateLimitedStatus("backoff")).toBe(true);
  });

  it("does NOT fire for normal running / done statuses (no fabricated state)", () => {
    expect(isM1RateLimitedStatus("running")).toBe(false);
    expect(isM1RateLimitedStatus("completed")).toBe(false);
    expect(isM1RateLimitedStatus(null)).toBe(false);
    expect(isM1RateLimitedStatus(undefined)).toBe(false);
  });

  it("carries amber no-action-needed banner copy", () => {
    expect(M1_RATE_LIMIT_BANNER.title).toMatch(/rate-limited/i);
    expect(M1_RATE_LIMIT_BANNER.body).toMatch(/no action needed/i);
  });
});

describe("M1 rate-limit from the REAL structured backoff signal (PR-I)", () => {
  it("lights from a rate-limit-class structured backoff field", () => {
    expect(isM1StageBackingOff({ status: "running", backoff: { reason_code: "rate_limit" } })).toBe(
      true,
    );
    expect(isM1StageBackingOff({ status: "running", backoff: { reason_code: "overloaded" } })).toBe(
      true,
    );
  });

  it("does NOT light for transient-but-not-throttle reasons (honest labelling)", () => {
    expect(isM1StageBackingOff({ status: "running", backoff: { reason_code: "server_error" } })).toBe(
      false,
    );
    expect(isM1StageBackingOff({ status: "running", backoff: { reason_code: "timeout" } })).toBe(
      false,
    );
    expect(isM1StageBackingOff({ status: "running" })).toBe(false);
    expect(isM1StageBackingOff(null)).toBe(false);
  });

  it("combined helper accepts EITHER the structured field or the legacy status string", () => {
    expect(isM1StageRateLimited({ backoff: { reason_code: "rate_limit" } })).toBe(true);
    expect(isM1StageRateLimited({ status: "rate_limited" })).toBe(true);
    expect(isM1StageRateLimited({ status: "running" })).toBe(false);
    expect(isM1StageRateLimited({ status: "running", backoff: { reason_code: "timeout" } })).toBe(
      false,
    );
  });
});
