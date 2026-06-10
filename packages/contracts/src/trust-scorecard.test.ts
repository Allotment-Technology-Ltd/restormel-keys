import { describe, it, expect } from "vitest";
import {
  CONNECT_TRUST_SCORECARD_SCHEMA_VERSION,
  ConnectTrustScorecardResponseSchema,
  ConnectTrustScorecardSchema,
  TrustScorecardCoverageSchema,
  TrustScorecardEvidenceSchema,
  TrustScorecardFactorSchema,
} from "./trust-scorecard.js";
import { CONNECT_API_CONTRACT_VERSION } from "./connect.js";

const fullScorecard = {
  schema_version: CONNECT_TRUST_SCORECARD_SCHEMA_VERSION,
  generated_at: "2026-06-10T12:00:00.000Z",
  store: "surreal",
  units: 240,
  relations: 512,
  trust_score: 82,
  trust_formula:
    "100 × weighted sum: embedding coverage (25%), verification coverage (25%), low orphan rate (15%), vector index OK (15%), relation balance (10%), minus high-severity issue density (10%)",
  score_factors: [
    { id: "embedding_coverage", label: "Embedding coverage", max_points: 25, points: 24.5 },
    { id: "verification_coverage", label: "Verification coverage", max_points: 25, points: 21 },
    { id: "orphan_rate", label: "Low orphan rate", max_points: 15, points: 15 },
    { id: "vector_index", label: "Vector index", max_points: 15, points: 15 },
    { id: "relation_health", label: "Relation balance", max_points: 10, points: 4 },
    { id: "issue_penalty", label: "High-severity issue density", max_points: 10, points: 10 },
  ],
  g2: { ok: 218, weak: 14, unsupported: 4, ok_pct: 92, unsupported_pct: 2 },
  targets: { ok_pct_min: 90, unsupported_pct_max: 2 },
  embedding: { embedded: 236, units: 240, pct: 98 },
  evidence: { bound: 210, unbound: 22, no_evidence: 8, bound_pct: 88 },
  verification_states: { supported: 198, inferred: 22, unverified: 14, contradicted: 2, excluded: 4 },
  coverage: { validator_gaps: 3, remediation_drops: 4 },
  last_verified_at: "2026-06-09T18:30:00.000Z",
};

describe("ConnectTrustScorecardSchema", () => {
  it("accepts a fully populated scorecard", () => {
    expect(() => ConnectTrustScorecardSchema.parse(fullScorecard)).not.toThrow();
  });

  it("accepts the honest-unknowns shape: null coverage counts and null last_verified_at", () => {
    expect(() =>
      ConnectTrustScorecardSchema.parse({
        ...fullScorecard,
        coverage: { validator_gaps: null, remediation_drops: null },
        last_verified_at: null,
        verification_states: {},
      }),
    ).not.toThrow();
  });

  it("rejects an unknown schema version (breaking-change guard)", () => {
    expect(() =>
      ConnectTrustScorecardSchema.parse({ ...fullScorecard, schema_version: "2.0" }),
    ).toThrow();
  });

  it("rejects out-of-range scores and percentages", () => {
    expect(() => ConnectTrustScorecardSchema.parse({ ...fullScorecard, trust_score: 101 })).toThrow();
    expect(() =>
      ConnectTrustScorecardSchema.parse({
        ...fullScorecard,
        evidence: { ...fullScorecard.evidence, bound_pct: 140 },
      }),
    ).toThrow();
  });

  it("rejects unknown verification states (reuses the verified-claim state vocabulary)", () => {
    expect(() =>
      ConnectTrustScorecardSchema.parse({
        ...fullScorecard,
        verification_states: { validated: 10 },
      }),
    ).toThrow();
  });

  it("rejects unknown factor ids (mirrors the connect-core formula factors)", () => {
    expect(() =>
      TrustScorecardFactorSchema.parse({ id: "vibes", label: "Vibes", max_points: 10, points: 10 }),
    ).toThrow();
  });
});

describe("TrustScorecardEvidenceSchema / TrustScorecardCoverageSchema", () => {
  it("requires integer non-negative evidence counts", () => {
    expect(() =>
      TrustScorecardEvidenceSchema.parse({ bound: -1, unbound: 0, no_evidence: 0, bound_pct: 0 }),
    ).toThrow();
    expect(() =>
      TrustScorecardEvidenceSchema.parse({ bound: 1.5, unbound: 0, no_evidence: 0, bound_pct: 0 }),
    ).toThrow();
  });

  it("allows null (unknown) but not negative coverage counts", () => {
    expect(() =>
      TrustScorecardCoverageSchema.parse({ validator_gaps: null, remediation_drops: 0 }),
    ).not.toThrow();
    expect(() =>
      TrustScorecardCoverageSchema.parse({ validator_gaps: -2, remediation_drops: 0 }),
    ).toThrow();
  });
});

describe("ConnectTrustScorecardResponseSchema", () => {
  it("wraps the scorecard in the versioned connect v1 envelope", () => {
    expect(() =>
      ConnectTrustScorecardResponseSchema.parse({
        contract_version: CONNECT_API_CONTRACT_VERSION,
        scorecard: fullScorecard,
      }),
    ).not.toThrow();
  });

  it("allows a null scorecard for a graph with no units yet", () => {
    expect(() =>
      ConnectTrustScorecardResponseSchema.parse({
        contract_version: CONNECT_API_CONTRACT_VERSION,
        scorecard: null,
      }),
    ).not.toThrow();
  });

  it("rejects a stale contract version", () => {
    expect(() =>
      ConnectTrustScorecardResponseSchema.parse({
        contract_version: "2024-01-01",
        scorecard: null,
      }),
    ).toThrow();
  });
});
