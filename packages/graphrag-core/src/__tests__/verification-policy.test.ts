import { describe, expect, it } from "vitest";
import {
  retrieveContext,
  buildContextBlock,
  type GraphRagDeps,
  type GraphStore,
} from "../index.js";

/**
 * Phase 2 — verification-aware retrieval. Proves the per-query verificationPolicy:
 *  (a) defaults to supported-only,
 *  (b) returns weak claims (annotated) when opted in,
 *  (c) respects the minTrustScore floor,
 *  (d) reports accurate verification_summary counts.
 */

const seed = (
  id: string,
  verification_state: string | null,
  trust_score: number,
  claim_type: string,
  embedding: number[]
) => ({
  id,
  text: `claim ${id}`,
  claim_type,
  domain: "ethics",
  confidence: 0.9,
  embedding,
  position_in_source: 0,
  review_state: undefined,
  verification_state,
  trust_score,
  section_context: null,
  source_id: `source:${id}`,
  source_url: null,
  source_source_type: null,
  source_title: `Source ${id}`,
  source_author: ["A. Author"],
});

/** In-memory store with three mixed-trust seeds; no edges. */
function makeStore(): GraphStore {
  return {
    async query<T>(sql: string): Promise<T> {
      const out = (rows: unknown[]): T => rows as unknown as T;
      if (sql.includes("count() AS count")) return out([{ count: 0 }]);
      if (sql.includes("FROM passage WHERE source")) return out([{ id: "passage:1" }]);
      if (sql.includes("WHERE embedding <")) {
        return out([
          seed("sup", "validated", 90, "thesis", [1, 0, 0]),
          seed("weak", null, 50, "premise", [0.8, 0.2, 0]),
          seed("flag", "flagged", 30, "premise", [0.1, 0.9, 0]),
        ]);
      }
      return out([]); // edges, relations, arguments: none
    },
    isDatabaseUnavailable() {
      return false;
    },
  };
}

const deps = (): GraphRagDeps => ({
  store: makeStore(),
  embedder: { embedQuery: async () => [1, 0, 0] },
  resolveOriginBucket: () => "other",
});

describe("verificationPolicy", () => {
  it("(a) defaults to supported-only, excluding weak and flagged", async () => {
    const result = await retrieveContext("q", deps(), { topK: 5 });
    expect(result.claims.map((c) => c.id)).toEqual(["sup"]);
    expect(result.claims.every((c) => c.verification_category === "supported")).toBe(true);
  });

  it("(b) returns weak claims, annotated, when explicitly included", async () => {
    const result = await retrieveContext("q", deps(), {
      topK: 5,
      verificationPolicy: { include: ["supported", "weak"] },
    });
    const ids = result.claims.map((c) => c.id).sort();
    expect(ids).toEqual(["sup", "weak"]);
    expect(result.claims.some((c) => c.verification_category === "weak")).toBe(true);
    // flagged still excluded by default excludeFlagged
    expect(result.claims.some((c) => c.id === "flag")).toBe(false);

    const block = buildContextBlock(result);
    expect(block).toContain("[weak");
    expect(block).toContain("[supported");
  });

  it("(c) respects the minTrustScore floor", async () => {
    const result = await retrieveContext("q", deps(), {
      topK: 5,
      verificationPolicy: { include: ["supported", "weak"], minTrustScore: 60 },
    });
    // weak seed has trust 50 < 60 -> dropped; supported (90) kept
    expect(result.claims.map((c) => c.id)).toEqual(["sup"]);
    expect(result.claims.every((c) => (c.trust_score ?? 0) >= 60)).toBe(true);
  });

  it("(d) reports accurate verification_summary counts", async () => {
    const result = await retrieveContext("q", deps(), { topK: 5 });
    const summary = result.trace?.verification_summary;
    expect(summary).toBeDefined();
    expect(summary?.policy.include).toEqual(["supported"]);
    expect(summary?.policy.exclude_flagged).toBe(true);
    expect(summary?.included).toEqual({ supported: 1, weak: 0, unsupported: 0 });
    expect(summary?.excluded).toEqual({ supported: 0, weak: 1, unsupported: 1 });
  });

  it("includes flagged only when excludeFlagged is false and unsupported is requested", async () => {
    const result = await retrieveContext("q", deps(), {
      topK: 5,
      verificationPolicy: {
        include: ["supported", "weak", "unsupported"],
        excludeFlagged: false,
      },
    });
    expect(result.claims.map((c) => c.id).sort()).toEqual(["flag", "sup", "weak"]);
    expect(result.claims.find((c) => c.id === "flag")?.verification_category).toBe("unsupported");
  });
});
