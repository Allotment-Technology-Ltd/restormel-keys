import { describe, expect, it, vi } from "vitest";
import type { GraphStore } from "@restormel/graphrag-core";
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { PHILOSOPHY_DOMAIN_PACK } from "@restormel/contracts/connect";
import {
  loadSurrealProvenanceAggregateCounts,
  resolveSurrealUnitTableForProvenance,
} from "./graph-surreal-provenance-counts";

function mockStore(handlers: Array<{ match: RegExp; count: number | null }>): GraphStore {
  return {
    query: vi.fn(async (sql: string) => {
      for (const { match, count } of handlers) {
        if (match.test(sql)) {
          if (count == null) throw new Error("query failed");
          return [{ count }];
        }
      }
      throw new Error(`unexpected query: ${sql}`);
    }),
  } as unknown as GraphStore;
}

describe("resolveSurrealUnitTableForProvenance", () => {
  it("prefers the table whose count matches cached stats", async () => {
    const store = mockStore([
      { match: /FROM idea GROUP ALL/, count: 0 },
      { match: /FROM claim GROUP ALL/, count: 34_000 },
    ]);
    const pack = {
      ...PHILOSOPHY_DOMAIN_PACK,
      graph_schema: { ...PHILOSOPHY_DOMAIN_PACK.graph_schema, unit_table: "idea" },
    } as ConnectDomainPack;
    const resolved = await resolveSurrealUnitTableForProvenance(store, pack, {
      totalUnitsHint: 34_000,
    });
    expect(resolved.unitTable).toBe("claim");
    expect(resolved.totalUnits).toBe(34_000);
  });
});

describe("loadSurrealProvenanceAggregateCounts", () => {
  it("derives unlinked from graph-linked when the unlinked aggregate fails", async () => {
    const store = mockStore([
      { match: /FROM claim GROUP ALL;$/, count: 100 },
      { match: /source IS NONE/, count: null },
      { match: /source = NONE/, count: null },
      { match: /source IS NOT NONE AND source\.source_kind = 'legacy'/, count: 2 },
      { match: /source IS NOT NONE GROUP ALL/, count: 97 },
    ]);
    const counts = await loadSurrealProvenanceAggregateCounts(store, "claim");
    expect(counts.aggregatesOk).toBe(true);
    expect(counts.graphLinked).toBe(97);
    expect(counts.unlinked).toBe(1);
    expect(counts.needsEdgeRepair).toBe(3);
  });

  it("reports native provenance when no ideas lack a source edge", async () => {
    const store = mockStore([
      { match: /FROM claim GROUP ALL;$/, count: 50 },
      { match: /source IS NONE/, count: 0 },
      { match: /source IS NOT NONE AND source\.source_kind = 'legacy'/, count: 0 },
      { match: /source IS NOT NONE GROUP ALL/, count: 50 },
    ]);
    const counts = await loadSurrealProvenanceAggregateCounts(store, "claim");
    expect(counts.needsEdgeRepair).toBe(0);
    expect(counts.graphLinked).toBe(50);
  });
});
