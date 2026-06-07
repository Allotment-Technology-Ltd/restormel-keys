import { describe, expect, it } from "vitest";
import type { GraphStore } from "@restormel/graphrag-core";
import { detectEmbeddedUnits } from "./surreal-graph-units-load";

/** Fake store: reports `count` for the field named in `embeddedField`, else 0. */
function fakeStore(embeddedField: string | null, count: number): GraphStore {
  return {
    query: async <T>(sql: string): Promise<T> => {
      const match = /WHERE (\w+) IS NOT NONE/.exec(sql);
      const field = match?.[1];
      const c = field && field === embeddedField ? count : 0;
      return [{ count: c }] as unknown as T;
    },
    isDatabaseUnavailable: () => false,
  } as unknown as GraphStore;
}

describe("detectEmbeddedUnits", () => {
  it("uses the configured field when it has vectors", async () => {
    const res = await detectEmbeddedUnits(fakeStore("embedding", 42), "unit", "embedding");
    expect(res).toEqual({ field: "embedding", embedded: 42 });
  });

  it("falls back to a common alias when the configured field is empty (BYO graph)", async () => {
    // Graph stored vectors under `vector`, but the pack still says `embedding`.
    const res = await detectEmbeddedUnits(fakeStore("vector", 30000), "unit", "embedding");
    expect(res).toEqual({ field: "vector", embedded: 30000 });
  });

  it("returns 0 under the configured field when nothing matches", async () => {
    const res = await detectEmbeddedUnits(fakeStore(null, 0), "unit", "embedding");
    expect(res).toEqual({ field: "embedding", embedded: 0 });
  });

  it("sanitises an unsafe configured field name to the default", async () => {
    const res = await detectEmbeddedUnits(fakeStore("embedding", 5), "unit", "bad field!");
    expect(res).toEqual({ field: "embedding", embedded: 5 });
  });
});
