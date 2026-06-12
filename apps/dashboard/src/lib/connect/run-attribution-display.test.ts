import { describe, expect, it } from "vitest";
import {
  attributionRecordedFrom,
  buildAttributionRows,
  providerFamily,
  type RunAttributionMap,
  type RunStageAttribution,
} from "./run-attribution-display";

const BASE = "/keys/dashboard";

function entry(over: Partial<RunStageAttribution> = {}): RunStageAttribution {
  return {
    routeId: "route-1",
    routeName: "Ingestion route",
    projectId: "proj-1",
    stepId: "step-1",
    stepOrderIndex: 0,
    provider: "openai",
    modelId: "gpt-4o",
    attempts: 1,
    recordedAt: "2026-06-12T10:00:00.000Z",
    ...over,
  };
}

describe("buildAttributionRows — populated", () => {
  it("builds a row per served stage with a builder href and 1-based step display", () => {
    const attribution: RunAttributionMap = {
      extraction: entry({ provider: "openai", modelId: "gpt-4o", stepOrderIndex: 0 }),
      validation: entry({
        provider: "anthropic",
        modelId: "claude-3.5",
        routeName: "Validation route",
        routeId: "route-2",
        stepOrderIndex: 2,
      }),
    };
    const rows = buildAttributionRows(attribution, BASE);
    expect(rows.map((r) => r.stage)).toEqual(["extraction", "validation"]);
    const ext = rows[0]!;
    expect(ext.modelId).toBe("gpt-4o");
    expect(ext.provider).toBe("openai");
    expect(ext.builderHref).toBe(`${BASE}/projects/proj-1/routes/route-1?flow=visual`);
    expect(ext.stepDisplay).toBe("step 1"); // 0-based index 0 → "step 1"
    expect(ext.attempts).toBe(1);
    const val = rows[1]!;
    expect(val.stepDisplay).toBe("step 3");
    expect(val.builderHref).toBe(`${BASE}/projects/proj-1/routes/route-2?flow=visual`);
  });

  it("marks validation cross-family vs extraction (the K4 cross-model line context)", () => {
    const cross = buildAttributionRows(
      {
        extraction: entry({ provider: "openai" }),
        validation: entry({ provider: "anthropic" }),
      },
      BASE,
    );
    expect(cross.find((r) => r.stage === "validation")?.crossFamilyVsExtraction).toBe(true);

    const same = buildAttributionRows(
      {
        extraction: entry({ provider: "openai" }),
        validation: entry({ provider: "azure" }), // azure → openai family
      },
      BASE,
    );
    expect(same.find((r) => r.stage === "validation")?.crossFamilyVsExtraction).toBe(false);
  });

  it("omits a stage with no provider/model, and omits a stage entirely absent", () => {
    const rows = buildAttributionRows(
      {
        extraction: entry(),
        grouping: entry({ provider: null }), // not served
      },
      BASE,
    );
    expect(rows.map((r) => r.stage)).toEqual(["extraction"]);
  });

  it("falls back to a non-link route label when project/route id is missing", () => {
    const rows = buildAttributionRows(
      { extraction: entry({ projectId: null, routeId: null, stepOrderIndex: null }) },
      BASE,
    );
    expect(rows[0]!.builderHref).toBeNull();
    expect(rows[0]!.stepDisplay).toBeNull();
  });
});

describe("buildAttributionRows — absent / legacy runs", () => {
  it("returns no rows for a run that predates attribution (null / empty)", () => {
    expect(buildAttributionRows(null, BASE)).toEqual([]);
    expect(buildAttributionRows(undefined, BASE)).toEqual([]);
    expect(buildAttributionRows({}, BASE)).toEqual([]);
  });
});

describe("attributionRecordedFrom", () => {
  it("returns the earliest recorded timestamp across stages", () => {
    const d = attributionRecordedFrom({
      extraction: entry({ recordedAt: "2026-06-12T10:05:00.000Z" }),
      validation: entry({ recordedAt: "2026-06-12T10:01:00.000Z" }),
    });
    expect(d?.toISOString()).toBe("2026-06-12T10:01:00.000Z");
  });

  it("returns null when there is no attribution", () => {
    expect(attributionRecordedFrom(null)).toBeNull();
    expect(attributionRecordedFrom({})).toBeNull();
  });
});

describe("providerFamily", () => {
  it("collapses vendor variants to a canonical family", () => {
    expect(providerFamily("openai")).toBe("openai");
    expect(providerFamily("azure")).toBe("openai");
    expect(providerFamily("anthropic")).toBe("anthropic");
    expect(providerFamily("claude-via-bedrock")).toBe("anthropic");
    expect(providerFamily("gemini")).toBe("google");
    expect(providerFamily(null)).toBeNull();
  });
});
