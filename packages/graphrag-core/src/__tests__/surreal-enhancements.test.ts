import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchBm25ClaimCandidates,
  fetchNativeGraphNeighbors,
  type GraphStore,
} from "../index.js";

/** Captures the SQL a single store.query receives. */
function recordingStore(rows: unknown[] = []): { store: GraphStore; sql: () => string } {
  let captured = "";
  const store: GraphStore = {
    async query<T>(sql: string): Promise<T> {
      captured = sql;
      return rows as unknown as T;
    },
    isDatabaseUnavailable() {
      return false;
    },
  };
  return { store, sql: () => captured };
}

describe("surreal-retrieval-enhancements parameterization", () => {
  const prev = process.env.RETRIEVAL_NATIVE_GRAPH;
  afterEach(() => {
    process.env.RETRIEVAL_NATIVE_GRAPH = prev;
    vi.restoreAllMocks();
  });

  it("BM25 candidate fetch targets the configured unit table", async () => {
    const { store, sql } = recordingStore([]);
    await fetchBm25ClaimCandidates(store, {
      terms: ["epistemic"],
      limit: 10,
      reviewFilter: "review_state = 'accepted'",
      unitTable: "statement_v2",
    });
    expect(sql()).toContain("FROM statement_v2");
    expect(sql()).not.toContain("FROM claim");
  });

  it("native graph neighbours traverse the configured edges + unit table", async () => {
    process.env.RETRIEVAL_NATIVE_GRAPH = "1";
    const { store, sql } = recordingStore([]);
    await fetchNativeGraphNeighbors(store, {
      seedIds: ["statement_v2:1"],
      limit: 16,
      unitTable: "statement_v2",
      relationEdges: ["cites", "overrules"],
    });
    const q = sql();
    expect(q).toContain("FROM statement_v2");
    expect(q).toContain("->cites->statement_v2");
    expect(q).toContain("<-overrules<-statement_v2");
    expect(q).not.toContain("->depends_on->claim");
  });
});
