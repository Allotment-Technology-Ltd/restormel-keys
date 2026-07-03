import { describe, it, expect } from "vitest";
import {
  VERIFIED_CLAIM_STATES,
  VerifiedClaimEnvelopeSchema,
  VerifiedClaimEvidenceSchema,
  VerifiedClaimJudgeSchema,
  VerifiedClaimStateSchema,
  VerifiedClaimSummarySchema,
  VerifiedClaimVersionSchema,
} from "./verified-claim.js";
import { ConnectRetrieveResponseSchema, ConnectGraphOpResponseSchema } from "./connect.js";

const fullEnvelope = {
  claim: { id: "claim:abc123", text: "Virtue is a mean between extremes." },
  state: "supported",
  evidence: [
    {
      quote: "virtue is a mean between two vices",
      offsets: [120, 154],
      source_ref: "source:nicomachean",
      source_hash: "a".repeat(64),
      match: "exact",
    },
  ],
  judge: {
    model: "gemini-2.0-flash",
    prompt_version: 1,
    confidence: 0.93,
    at: "2026-06-10T12:00:00.000Z",
  },
  citation: "Nicomachean Ethics, Book II",
  trace_ref: "/connect/v1/traces/3f6f9a3a-0000-4000-8000-000000000000",
  trust_score: 88,
};

describe("VerifiedClaimEnvelopeSchema", () => {
  it("accepts the full ADR chain (claim → state → evidence → judge → citation → trace → trust)", () => {
    expect(() => VerifiedClaimEnvelopeSchema.parse(fullEnvelope)).not.toThrow();
  });

  it("accepts the minimal honest envelope: unverified, no evidence, no judge", () => {
    const minimal = {
      claim: { id: "claim:x", text: "An unbindable claim." },
      state: "unverified",
      evidence: [],
      citation: null,
      trace_ref: null,
    };
    expect(() => VerifiedClaimEnvelopeSchema.parse(minimal)).not.toThrow();
  });

  it("covers exactly the five EBV states from the ADR", () => {
    expect(VERIFIED_CLAIM_STATES).toEqual([
      "supported",
      "inferred",
      "unverified",
      "contradicted",
      "excluded",
    ]);
    for (const state of VERIFIED_CLAIM_STATES) {
      expect(() => VerifiedClaimStateSchema.parse(state)).not.toThrow();
    }
    // The legacy verdict vocabulary is NOT a verification state on this surface.
    expect(() => VerifiedClaimStateSchema.parse("ok")).toThrow();
    expect(() => VerifiedClaimStateSchema.parse("weak")).toThrow();
  });

  it("rejects an envelope without a state", () => {
    const { state: _state, ...rest } = fullEnvelope;
    expect(() => VerifiedClaimEnvelopeSchema.parse(rest)).toThrow();
  });
});

describe("VerifiedClaimEvidenceSchema", () => {
  it("requires [start, end) integer offsets", () => {
    expect(() =>
      VerifiedClaimEvidenceSchema.parse({
        quote: "q",
        offsets: [0],
        source_ref: null,
        source_hash: null,
      }),
    ).toThrow();
    expect(() =>
      VerifiedClaimEvidenceSchema.parse({
        quote: "q",
        offsets: [-1, 4],
        source_ref: null,
        source_hash: null,
      }),
    ).toThrow();
  });

  it("labels looser-than-exact matches instead of hiding them", () => {
    expect(() =>
      VerifiedClaimEvidenceSchema.parse({
        quote: "q",
        offsets: [0, 1],
        source_ref: "source:a",
        source_hash: "h",
        match: "fuzzy",
      }),
    ).not.toThrow();
    expect(() =>
      VerifiedClaimEvidenceSchema.parse({
        quote: "q",
        offsets: [0, 1],
        source_ref: "source:a",
        source_hash: "h",
        match: "approximate",
      }),
    ).toThrow();
  });
});

describe("VerifiedClaimJudgeSchema", () => {
  it("allows null model and null confidence (judge omitted them), never out-of-range confidence", () => {
    expect(() =>
      VerifiedClaimJudgeSchema.parse({ model: null, prompt_version: 1, confidence: null, at: "2026-06-10T12:00:00Z" }),
    ).not.toThrow();
    expect(() =>
      VerifiedClaimJudgeSchema.parse({ model: "m", prompt_version: 1, confidence: 1.5, at: "2026-06-10T12:00:00Z" }),
    ).toThrow();
  });
});

describe("VerifiedClaimVersionSchema (Stage 3.3 temporal validity)", () => {
  it("accepts a current version (open validity window)", () => {
    expect(() =>
      VerifiedClaimVersionSchema.parse({
        valid_from: "2026-06-01T00:00:00.000Z",
        valid_to: null,
        superseded_by: null,
        version_no: 1,
      }),
    ).not.toThrow();
  });

  it("accepts a superseded version (closed window + forward link)", () => {
    expect(() =>
      VerifiedClaimVersionSchema.parse({
        valid_from: "2026-06-01T00:00:00.000Z",
        valid_to: "2026-06-10T00:00:00.000Z",
        superseded_by: "12345",
        version_no: 1,
      }),
    ).not.toThrow();
  });

  it("requires valid_from; valid_to/superseded_by/version_no are optional (additive)", () => {
    expect(() => VerifiedClaimVersionSchema.parse({ valid_from: "2026-06-01T00:00:00Z" })).not.toThrow();
    expect(() => VerifiedClaimVersionSchema.parse({})).toThrow();
  });

  it("the envelope carries the version block additively (pre-3.3 envelopes still valid)", () => {
    expect(() => VerifiedClaimEnvelopeSchema.parse(fullEnvelope)).not.toThrow();
    expect(() =>
      VerifiedClaimEnvelopeSchema.parse({
        ...fullEnvelope,
        version: {
          valid_from: "2026-06-01T00:00:00.000Z",
          valid_to: "2026-06-10T00:00:00.000Z",
          superseded_by: "12345",
          version_no: 2,
        },
      }),
    ).not.toThrow();
  });
});

describe("VerifiedClaimSummarySchema", () => {
  it("accepts partial per-state counts and rejects unknown states", () => {
    expect(() => VerifiedClaimSummarySchema.parse({ supported: 4, unverified: 1 })).not.toThrow();
    expect(() => VerifiedClaimSummarySchema.parse({ ok: 4 })).toThrow();
  });
});

describe("Connect v1 responses carry the envelope", () => {
  it("ConnectRetrieveResponse accepts verified_claims + verification_summary (additive)", () => {
    const response = {
      contract_version: "2026-06-01",
      request_id: "req-1",
      trace_id: "3f6f9a3a-0000-4000-8000-000000000000",
      context_block: "…",
      verified_claims: [fullEnvelope],
      metadata: {
        claims_retrieved: 1,
        arguments_retrieved: 0,
        verification_summary: { supported: 1 },
      },
    };
    expect(() => ConnectRetrieveResponseSchema.parse(response)).not.toThrow();
    // Pre-envelope responses remain valid (backward compatible).
    const { verified_claims: _vc, ...legacy } = response;
    expect(() =>
      ConnectRetrieveResponseSchema.parse({
        ...legacy,
        metadata: { claims_retrieved: 1, arguments_retrieved: 0 },
      }),
    ).not.toThrow();
  });

  it("ConnectGraphOpResponse accepts verified_claims + verification_summary (additive)", () => {
    const response = {
      contract_version: "2026-06-01",
      request_id: "req-1",
      operation: "retrieve_context",
      verified_claims: [fullEnvelope],
      trace: {
        operation: "retrieve_context",
        seed_count: 1,
        hops: 1,
        claim_count: 1,
        relation_count: 0,
        tokens_used: 10,
        nodes_dropped: 0,
      },
      metadata: { verification_summary: { supported: 1 } },
    };
    expect(() => ConnectGraphOpResponseSchema.parse(response)).not.toThrow();
  });
});
