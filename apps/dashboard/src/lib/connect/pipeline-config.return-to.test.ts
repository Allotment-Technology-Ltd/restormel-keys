import { describe, expect, it } from "vitest";
import {
  CONNECT_GRAPH_BASE,
  CONNECT_MODELS_BASE,
  CONNECT_PIPELINE_BASE,
  PIPELINE_WIZARD_STEPS,
  ALL_PIPELINE_WIZARD_STEP_IDS,
  isPipelineWizardStep,
  nextPipelineWizardStep,
  pipelineWizardStepLabel,
  type PipelineWizardStepId,
  parseReturnTo,
  returnContextBackLabel,
  returnContextFromLabel,
  returnContextHref,
  withReturnTo,
  isRouteBuilderPath,
} from "./pipeline-config";

describe("R4 guided-flow step order (§1.1)", () => {
  it("orders the visible flow provider → sources → domain → launch", () => {
    expect(PIPELINE_WIZARD_STEPS.map((s) => s.id)).toEqual([
      "provider",
      "sources",
      "domain",
      "launch",
    ]);
  });

  // Walk the actual "Continue" traversal (nextPipelineWizardStep — the same fn the
  // wizard footer calls) from a provisioned entry step, counting panels reached.
  function traverse(entry: PipelineWizardStepId, packSatisfied: boolean): PipelineWizardStepId[] {
    const visited: PipelineWizardStepId[] = [entry];
    let current: PipelineWizardStepId = entry;
    // Bounded by step count — never loops.
    for (let i = 0; i < PIPELINE_WIZARD_STEPS.length; i++) {
      const next = nextPipelineWizardStep(current, packSatisfied);
      if (!next) break;
      visited.push(next);
      current = next;
    }
    return visited;
  }

  // Ship gate (R4-U1): the provisioned golden path reaches launch in two panels.
  // A provisioned workspace enters at `sources` with a pack already satisfied;
  // simulating the real Continue traversal must skip the demoted/optional `domain`
  // panel and land on `launch` — sources + pack → preflight = 2 panels.
  it("provisioned golden path is two panels (real goNext traversal skips domain)", () => {
    const panels = traverse("sources", /* packSatisfied */ true);
    expect(panels).toEqual(["sources", "launch"]);
    expect(panels).toHaveLength(2);
    expect(panels).not.toContain("domain");
  });

  // Conversely, with NO pack satisfied, Continue from `sources` must route THROUGH
  // `domain` so the operator chooses a pack — three panels (the non-provisioned path).
  it("non-provisioned path routes through domain (sources → domain → launch)", () => {
    const panels = traverse("sources", /* packSatisfied */ false);
    expect(panels).toEqual(["sources", "domain", "launch"]);
  });

  // `domain` stays reachable as a real step regardless of provisioning — Continue
  // from it lands on launch, and it advances even when a pack is satisfied.
  it("keeps domain reachable: Continue from domain always lands on launch", () => {
    expect(nextPipelineWizardStep("domain", true)).toBe("launch");
    expect(nextPipelineWizardStep("domain", false)).toBe("launch");
    expect(nextPipelineWizardStep("launch", true)).toBeNull();
  });

  it("demotes the store step off the visible strip but keeps it a valid id", () => {
    expect(PIPELINE_WIZARD_STEPS.map((s) => s.id)).not.toContain("store");
    expect(isPipelineWizardStep("store")).toBe(true);
    expect(ALL_PIPELINE_WIZARD_STEP_IDS).toContain("store");
    expect(pipelineWizardStepLabel("store")).toBe("Graph store");
  });

  it("keeps provider and every legacy step id valid (redirect stubs + hrefs)", () => {
    for (const id of ["provider", "sources", "domain", "launch", "store"]) {
      expect(isPipelineWizardStep(id)).toBe(true);
    }
    expect(isPipelineWizardStep("nope")).toBe(false);
    expect(pipelineWizardStepLabel("provider")).toBe("Provider key");
  });
});

describe("parseReturnTo", () => {
  it("parses ingest-routes", () => {
    const params = new URLSearchParams("returnTo=ingest-routes");
    expect(parseReturnTo(params)).toEqual({ kind: "ingest-routes" });
  });

  it("parses graph-auto-remediate", () => {
    const params = new URLSearchParams("returnTo=graph-auto-remediate");
    expect(parseReturnTo(params)).toEqual({ kind: "graph-auto-remediate" });
  });

  it("parses graph-embed-backfill", () => {
    const params = new URLSearchParams("returnTo=graph-embed-backfill");
    expect(parseReturnTo(params)).toEqual({ kind: "graph-embed-backfill" });
  });

  it("parses pipeline-setup with step", () => {
    const params = new URLSearchParams("returnTo=pipeline-setup&step=domain");
    expect(parseReturnTo(params)).toEqual({ kind: "pipeline-setup", step: "domain" });
  });

  it("returns null for pipeline-setup without valid step", () => {
    const params = new URLSearchParams("returnTo=pipeline-setup&step=invalid");
    expect(parseReturnTo(params)).toBeNull();
  });

  it("falls back to legacy wizard_step", () => {
    const params = new URLSearchParams("wizard_step=sources");
    expect(parseReturnTo(params)).toEqual({ kind: "pipeline-setup", step: "sources" });
  });

  it("returns null when no context", () => {
    expect(parseReturnTo(new URLSearchParams())).toBeNull();
  });
});

describe("withReturnTo", () => {
  it("appends ingest-routes param", () => {
    expect(withReturnTo("/keys/dashboard/routes/ingestion", { kind: "ingest-routes" })).toBe(
      "/keys/dashboard/routes/ingestion?returnTo=ingest-routes",
    );
  });

  it("appends pipeline-setup and step", () => {
    const href = withReturnTo("/keys/dashboard/routes/ingestion", {
      kind: "pipeline-setup",
      step: "domain",
    });
    expect(href).toContain("returnTo=pipeline-setup");
    expect(href).toContain("step=domain");
  });

  it("strips legacy wizard_step when setting returnTo", () => {
    const href = withReturnTo("/keys/dashboard/routes/ingestion?wizard_step=sources", {
      kind: "pipeline-setup",
      step: "domain",
    });
    expect(href).not.toContain("wizard_step");
    expect(href).toContain("returnTo=pipeline-setup");
  });
});

describe("returnContextHref", () => {
  it("maps ingest-routes to models page", () => {
    expect(returnContextHref({ kind: "ingest-routes" })).toBe(CONNECT_MODELS_BASE);
  });

  it("maps graph-auto-remediate to graph tools workspace", () => {
    expect(returnContextHref({ kind: "graph-auto-remediate" })).toBe(
      `${CONNECT_GRAPH_BASE}?workspace=tools`,
    );
  });

  it("maps graph-embed-backfill to embed tool focus", () => {
    expect(returnContextHref({ kind: "graph-embed-backfill" })).toBe(
      `${CONNECT_GRAPH_BASE}?workspace=tools&focus=embed`,
    );
  });

  it("maps pipeline-setup to wizard step", () => {
    expect(returnContextHref({ kind: "pipeline-setup", step: "launch" })).toBe(
      `${CONNECT_PIPELINE_BASE}?step=launch`,
    );
  });
});

describe("returnContext labels", () => {
  it("formats ingest-routes labels", () => {
    const ctx = { kind: "ingest-routes" as const };
    expect(returnContextBackLabel(ctx)).toBe("← Back to Ingest Routes");
    expect(returnContextFromLabel(ctx)).toBe("From: Ingest Routes");
  });

  it("formats pipeline-setup labels", () => {
    const ctx = { kind: "pipeline-setup" as const, step: "domain" as const };
    expect(returnContextBackLabel(ctx)).toBe("← Back to pipeline setup — Step: Domain");
    expect(returnContextFromLabel(ctx)).toBe("From: Pipeline setup");
  });

  it("formats graph-auto-remediate labels", () => {
    const ctx = { kind: "graph-auto-remediate" as const };
    expect(returnContextBackLabel(ctx)).toBe("← Back to auto-remediate");
    expect(returnContextFromLabel(ctx)).toBe("From: Graph auto-remediate");
  });
});

describe("isRouteBuilderPath", () => {
  it("matches project route detail paths", () => {
    expect(isRouteBuilderPath("/keys/dashboard/projects/abc/routes/def")).toBe(true);
  });

  it("rejects list and other paths", () => {
    expect(isRouteBuilderPath("/keys/dashboard/projects/abc/routes")).toBe(false);
    expect(isRouteBuilderPath("/keys/dashboard/routes/ingestion")).toBe(false);
  });
});
