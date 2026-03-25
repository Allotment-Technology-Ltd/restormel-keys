import { describe, it, expect } from "vitest";
import { validateRouteStepsForPublish } from "./route-publish-validation";
import type { RouteRecord, RouteStepRecord } from "$lib/server/db";

function route(overrides: Partial<RouteRecord> = {}): RouteRecord {
  return {
    id: "r1",
    projectId: "p1",
    environmentId: "env-1",
    name: "emb",
    description: null,
    defaultModelId: null,
    billingMode: null,
    routeMode: null,
    workload: null,
    stage: null,
    enabled: true,
    version: 1,
    publishedVersion: 1,
    status: "active",
    createdBy: "u1",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as RouteRecord;
}

function step(p: Partial<RouteStepRecord> & Pick<RouteStepRecord, "id" | "orderIndex">): RouteStepRecord {
  return {
    routeId: "r1",
    providerPreference: "openai",
    modelId: "gpt-4o",
    conditionBlock: null,
    fallbackOn: "error",
    timeoutMs: null,
    enabled: true,
    createdAt: new Date(1).toISOString(),
    updatedAt: new Date(1).toISOString(),
    ...p,
  } as RouteStepRecord;
}

describe("validateRouteStepsForPublish", () => {
  it("accepts voyage provider with voyage embedding model", () => {
    const errors = validateRouteStepsForPublish(route(), [
      step({ id: "s1", orderIndex: 0, providerPreference: "voyage", modelId: "voyage-3" }),
    ]);
    expect(errors).toEqual([]);
  });

  it("rejects unknown provider", () => {
    const errors = validateRouteStepsForPublish(route(), [
      step({ id: "s1", orderIndex: 0, providerPreference: "not-a-real-provider", modelId: "x" }),
    ]);
    expect(errors.some((e) => e.field === "providerPreference")).toBe(true);
  });

  it("still accepts google (stored) and openai", () => {
    expect(
      validateRouteStepsForPublish(route({ defaultModelId: "gpt-4o" }), [
        step({ id: "a", orderIndex: 0, providerPreference: "google", modelId: "gemini-1.5-flash" }),
      ])
    ).toEqual([]);
    expect(
      validateRouteStepsForPublish(route(), [
        step({ id: "b", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o" }),
      ])
    ).toEqual([]);
  });
});
