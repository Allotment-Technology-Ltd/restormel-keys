import { describe, expect, it } from "vitest";
import {
  expandPoolMembersFromStep,
  orderPoolCandidates,
  parseModelPool,
} from "$lib/server/model-pool";

describe("parseModelPool", () => {
  it("accepts v1 pool with members", () => {
    const p = parseModelPool({
      version: 1,
      selectionStrategy: "first_eligible",
      members: [{ providerPreference: "openai", modelId: "gpt-4o-mini" }],
    });
    expect(p?.members).toHaveLength(1);
    expect(p?.selectionStrategy).toBe("first_eligible");
  });

  it("rejects invalid shapes", () => {
    expect(parseModelPool(null)).toBeNull();
    expect(parseModelPool({ version: 2, selectionStrategy: "first_eligible", members: [] })).toBeNull();
    expect(
      parseModelPool({ version: 1, selectionStrategy: "nope", members: [{ providerPreference: "a", modelId: "b" }] })
    ).toBeNull();
  });
});

describe("orderPoolCandidates", () => {
  const candidates = [
    { providerPreference: "openai", modelId: "a", memberIndex: 0 },
    { providerPreference: "anthropic", modelId: "b", memberIndex: 1 },
  ];

  it("round_robin rotates by attempt + orderIndex", () => {
    const pool = {
      version: 1 as const,
      selectionStrategy: "round_robin" as const,
      members: [
        { providerPreference: "openai", modelId: "a" },
        { providerPreference: "anthropic", modelId: "b" },
      ],
    };
    const o0 = orderPoolCandidates("round_robin", [...candidates], "seed", 0, 0, pool);
    expect(o0[0].memberIndex).toBe(0);
    const o1 = orderPoolCandidates("round_robin", [...candidates], "seed", 1, 0, pool);
    expect(o1[0].memberIndex).toBe(1);
  });

  it("deterministic_hash is stable for same seed", () => {
    const pool = {
      version: 1 as const,
      selectionStrategy: "deterministic_hash" as const,
      members: [
        { providerPreference: "openai", modelId: "a" },
        { providerPreference: "anthropic", modelId: "b" },
      ],
    };
    const a = orderPoolCandidates("deterministic_hash", [...candidates], "fixed", 0, 0, pool);
    const b = orderPoolCandidates("deterministic_hash", [...candidates], "fixed", 0, 0, pool);
    expect(a.map((x) => x.memberIndex)).toEqual(b.map((x) => x.memberIndex));
  });
});

describe("expandPoolMembersFromStep", () => {
  it("falls back to single provider/model when no pool", () => {
    const { pool, candidates } = expandPoolMembersFromStep(
      { providerPreference: "openai", modelId: "gpt-4o", modelPool: null },
      null
    );
    expect(pool).toBeNull();
    expect(candidates).toHaveLength(1);
    expect(candidates[0].modelId).toBe("gpt-4o");
  });
});
