import { describe, it, expect } from "vitest";
import { isAAIFResponse, isAAIFVerifiedClaimEnvelope, isAAIFVerifiedContextInput, isAAIFVerifiedContextOutput } from "./validate.js";
import type { AAIFVerifiedClaimEnvelope } from "./types.js";

/** A minimal valid AAIFResponse envelope. */
function validResponse(): Record<string, unknown> {
  return {
    output: "Hello, world.",
    provider: "openai",
    model: "gpt-x",
    cost: 0.0012,
    routing: { reason: "cheapest model meeting the latency constraint" },
  };
}

describe("isAAIFResponse — valid envelopes", () => {
  it("accepts a minimal chat/completion response", () => {
    expect(isAAIFResponse(validResponse())).toBe(true);
  });

  it("accepts an embedding response with a numeric vector", () => {
    expect(isAAIFResponse({ ...validResponse(), output: "[...]", embedding: [0.1, 0.2, 0.3] })).toBe(true);
  });

  it("accepts an explicit outputText alias", () => {
    expect(isAAIFResponse({ ...validResponse(), outputText: "Hello, world." })).toBe(true);
  });

  it("tolerates unknown/extra fields (forward compatible — e.g. a future version tag)", () => {
    expect(isAAIFResponse({ ...validResponse(), version: "2.0", traceId: "abc" })).toBe(true);
  });
});

describe("isAAIFResponse — invalid envelopes", () => {
  it("rejects null and undefined", () => {
    expect(isAAIFResponse(null)).toBe(false);
    expect(isAAIFResponse(undefined)).toBe(false);
  });

  it("rejects non-objects", () => {
    expect(isAAIFResponse("a string")).toBe(false);
    expect(isAAIFResponse(42)).toBe(false);
    expect(isAAIFResponse(["array"])).toBe(false);
    expect(isAAIFResponse(true)).toBe(false);
  });

  it("rejects an empty object", () => {
    expect(isAAIFResponse({})).toBe(false);
  });

  it("rejects a missing or wrong-typed output", () => {
    const { output: _omit, ...noOutput } = validResponse();
    expect(isAAIFResponse(noOutput)).toBe(false);
    expect(isAAIFResponse({ ...validResponse(), output: 123 })).toBe(false);
  });

  it("rejects missing provider / model / cost", () => {
    for (const field of ["provider", "model", "cost"]) {
      const r = validResponse();
      delete r[field];
      expect(isAAIFResponse(r)).toBe(false);
    }
  });

  it("rejects a non-numeric cost", () => {
    expect(isAAIFResponse({ ...validResponse(), cost: "free" })).toBe(false);
  });

  it("rejects an embedding containing non-numbers", () => {
    expect(isAAIFResponse({ ...validResponse(), embedding: [0.1, "x", 0.3] })).toBe(false);
    expect(isAAIFResponse({ ...validResponse(), embedding: "not-an-array" })).toBe(false);
  });

  it("rejects a missing or malformed routing block", () => {
    const { routing: _r, ...noRouting } = validResponse();
    expect(isAAIFResponse(noRouting)).toBe(false);
    expect(isAAIFResponse({ ...validResponse(), routing: null })).toBe(false);
    expect(isAAIFResponse({ ...validResponse(), routing: {} })).toBe(false); // missing reason
    expect(isAAIFResponse({ ...validResponse(), routing: { reason: 5 } })).toBe(false);
  });

  it("rejects a wrong-typed outputText alias", () => {
    expect(isAAIFResponse({ ...validResponse(), outputText: 7 })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Verified-context validation (Stage 4.3)
// ---------------------------------------------------------------------------

/** A minimal valid AAIFVerifiedClaimEnvelope. */
function validEnvelope(): AAIFVerifiedClaimEnvelope {
  return {
    claim: { id: "unit:abc123", text: "Restormel Keys validates every claim." },
    state: "supported",
    evidence: [
      {
        quote: "Restormel Keys validates every claim",
        offsets: [0, 38],
        source_ref: "source:doc1",
        source_hash: "abc123def456abc123def456abc123def456abc123def456abc123def456abc1",
        match: "exact",
      },
    ],
    judge: {
      model: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
      prompt_version: 1,
      confidence: 0.95,
      at: "2026-06-10T12:00:00Z",
    },
    citation: "Restormel Keys documentation",
    trace_ref: "/connect/v1/traces/trace-xyz",
    trust_score: 92,
  };
}

describe("isAAIFVerifiedClaimEnvelope — valid", () => {
  it("accepts a fully-specified envelope", () => {
    expect(isAAIFVerifiedClaimEnvelope(validEnvelope())).toBe(true);
  });

  it("accepts an envelope with empty evidence (inferred state)", () => {
    expect(
      isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), state: "inferred", evidence: [] }),
    ).toBe(true);
  });

  it("accepts an envelope without judge (Layer 2 not run)", () => {
    const { judge: _j, ...noJudge } = validEnvelope();
    expect(isAAIFVerifiedClaimEnvelope(noJudge)).toBe(true);
  });

  it("accepts null citation and trace_ref", () => {
    expect(
      isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), citation: null, trace_ref: null }),
    ).toBe(true);
  });

  it("accepts undefined trust_score", () => {
    const { trust_score: _ts, ...noTs } = validEnvelope();
    expect(isAAIFVerifiedClaimEnvelope(noTs)).toBe(true);
  });

  it("accepts null trust_score", () => {
    expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), trust_score: null })).toBe(true);
  });

  it("accepts all valid states", () => {
    for (const state of ["supported", "inferred", "unverified", "contradicted", "excluded"] as const) {
      expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), state })).toBe(true);
    }
  });

  it("accepts all valid evidence match values", () => {
    for (const match of ["exact", "normalized", "fuzzy"] as const) {
      const env = validEnvelope();
      env.evidence[0].match = match;
      expect(isAAIFVerifiedClaimEnvelope(env)).toBe(true);
    }
  });

  it("accepts evidence with null match", () => {
    const env = validEnvelope();
    env.evidence[0].match = null;
    expect(isAAIFVerifiedClaimEnvelope(env)).toBe(true);
  });

  it("accepts evidence with null source_ref and source_hash", () => {
    const env = validEnvelope();
    env.evidence[0].source_ref = null;
    env.evidence[0].source_hash = null;
    expect(isAAIFVerifiedClaimEnvelope(env)).toBe(true);
  });

  it("accepts judge with null model and null confidence", () => {
    expect(
      isAAIFVerifiedClaimEnvelope({
        ...validEnvelope(),
        judge: { model: null, prompt_version: 1, confidence: null, at: "2026-06-10T12:00:00Z" },
      }),
    ).toBe(true);
  });
});

describe("isAAIFVerifiedClaimEnvelope — invalid", () => {
  it("rejects null, undefined, non-objects", () => {
    expect(isAAIFVerifiedClaimEnvelope(null)).toBe(false);
    expect(isAAIFVerifiedClaimEnvelope(undefined)).toBe(false);
    expect(isAAIFVerifiedClaimEnvelope("string")).toBe(false);
    expect(isAAIFVerifiedClaimEnvelope(42)).toBe(false);
  });

  it("rejects missing claim id or text", () => {
    expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), claim: { id: "x" } })).toBe(false);
    expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), claim: { text: "x" } })).toBe(false);
  });

  it("rejects invalid state", () => {
    expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), state: "ok" })).toBe(false);
    expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), state: 123 })).toBe(false);
  });

  it("rejects non-array evidence", () => {
    expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), evidence: "bad" })).toBe(false);
  });

  it("rejects evidence span with non-string quote", () => {
    const env = validEnvelope();
    (env.evidence[0] as Record<string, unknown>).quote = 42;
    expect(isAAIFVerifiedClaimEnvelope(env)).toBe(false);
  });

  it("rejects evidence span with wrong-shaped offsets", () => {
    const env = validEnvelope();
    (env.evidence[0] as Record<string, unknown>).offsets = [0];
    expect(isAAIFVerifiedClaimEnvelope(env)).toBe(false);
  });

  it("rejects evidence span with invalid match value", () => {
    const env = validEnvelope();
    (env.evidence[0] as Record<string, unknown>).match = "approximated";
    expect(isAAIFVerifiedClaimEnvelope(env)).toBe(false);
  });

  it("rejects non-string citation (not null)", () => {
    expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), citation: 99 })).toBe(false);
  });

  it("rejects non-string trace_ref (not null)", () => {
    expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), trace_ref: true })).toBe(false);
  });

  it("rejects non-numeric trust_score (not null/undefined)", () => {
    expect(isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), trust_score: "high" })).toBe(false);
  });

  it("rejects malformed judge block", () => {
    expect(
      isAAIFVerifiedClaimEnvelope({ ...validEnvelope(), judge: { model: "x" } }),
    ).toBe(false); // missing prompt_version, at
  });
});

describe("isAAIFVerifiedContextInput", () => {
  it("accepts a minimal valid input block", () => {
    expect(isAAIFVerifiedContextInput({ claims: [validEnvelope()] })).toBe(true);
  });

  it("accepts empty claims array", () => {
    expect(isAAIFVerifiedContextInput({ claims: [] })).toBe(true);
  });

  it("accepts a retrieval_trace_ref", () => {
    expect(
      isAAIFVerifiedContextInput({ claims: [], retrieval_trace_ref: "/connect/v1/traces/x" }),
    ).toBe(true);
  });

  it("accepts null retrieval_trace_ref", () => {
    expect(isAAIFVerifiedContextInput({ claims: [], retrieval_trace_ref: null })).toBe(true);
  });

  it("rejects missing claims field", () => {
    expect(isAAIFVerifiedContextInput({ retrieval_trace_ref: null })).toBe(false);
  });

  it("rejects non-array claims", () => {
    expect(isAAIFVerifiedContextInput({ claims: "not-array" })).toBe(false);
  });

  it("rejects invalid envelope inside claims", () => {
    expect(isAAIFVerifiedContextInput({ claims: [{ claim: { id: "x" } }] })).toBe(false);
  });

  it("rejects non-string retrieval_trace_ref (not null)", () => {
    expect(isAAIFVerifiedContextInput({ claims: [], retrieval_trace_ref: 123 })).toBe(false);
  });
});

describe("isAAIFVerifiedContextOutput", () => {
  it("accepts a valid output block with summary", () => {
    expect(
      isAAIFVerifiedContextOutput({
        claims: [validEnvelope()],
        summary: { supported: 1 },
      }),
    ).toBe(true);
  });

  it("accepts without summary", () => {
    expect(isAAIFVerifiedContextOutput({ claims: [validEnvelope()] })).toBe(true);
  });

  it("accepts empty summary object", () => {
    expect(isAAIFVerifiedContextOutput({ claims: [], summary: {} })).toBe(true);
  });

  it("rejects summary with invalid state key", () => {
    expect(isAAIFVerifiedContextOutput({ claims: [], summary: { ok: 1 } })).toBe(false);
  });

  it("rejects summary with non-numeric count", () => {
    expect(isAAIFVerifiedContextOutput({ claims: [], summary: { supported: "many" } })).toBe(false);
  });

  it("rejects missing claims", () => {
    expect(isAAIFVerifiedContextOutput({ summary: { supported: 1 } })).toBe(false);
  });
});

describe("isAAIFResponse — verifiedContext field (Stage 4.3)", () => {
  function validResponse(): Record<string, unknown> {
    return {
      output: "Hello, world.",
      provider: "openai",
      model: "gpt-x",
      cost: 0.0012,
      routing: { reason: "cheapest" },
    };
  }

  it("accepts a response with a valid verifiedContext output block", () => {
    expect(
      isAAIFResponse({
        ...validResponse(),
        verifiedContext: {
          claims: [validEnvelope()],
          summary: { supported: 1 },
        },
      }),
    ).toBe(true);
  });

  it("accepts a response without verifiedContext (backward compat)", () => {
    expect(isAAIFResponse(validResponse())).toBe(true);
  });

  it("rejects a response with malformed verifiedContext", () => {
    expect(
      isAAIFResponse({ ...validResponse(), verifiedContext: { claims: "bad" } }),
    ).toBe(false);
  });
});
