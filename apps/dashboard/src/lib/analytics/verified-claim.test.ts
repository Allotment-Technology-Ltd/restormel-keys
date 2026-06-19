/**
 * Phase 3 north-metric helper: trust bucketing + PII-free event payload.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const track = vi.fn();
vi.mock("$lib/analytics/track", () => ({ track: (...a: unknown[]) => track(...a) }));
vi.mock("$app/environment", () => ({ browser: true }));

import { trustBucket, captureVerifiedClaimSourceSpanOpened } from "./verified-claim";
import type { ProvenanceClaim } from "$lib/connect/graph-comparison-types";

beforeEach(() => vi.clearAllMocks());

describe("trustBucket", () => {
  it("buckets scores PII-free and handles null", () => {
    expect(trustBucket(95)).toBe("high");
    expect(trustBucket(80)).toBe("high");
    expect(trustBucket(65)).toBe("medium");
    expect(trustBucket(20)).toBe("low");
    expect(trustBucket(null)).toBe("unscored");
    expect(trustBucket(undefined)).toBe("unscored");
  });
});

describe("captureVerifiedClaimSourceSpanOpened", () => {
  const claim: ProvenanceClaim = {
    id: "unit-42",
    text: "SECRET claim text that must never be sent",
    sourceTitle: "Private source title",
    verification: "supported",
    trustScore: 88,
  };

  it("emits only non-PII ids/enums/buckets — never claim text or source title", () => {
    captureVerifiedClaimSourceSpanOpened({ claim, workspaceId: "ws-9" });
    expect(track).toHaveBeenCalledWith("verified_claim_source_span_opened", {
      workspace_id: "ws-9",
      claim_id: "unit-42",
      verification: "supported",
      trust_bucket: "high",
      is_first_run: true,
      surface: "prove_console",
    });
    const payload = track.mock.calls[0]![1] as Record<string, unknown>;
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("SECRET claim text");
    expect(serialized).not.toContain("Private source title");
    expect(payload).not.toHaveProperty("trustScore"); // raw score never sent
  });

  it("falls back to 'anon' workspace when unavailable", () => {
    captureVerifiedClaimSourceSpanOpened({ claim, workspaceId: null });
    expect((track.mock.calls[0]![1] as Record<string, unknown>).workspace_id).toBe("anon");
  });
});
