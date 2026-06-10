/**
 * Verified-claim envelope tests (Stage 1.1) — composition is pure, fetching is stubbed.
 * The fail-safe property under test: enrichment can only demote (legacy-affirmed claims
 * without a bound span are at best `inferred`), and unverified/excluded units are always
 * flagged by state, never silently blended.
 */
import { describe, it, expect } from "vitest";
import type { GraphStore } from "@restormel/graphrag-core";
import { VerifiedClaimEnvelopeSchema } from "@restormel/contracts";
import {
  bindingFromEvidenceRow,
  buildVerifiedClaims,
  composeVerifiedClaims,
  fetchVerifiedClaimEnrichment,
  toEnvelopeState,
  type ClaimEvidenceRow,
  type ClaimJudgmentRow,
} from "./verified-claims";

const vocabulary = {
  supportedStates: ["validated", "supported"],
  flaggedStates: ["flagged", "contradicted", "excluded"],
};

const boundRow: ClaimEvidenceRow = {
  id: "claim:a",
  evidence_quote: "virtue is a mean",
  evidence_start: 10,
  evidence_end: 26,
  evidence_match: "exact",
  evidence_status: "bound",
  evidence_source_hash: "h".repeat(64),
  source_ref: "source:ethics",
};

const claim = (id: string, verification_state: string | null) => ({
  id,
  text: `text for ${id}`,
  source_title: "Nicomachean Ethics",
  verification_state,
  trust_score: 80,
});

describe("bindingFromEvidenceRow", () => {
  it("reconstructs a bound span from persisted evidence fields", () => {
    const binding = bindingFromEvidenceRow(boundRow);
    expect(binding.status).toBe("bound");
    if (binding.status === "bound") {
      expect(binding.span.quote).toBe("virtue is a mean");
      expect(binding.span.start).toBe(10);
      expect(binding.span.end).toBe(26);
      expect(binding.span.match).toBe("exact");
    }
  });

  it("treats a missing row or incomplete fields as unbound (never bound by default)", () => {
    expect(bindingFromEvidenceRow(undefined).status).toBe("unbound");
    expect(bindingFromEvidenceRow({ id: "claim:a", evidence_status: "bound" }).status).toBe("unbound");
    expect(bindingFromEvidenceRow({ id: "claim:a", evidence_status: "no_evidence" }).status).toBe(
      "no_evidence",
    );
  });
});

describe("toEnvelopeState", () => {
  it("passes EBV states through verbatim", () => {
    for (const state of ["supported", "inferred", "unverified", "contradicted", "excluded"]) {
      expect(
        toEnvelopeState({
          rawState: state,
          binding: { status: "unbound", reason: "quote_not_found" },
          vocabulary,
        }),
      ).toBe(state);
    }
  });

  it("legacy-affirmed claims without a bound span are inferred, never supported", () => {
    expect(
      toEnvelopeState({
        rawState: "validated",
        binding: { status: "unbound", reason: "quote_not_found" },
        vocabulary,
      }),
    ).toBe("inferred");
    expect(
      toEnvelopeState({
        rawState: "validated",
        binding: bindingFromEvidenceRow(boundRow),
        vocabulary,
      }),
    ).toBe("supported");
  });

  it("flagged and unknown legacy states are unverified (reviewable), never blended", () => {
    expect(
      toEnvelopeState({
        rawState: "flagged",
        binding: bindingFromEvidenceRow(boundRow),
        vocabulary,
      }),
    ).toBe("unverified");
    expect(
      toEnvelopeState({
        rawState: null,
        binding: bindingFromEvidenceRow(boundRow),
        vocabulary,
      }),
    ).toBe("unverified");
    expect(
      toEnvelopeState({
        rawState: "something_custom",
        binding: { status: "unbound", reason: "quote_not_found" },
        vocabulary,
      }),
    ).toBe("unverified");
  });
});

describe("composeVerifiedClaims", () => {
  it("builds the full ADR chain for a supported claim", () => {
    const judgment: ClaimJudgmentRow = {
      unit: "claim:a",
      verdict: "entailed",
      confidence: 0.92,
      judge_model: "gemini-2.0-flash",
      prompt_version: 1,
      judged_at: "2026-06-10T12:00:00.000Z",
    };
    const { envelopes, summary } = composeVerifiedClaims({
      claims: [claim("claim:a", "supported")],
      evidence: new Map([["claim:a", boundRow]]),
      judgments: new Map([["claim:a", judgment]]),
      vocabulary,
      traceId: "trace-1",
    });
    expect(envelopes).toHaveLength(1);
    const env = envelopes[0];
    expect(() => VerifiedClaimEnvelopeSchema.parse(env)).not.toThrow();
    expect(env.state).toBe("supported");
    expect(env.evidence).toEqual([
      {
        quote: "virtue is a mean",
        offsets: [10, 26],
        source_ref: "source:ethics",
        source_hash: "h".repeat(64),
        match: "exact",
      },
    ]);
    expect(env.judge).toEqual({
      model: "gemini-2.0-flash",
      prompt_version: 1,
      confidence: 0.92,
      at: "2026-06-10T12:00:00.000Z",
    });
    expect(env.citation).toBe("Nicomachean Ethics");
    expect(env.trace_ref).toBe("/connect/v1/traces/trace-1");
    expect(env.trust_score).toBe(80);
    expect(summary).toEqual({ supported: 1 });
  });

  it("flags unverified and excluded units in envelopes and summary", () => {
    const { envelopes, summary } = composeVerifiedClaims({
      claims: [
        claim("claim:a", "supported"),
        claim("claim:b", "unverified"),
        claim("claim:c", "excluded"),
      ],
      evidence: new Map([["claim:a", boundRow]]),
      judgments: new Map(),
      vocabulary,
    });
    expect(envelopes.map((e) => e.state)).toEqual(["supported", "unverified", "excluded"]);
    expect(summary).toEqual({ supported: 1, unverified: 1, excluded: 1 });
    // No trace persisted → honest null link, not a fabricated one.
    expect(envelopes[0].trace_ref).toBeNull();
    // No judgment rows → judge attribution omitted, never invented.
    expect(envelopes[0].judge).toBeUndefined();
  });

  it("clamps out-of-range judge confidence and defaults a missing prompt version", () => {
    const { envelopes } = composeVerifiedClaims({
      claims: [claim("claim:a", "supported")],
      evidence: new Map([["claim:a", boundRow]]),
      judgments: new Map([
        ["claim:a", { unit: "claim:a", confidence: 3.2, judged_at: "2026-06-10T12:00:00Z" }],
      ]),
      vocabulary,
    });
    expect(envelopes[0].judge).toEqual({
      model: null,
      prompt_version: 1,
      confidence: 1,
      at: "2026-06-10T12:00:00Z",
    });
  });
});

function stubStore(handler: (sql: string) => unknown): GraphStore {
  return {
    async query<T>(sql: string): Promise<T> {
      return handler(sql) as T;
    },
    isDatabaseUnavailable: () => false,
  };
}

describe("fetchVerifiedClaimEnrichment", () => {
  it("maps evidence rows by id and keeps only the latest judgment per unit", async () => {
    const store = stubStore((sql) => {
      if (sql.includes("connect_claim_judgment")) {
        // ORDER BY judged_at DESC — first row per unit is the latest verdict.
        return [
          { unit: "claim:a", judge_model: "newer", prompt_version: 2, judged_at: "2026-06-10T12:00:00Z" },
          { unit: "claim:a", judge_model: "older", prompt_version: 1, judged_at: "2026-06-09T12:00:00Z" },
        ] satisfies ClaimJudgmentRow[];
      }
      return [boundRow];
    });
    const { evidence, judgments } = await fetchVerifiedClaimEnrichment({
      store,
      unitTable: "claim",
      claimIds: ["claim:a"],
    });
    expect(evidence.get("claim:a")).toBe(boundRow);
    expect(judgments.get("claim:a")?.judge_model).toBe("newer");
  });

  it("returns empty maps when the store lacks EBV fields/tables (errors)", async () => {
    const store = stubStore(() => {
      throw new Error("table does not exist");
    });
    const { evidence, judgments } = await fetchVerifiedClaimEnrichment({
      store,
      unitTable: "claim",
      claimIds: ["claim:a"],
    });
    expect(evidence.size).toBe(0);
    expect(judgments.size).toBe(0);
  });

  it("skips the store entirely for an empty claim set", async () => {
    let calls = 0;
    const store = stubStore(() => {
      calls += 1;
      return [];
    });
    await fetchVerifiedClaimEnrichment({ store, unitTable: "claim", claimIds: [] });
    expect(calls).toBe(0);
  });
});

describe("buildVerifiedClaims (fetch + compose)", () => {
  it("degrades to unbound semantics on enrichment failure — legacy claims demote, EBV states stand", async () => {
    const store = stubStore(() => {
      throw new Error("unreachable");
    });
    const { envelopes, summary } = await buildVerifiedClaims({
      store,
      unitTable: "claim",
      vocabulary,
      claims: [claim("claim:a", "supported"), claim("claim:b", "validated")],
      traceId: "trace-9",
    });
    // EBV state persists (written by the pipeline) even when evidence cannot be re-read…
    expect(envelopes[0].state).toBe("supported");
    expect(envelopes[0].evidence).toEqual([]);
    // …but a legacy-affirmed claim without a readable binding is inferred, never supported.
    expect(envelopes[1].state).toBe("inferred");
    expect(summary).toEqual({ supported: 1, inferred: 1 });
  });
});
