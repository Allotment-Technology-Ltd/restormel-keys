import { buildPassSpecificContextPacks } from "@restormel/context-packs";
import { describe, expect, it } from "vitest";
import {
  attachCorrelationToRetrievalInput,
  observabilityCorrelationFromView,
} from "./correlation.js";
import { projectWorkingMemory, workingMemoryToPromptBlock } from "./reducer.js";
import type { MemoryPolicy, StateEvent } from "./types.js";

const policy: MemoryPolicy = { maxCellsPerScope: 8, maxApproxTokensPerScope: 4000 };

describe("projectWorkingMemory", () => {
  it("returns empty view for no events", () => {
    const v = projectWorkingMemory([], policy);
    expect(v.scopes).toEqual({});
    expect(v.last_sequence).toBe(0);
    expect(v.applied_event_ids).toEqual([]);
  });

  it("upserts and removes cells", () => {
    const events: StateEvent[] = [
      {
        type: "memory_cell_upsert",
        id: "e1",
        ts: "2026-01-01T00:00:00.000Z",
        scope: "session",
        cell_id: "a",
        text: "hello",
      },
      {
        type: "memory_cell_upsert",
        id: "e2",
        ts: "2026-01-01T00:00:01.000Z",
        scope: "session",
        cell_id: "b",
        text: "world",
      },
      {
        type: "memory_cell_remove",
        id: "e3",
        ts: "2026-01-01T00:00:02.000Z",
        scope: "session",
        cell_id: "a",
      },
    ];
    const v = projectWorkingMemory(events, policy);
    expect(v.scopes.session).toHaveLength(1);
    expect(v.scopes.session[0].id).toBe("b");
    expect(v.last_sequence).toBe(3);
  });

  it("evicts oldest unpinned when over cell cap", () => {
    const small: MemoryPolicy = { maxCellsPerScope: 2, maxApproxTokensPerScope: 4000 };
    const events: StateEvent[] = [
      {
        type: "memory_cell_upsert",
        id: "e1",
        ts: "2026-01-01T00:00:00.000Z",
        scope: "s",
        cell_id: "a",
        text: "one",
      },
      {
        type: "memory_cell_upsert",
        id: "e2",
        ts: "2026-01-01T00:00:01.000Z",
        scope: "s",
        cell_id: "b",
        text: "two",
      },
      {
        type: "memory_cell_upsert",
        id: "e3",
        ts: "2026-01-01T00:00:02.000Z",
        scope: "s",
        cell_id: "c",
        text: "three",
      },
    ];
    const v = projectWorkingMemory(events, small);
    expect(v.scopes.s.map((c) => c.id).sort()).toEqual(["b", "c"]);
  });

  it("prefers evicting unpinned over pinned under cell cap", () => {
    const small: MemoryPolicy = { maxCellsPerScope: 2, maxApproxTokensPerScope: 4000 };
    const events: StateEvent[] = [
      {
        type: "memory_cell_upsert",
        id: "e1",
        ts: "2026-01-01T00:00:00.000Z",
        scope: "s",
        cell_id: "a",
        text: "one",
        pinned: true,
      },
      {
        type: "memory_cell_upsert",
        id: "e2",
        ts: "2026-01-01T00:00:01.000Z",
        scope: "s",
        cell_id: "b",
        text: "two",
      },
      {
        type: "memory_cell_upsert",
        id: "e3",
        ts: "2026-01-01T00:00:02.000Z",
        scope: "s",
        cell_id: "c",
        text: "three",
      },
    ];
    const v = projectWorkingMemory(events, small);
    const ids = v.scopes.s.map((c) => c.id).sort();
    expect(ids).toContain("a");
    expect(ids).toHaveLength(2);
  });

  it("applies summarize compact", () => {
    const events: StateEvent[] = [
      {
        type: "memory_cell_upsert",
        id: "e1",
        ts: "2026-01-01T00:00:00.000Z",
        scope: "stoa_session",
        cell_id: "t1",
        text: "long transcript chunk",
      },
      {
        type: "memory_cell_upsert",
        id: "e2",
        ts: "2026-01-01T00:00:01.000Z",
        scope: "stoa_session",
        cell_id: "t2",
        text: "another chunk",
      },
      {
        type: "memory_summarize_compact",
        id: "e3",
        ts: "2026-01-01T00:00:02.000Z",
        scope: "stoa_session",
        remove_cell_ids: ["t1", "t2"],
        summary_cell_id: "sum1",
        summary_text: "User discussed X.",
        run_id: "run-1",
      },
    ];
    const v = projectWorkingMemory(events, policy);
    expect(v.scopes.stoa_session).toHaveLength(1);
    expect(v.scopes.stoa_session[0].id).toBe("sum1");
    expect(v.scopes.stoa_session[0].text).toBe("User discussed X.");
  });

  it("clears scope", () => {
    const events: StateEvent[] = [
      {
        type: "memory_cell_upsert",
        id: "e1",
        ts: "2026-01-01T00:00:00.000Z",
        scope: "s",
        cell_id: "a",
        text: "x",
      },
      {
        type: "scope_clear",
        id: "e2",
        ts: "2026-01-01T00:00:01.000Z",
        scope: "s",
      },
    ];
    const v = projectWorkingMemory(events, policy);
    expect(v.scopes.s).toBeUndefined();
  });
});

describe("workingMemoryToPromptBlock", () => {
  it("orders scopes when requested", () => {
    const events: StateEvent[] = [
      {
        type: "memory_cell_upsert",
        id: "e1",
        ts: "2026-01-01T00:00:00.000Z",
        scope: "b_scope",
        cell_id: "a",
        text: "bb",
      },
      {
        type: "memory_cell_upsert",
        id: "e2",
        ts: "2026-01-01T00:00:01.000Z",
        scope: "a_scope",
        cell_id: "b",
        text: "aa",
      },
    ];
    const v = projectWorkingMemory(events, policy);
    const block = workingMemoryToPromptBlock(v, ["a_scope", "b_scope"]);
    expect(block.indexOf("a_scope")).toBeLessThan(block.indexOf("b_scope"));
  });
});

describe("correlation + context-packs", () => {
  it("preserves restormel_correlation on retrieval input through pack build", () => {
    const base = {
      claims: [
        {
          id: "c1",
          text: "Claim.",
          claim_type: "thesis",
          source_title: "S",
          confidence: 0.9,
        },
      ],
      relations: [],
      arguments: [],
      seed_claim_ids: ["c1"],
    };
    const withCorr = attachCorrelationToRetrievalInput(base, {
      run_id: "run-xyz",
      retrieval_version: "v3",
      state_sequence: 12,
      materialized_memory_event_ids: ["e10", "e11"],
    });
    const packs = buildPassSpecificContextPacks(withCorr, { depthMode: "quick" });
    expect(packs.analysis.block.length).toBeGreaterThan(0);
    expect(withCorr.restormel_correlation?.run_id).toBe("run-xyz");
  });

  it("observabilityCorrelationFromView includes tail id", () => {
    const view = projectWorkingMemory(
      [
        {
          type: "memory_cell_upsert",
          id: "ev-a",
          ts: "2026-01-01T00:00:00.000Z",
          scope: "s",
          cell_id: "c",
          text: "x",
        },
      ],
      policy
    );
    const o = observabilityCorrelationFromView("run-1", view);
    expect(o.run_id).toBe("run-1");
    expect(o.state_tail_event_id).toBe("ev-a");
    expect(o.memory_scope_cell_counts?.s).toBe(1);
  });
});
