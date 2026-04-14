import { describe, it, expect } from "vitest";
import { computeEnabledStepOrderForGraph } from "./route-order-graph";
import type { RouteStepRecord } from "$lib/server/db";

function step(
  id: string,
  orderIndex: number,
  enabled = true
): RouteStepRecord {
  return {
    id,
    routeId: "r1",
    orderIndex,
    providerPreference: "openai",
    modelId: "m1",
    conditionBlock: null,
    fallbackOn: null,
    timeoutMs: null,
    enabled,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  };
}

describe("computeEnabledStepOrderForGraph", () => {
  it("uses linear order when there are no edges", () => {
    const steps = [step("b", 1), step("a", 0)];
    const out = computeEnabledStepOrderForGraph(steps, [], null);
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("DFS follows edges from entry with priority", () => {
    const steps = [step("a", 0), step("b", 1), step("c", 2)];
    const edges = [
      { fromStepId: "a", toStepId: "c", priority: 0 },
      { fromStepId: "a", toStepId: "b", priority: 1 },
    ];
    const out = computeEnabledStepOrderForGraph(steps, edges, "a");
    expect(out.map((s) => s.id)).toEqual(["a", "c", "b"]);
  });

  it("appends unreachable enabled steps by orderIndex", () => {
    const steps = [step("a", 0), step("b", 1), step("c", 2)];
    const edges = [{ fromStepId: "a", toStepId: "b", priority: 0 }];
    const out = computeEnabledStepOrderForGraph(steps, edges, "a");
    expect(out.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });
});
