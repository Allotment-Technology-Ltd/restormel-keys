import { describe, expect, it } from "vitest";
import { evaluateConnectModelsReady, type StageRouteUiRow } from "./stage-routing";

function row(
  key: StageRouteUiRow["key"],
  published: boolean,
  enabled = true,
): StageRouteUiRow {
  return {
    key,
    label: key,
    help: "",
    ingestionStage: `ingestion_${key}`,
    route: published
      ? { id: `${key}-route`, name: key, status: "active", isPublished: true, enabled }
      : null,
    visualHref: null,
    activeModel: null,
  };
}

describe("evaluateConnectModelsReady", () => {
  it("requires project routing unless legacy hosted llm only", () => {
    expect(
      evaluateConnectModelsReady({
        stageRows: [],
        integrationsCount: 0,
        llmReady: false,
        hasProjectRouting: false,
      }),
    ).toEqual({ modelsReady: false, hasChatRoute: false, hasEmbeddingRoute: false });

    expect(
      evaluateConnectModelsReady({
        stageRows: [],
        integrationsCount: 0,
        llmReady: true,
        hasProjectRouting: false,
      }),
    ).toEqual({ modelsReady: true, hasChatRoute: true, hasEmbeddingRoute: true });
  });

  it("needs published chat and embedding routes when project is bound", () => {
    const onlyChat = [row("extraction", true), row("embedding", false)];
    expect(
      evaluateConnectModelsReady({
        stageRows: onlyChat,
        integrationsCount: 1,
        llmReady: false,
        hasProjectRouting: true,
      }),
    ).toEqual({ modelsReady: false, hasChatRoute: true, hasEmbeddingRoute: false });

    const ready = [row("extraction", true), row("embedding", true)];
    expect(
      evaluateConnectModelsReady({
        stageRows: ready,
        integrationsCount: 1,
        llmReady: false,
        hasProjectRouting: true,
      }),
    ).toEqual({ modelsReady: true, hasChatRoute: true, hasEmbeddingRoute: true });
  });
});
