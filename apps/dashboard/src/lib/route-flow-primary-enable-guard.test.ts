import { describe, expect, it } from "vitest";
import { getPrimaryChainEnableBlockMessage } from "$lib/route-flow-primary-enable-guard";

describe("getPrimaryChainEnableBlockMessage", () => {
  it("blocks disabling the last enabled step in the first linear segment when a fallback exists", () => {
    const steps = [
      { id: "a", orderIndex: 0, enabled: true, parallelGroupId: null },
      { id: "b", orderIndex: 1, enabled: true, parallelGroupId: null },
    ];
    const msg = getPrimaryChainEnableBlockMessage({ steps, stepId: "a", nextEnabled: false });
    expect(msg).toBeTruthy();
    expect(msg).toContain("primary position");
  });

  it("allows disabling a linear fallback step", () => {
    const steps = [
      { id: "a", orderIndex: 0, enabled: true, parallelGroupId: null },
      { id: "b", orderIndex: 1, enabled: true, parallelGroupId: null },
    ];
    expect(getPrimaryChainEnableBlockMessage({ steps, stepId: "b", nextEnabled: false })).toBeNull();
  });

  it("blocks disabling the last enabled branch in a primary parallel group", () => {
    const steps = [
      { id: "a", orderIndex: 0, enabled: true, parallelGroupId: "g1" },
      { id: "b", orderIndex: 1, enabled: false, parallelGroupId: "g1" },
      { id: "c", orderIndex: 2, enabled: true, parallelGroupId: null },
    ];
    const msg = getPrimaryChainEnableBlockMessage({ steps, stepId: "a", nextEnabled: false });
    expect(msg).toBeTruthy();
    expect(msg).toContain("parallel");
  });

  it("allows disabling one branch when another stays enabled in primary parallel", () => {
    const steps = [
      { id: "a", orderIndex: 0, enabled: true, parallelGroupId: "g1" },
      { id: "b", orderIndex: 1, enabled: true, parallelGroupId: "g1" },
    ];
    expect(getPrimaryChainEnableBlockMessage({ steps, stepId: "a", nextEnabled: false })).toBeNull();
  });

  it("allows disabling a member of a non-primary parallel group", () => {
    const steps = [
      { id: "a", orderIndex: 0, enabled: true, parallelGroupId: null },
      { id: "b", orderIndex: 1, enabled: true, parallelGroupId: "g1" },
      { id: "c", orderIndex: 2, enabled: true, parallelGroupId: "g1" },
    ];
    expect(getPrimaryChainEnableBlockMessage({ steps, stepId: "b", nextEnabled: false })).toBeNull();
    expect(getPrimaryChainEnableBlockMessage({ steps, stepId: "c", nextEnabled: false })).toBeNull();
  });

  it("allows enabling without a guard", () => {
    const steps = [{ id: "a", orderIndex: 0, enabled: false, parallelGroupId: null }];
    expect(getPrimaryChainEnableBlockMessage({ steps, stepId: "a", nextEnabled: true })).toBeNull();
  });
});
