import { describe, it, expect } from "vitest";
import type { AAIFVerifiedClaimEnvelope, AAIFResponse } from "./types.js";
import {
  summariseVerifiedClaims,
  filterClaimsByState,
  allClaimsSupported,
  hasContradictedClaims,
  buildVerifiedContextInput,
  buildVerifiedContextOutput,
  getRequestVerifiedContext,
  getResponseVerifiedContext,
  getSupportedClaims,
} from "./verified-context.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEnvelope(
  id: string,
  state: AAIFVerifiedClaimEnvelope["state"],
): AAIFVerifiedClaimEnvelope {
  return {
    claim: { id, text: `Claim text for ${id}` },
    state,
    evidence: [],
    citation: null,
    trace_ref: null,
  };
}

const supported1 = makeEnvelope("unit:1", "supported");
const supported2 = makeEnvelope("unit:2", "supported");
const inferred1 = makeEnvelope("unit:3", "inferred");
const unverified1 = makeEnvelope("unit:4", "unverified");
const contradicted1 = makeEnvelope("unit:5", "contradicted");
const excluded1 = makeEnvelope("unit:6", "excluded");

// ---------------------------------------------------------------------------
// summariseVerifiedClaims
// ---------------------------------------------------------------------------

describe("summariseVerifiedClaims", () => {
  it("returns empty object for empty array", () => {
    expect(summariseVerifiedClaims([])).toEqual({});
  });

  it("counts each state correctly", () => {
    const claims = [supported1, supported2, inferred1, unverified1];
    expect(summariseVerifiedClaims(claims)).toEqual({
      supported: 2,
      inferred: 1,
      unverified: 1,
    });
  });

  it("handles a single state", () => {
    expect(summariseVerifiedClaims([supported1])).toEqual({ supported: 1 });
  });

  it("handles all five states", () => {
    const all = [supported1, inferred1, unverified1, contradicted1, excluded1];
    const summary = summariseVerifiedClaims(all);
    expect(summary.supported).toBe(1);
    expect(summary.inferred).toBe(1);
    expect(summary.unverified).toBe(1);
    expect(summary.contradicted).toBe(1);
    expect(summary.excluded).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// filterClaimsByState
// ---------------------------------------------------------------------------

describe("filterClaimsByState", () => {
  const ctx = { claims: [supported1, supported2, inferred1, contradicted1], retrieval_trace_ref: null };

  it("filters to supported only", () => {
    const result = filterClaimsByState(ctx, "supported");
    expect(result).toHaveLength(2);
    expect(result.every((c) => c.state === "supported")).toBe(true);
  });

  it("returns empty for a state that has no claims", () => {
    expect(filterClaimsByState(ctx, "excluded")).toHaveLength(0);
  });

  it("returns empty for null/undefined ctx", () => {
    expect(filterClaimsByState(null, "supported")).toHaveLength(0);
    expect(filterClaimsByState(undefined, "supported")).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// allClaimsSupported
// ---------------------------------------------------------------------------

describe("allClaimsSupported", () => {
  it("returns true when all claims are supported", () => {
    expect(allClaimsSupported({ claims: [supported1, supported2] })).toBe(true);
  });

  it("returns false when any claim is not supported", () => {
    expect(allClaimsSupported({ claims: [supported1, inferred1] })).toBe(false);
  });

  it("returns false for empty claims array", () => {
    expect(allClaimsSupported({ claims: [] })).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(allClaimsSupported(null)).toBe(false);
    expect(allClaimsSupported(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// hasContradictedClaims
// ---------------------------------------------------------------------------

describe("hasContradictedClaims", () => {
  it("returns true when any claim is contradicted", () => {
    expect(hasContradictedClaims({ claims: [supported1, contradicted1] })).toBe(true);
  });

  it("returns false when no claim is contradicted", () => {
    expect(hasContradictedClaims({ claims: [supported1, inferred1] })).toBe(false);
  });

  it("returns false for empty claims", () => {
    expect(hasContradictedClaims({ claims: [] })).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(hasContradictedClaims(null)).toBe(false);
    expect(hasContradictedClaims(undefined)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildVerifiedContextInput
// ---------------------------------------------------------------------------

describe("buildVerifiedContextInput", () => {
  it("builds a valid input block without trace ref", () => {
    const ctx = buildVerifiedContextInput([supported1]);
    expect(ctx.claims).toEqual([supported1]);
    expect(ctx.retrieval_trace_ref).toBeUndefined();
  });

  it("builds a valid input block with trace ref", () => {
    const ctx = buildVerifiedContextInput([supported1], "/connect/v1/traces/abc");
    expect(ctx.retrieval_trace_ref).toBe("/connect/v1/traces/abc");
  });

  it("handles null trace ref — omits the field", () => {
    const ctx = buildVerifiedContextInput([supported1], null);
    expect(ctx.retrieval_trace_ref).toBeUndefined();
  });

  it("handles empty claims array", () => {
    const ctx = buildVerifiedContextInput([]);
    expect(ctx.claims).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// buildVerifiedContextOutput
// ---------------------------------------------------------------------------

describe("buildVerifiedContextOutput", () => {
  it("builds an output block with auto-computed summary", () => {
    const ctx = buildVerifiedContextOutput([supported1, supported2, inferred1]);
    expect(ctx.claims).toHaveLength(3);
    expect(ctx.summary?.supported).toBe(2);
    expect(ctx.summary?.inferred).toBe(1);
  });

  it("includes retrieval_trace_ref when provided", () => {
    const ctx = buildVerifiedContextOutput([supported1], "/connect/v1/traces/xyz");
    expect(ctx.retrieval_trace_ref).toBe("/connect/v1/traces/xyz");
  });

  it("omits retrieval_trace_ref when null", () => {
    const ctx = buildVerifiedContextOutput([supported1], null);
    expect(ctx.retrieval_trace_ref).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

describe("getRequestVerifiedContext", () => {
  it("returns undefined when no verifiedContext on request", () => {
    const req = { input: "hello" };
    expect(getRequestVerifiedContext(req)).toBeUndefined();
  });

  it("returns the verifiedContext block when present", () => {
    const ctx = buildVerifiedContextInput([supported1]);
    const req = { input: "hello", verifiedContext: ctx };
    expect(getRequestVerifiedContext(req)).toBe(ctx);
  });
});

describe("getResponseVerifiedContext", () => {
  const baseResponse: AAIFResponse = {
    output: "result",
    provider: "openai",
    model: "gpt-4o-mini",
    cost: 0.001,
    routing: { reason: "cheapest" },
  };

  it("returns undefined when no verifiedContext on response", () => {
    expect(getResponseVerifiedContext(baseResponse)).toBeUndefined();
  });

  it("returns the verifiedContext block when present", () => {
    const ctx = buildVerifiedContextOutput([supported1]);
    const res: AAIFResponse = { ...baseResponse, verifiedContext: ctx };
    expect(getResponseVerifiedContext(res)).toBe(ctx);
  });
});

describe("getSupportedClaims", () => {
  const baseResponse: AAIFResponse = {
    output: "result",
    provider: "openai",
    model: "gpt-4o-mini",
    cost: 0.001,
    routing: { reason: "cheapest" },
  };

  it("returns empty array when no verifiedContext", () => {
    expect(getSupportedClaims(baseResponse)).toHaveLength(0);
  });

  it("returns only supported claims", () => {
    const ctx = buildVerifiedContextOutput([supported1, inferred1, unverified1]);
    const res: AAIFResponse = { ...baseResponse, verifiedContext: ctx };
    const result = getSupportedClaims(res);
    expect(result).toHaveLength(1);
    expect(result[0].claim.id).toBe("unit:1");
  });
});
