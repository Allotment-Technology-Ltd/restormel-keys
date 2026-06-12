import { describe, expect, it } from "vitest";
import {
  buildConnectOperationalActions,
  buildConnectSetupSteps,
  isActiveIngestJobStatus,
  resolveConnectHubPrimaryAction,
  resolveConnectHubSecondaryActions,
  resolveConnectJourneyPhase,
  resolveDefaultPipelineStep,
  resolveNextSetupStep,
} from "./connect-journey";

describe("resolveConnectJourneyPhase", () => {
  it("returns initial when any required prerequisite is missing", () => {
    expect(
      resolveConnectJourneyPhase({ hasGraphStore: false, modelsReady: true, parsedDocumentCount: 3 }),
    ).toBe("initial");
    expect(
      resolveConnectJourneyPhase({ hasGraphStore: true, modelsReady: false, parsedDocumentCount: 3 }),
    ).toBe("initial");
    expect(
      resolveConnectJourneyPhase({ hasGraphStore: true, modelsReady: true, parsedDocumentCount: 0 }),
    ).toBe("initial");
  });

  it("returns operational when store, models, and docs are ready", () => {
    expect(
      resolveConnectJourneyPhase({ hasGraphStore: true, modelsReady: true, parsedDocumentCount: 2 }),
    ).toBe("operational");
  });
});

describe("resolveDefaultPipelineStep", () => {
  it("defaults operational users to launch", () => {
    expect(
      resolveDefaultPipelineStep({ phase: "operational", hasGraphStore: true, parsedDocumentCount: 2 }),
    ).toBe("launch");
  });

  it("defaults initial users without docs to sources", () => {
    expect(
      resolveDefaultPipelineStep({ phase: "initial", hasGraphStore: true, parsedDocumentCount: 0 }),
    ).toBe("sources");
  });
});

describe("buildConnectSetupSteps", () => {
  const base = {
    target: null,
    modelsReady: false,
    aiKeysDetail: "Add routes",
    customPack: null,
    parsedDocumentCount: 0,
    starterCorpusLoaded: false,
    connectionCount: 0,
    jobCount: 0,
    latestJob: null,
    hasGraph: false,
    surrealStoreReady: false,
    neonStoreReady: false,
  };

  it("orders models before sources", () => {
    const steps = buildConnectSetupSteps(base);
    const ids = steps.map((s) => s.id);
    expect(ids.indexOf("ai_keys")).toBeLessThan(ids.indexOf("sources"));
  });

  it("points run CTA at finish setup when prerequisites missing", () => {
    const steps = buildConnectSetupSteps({ ...base, target: { provider: "postgres", status: "ok" } });
    const run = steps.find((s) => s.id === "run");
    expect(run?.cta).toBe("Finish setup");
    expect(run?.href).toContain("/routes/ingestion");
  });
});

describe("resolveNextSetupStep", () => {
  it("returns first incomplete required step", () => {
    const steps = buildConnectSetupSteps({
      target: { provider: "postgres", status: "ok" },
      modelsReady: false,
      aiKeysDetail: "x",
      customPack: null,
      parsedDocumentCount: 0,
      starterCorpusLoaded: false,
      connectionCount: 0,
      jobCount: 0,
      latestJob: null,
      hasGraph: false,
      surrealStoreReady: false,
      neonStoreReady: true,
    });
    expect(resolveNextSetupStep(steps)?.id).toBe("ai_keys");
  });
});

describe("isActiveIngestJobStatus", () => {
  it("treats pending and running as active", () => {
    expect(isActiveIngestJobStatus("pending")).toBe(true);
    expect(isActiveIngestJobStatus("running")).toBe(true);
    expect(isActiveIngestJobStatus("completed")).toBe(false);
    expect(isActiveIngestJobStatus("failed")).toBe(false);
  });
});

describe("buildConnectOperationalActions", () => {
  it("includes primary new run action", () => {
    const actions = buildConnectOperationalActions({
      latestJob: null,
      hasGraph: true,
      surrealStoreReady: false,
      modelsReady: true,
    });
    expect(actions[0].id).toBe("new_run");
    expect(actions[0].primary).toBe(true);
  });

  it("labels active runs as watch live progress", () => {
    const actions = buildConnectOperationalActions({
      latestJob: { id: "j1", status: "running", label: "Philosophy corpus" },
      hasGraph: false,
      surrealStoreReady: true,
      modelsReady: true,
    });
    const runAction = actions.find((a) => a.id === "latest_run");
    expect(runAction?.cta).toBe("Watch live progress");
    expect(runAction?.title).toContain("Active run");
  });

  it("labels completed runs as open run", () => {
    const actions = buildConnectOperationalActions({
      latestJob: { id: "j1", status: "completed", label: "Philosophy corpus" },
      hasGraph: true,
      surrealStoreReady: true,
      modelsReady: true,
    });
    const runAction = actions.find((a) => a.id === "latest_run");
    expect(runAction?.cta).toBe("Open run");
    expect(runAction?.title).toContain("Latest run");
  });
});

describe("resolveConnectHubPrimaryAction", () => {
  it("uses operational primary action when phase is operational", () => {
    const actions = buildConnectOperationalActions({
      latestJob: null,
      hasGraph: true,
      surrealStoreReady: false,
      modelsReady: true,
    });
    const primary = resolveConnectHubPrimaryAction({
      phase: "operational",
      nextStep: null,
      operationalActions: actions,
    });
    expect(primary.cta).toBe("Start new run");
  });

  it("uses next setup step when phase is initial", () => {
    const steps = buildConnectSetupSteps({
      target: { provider: "postgres", status: "ok" },
      modelsReady: false,
      aiKeysDetail: "x",
      customPack: null,
      parsedDocumentCount: 0,
      starterCorpusLoaded: false,
      connectionCount: 0,
      jobCount: 0,
      latestJob: null,
      hasGraph: false,
      surrealStoreReady: false,
      neonStoreReady: true,
    });
    const next = resolveNextSetupStep(steps);
    const primary = resolveConnectHubPrimaryAction({
      phase: "initial",
      nextStep: next,
      operationalActions: null,
    });
    expect(primary.cta).toBe(next?.cta);
  });
});

describe("resolveConnectHubSecondaryActions", () => {
  it("omits new_run and view_graph when ledger shows graph CTA", () => {
    const actions = buildConnectOperationalActions({
      latestJob: null,
      hasGraph: true,
      surrealStoreReady: true,
      modelsReady: true,
    });
    const secondary = resolveConnectHubSecondaryActions({
      phase: "operational",
      operationalActions: actions,
      ledgerShowsGraphCta: true,
      ledgerShowsLatestRun: false,
    });
    expect(secondary.some((a) => a.id === "new_run")).toBe(false);
    expect(secondary.some((a) => a.id === "view_graph")).toBe(false);
    expect(secondary.some((a) => a.id === "agents")).toBe(true);
  });

  it("omits latest_run when ledger shows run tile", () => {
    const actions = buildConnectOperationalActions({
      latestJob: { id: "j1", status: "completed", label: "Test run" },
      hasGraph: true,
      surrealStoreReady: true,
      modelsReady: true,
    });
    const secondary = resolveConnectHubSecondaryActions({
      phase: "operational",
      operationalActions: actions,
      ledgerShowsGraphCta: true,
      ledgerShowsLatestRun: true,
    });
    expect(secondary.some((a) => a.id === "latest_run")).toBe(false);
  });
});
