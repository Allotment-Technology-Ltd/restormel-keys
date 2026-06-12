/**
 * Evidence Dossier helpers (W2.2) — facet mapping, the row-2 accept guard,
 * and honest re-check copy (claims ledger rows 2, 9, 10).
 */
import { describe, expect, it } from "vitest";
import {
  canAcceptAsSupported,
  facetForUrlFilter,
  normalizeEvidenceStatus,
  normalizeVerificationState,
  predatesEvidenceBinding,
  recheckResultCopy,
  unitMatchesEvidenceFacet,
  urlFilterForFacet,
  VERIFICATION_STATES,
  verificationStampVisual,
} from "./evidence-dossier";

describe("facet ↔ URL filter mapping", () => {
  it("maps every direct state filter onto its own facet", () => {
    for (const state of VERIFICATION_STATES) {
      expect(facetForUrlFilter(state)).toBe(state);
    }
  });

  it("maps the abstained alias onto the unverified facet (ledger row 10)", () => {
    expect(facetForUrlFilter("abstained")).toBe("unverified");
  });

  it("writes each facet back as its own filter value (shareable URLs)", () => {
    for (const state of VERIFICATION_STATES) {
      expect(urlFilterForFacet(state)).toBe(state);
    }
  });

  it("facet membership is exact — null (pre-EBV) units match no facet", () => {
    expect(unitMatchesEvidenceFacet("supported", "supported")).toBe(true);
    expect(unitMatchesEvidenceFacet("inferred", "supported")).toBe(false);
    expect(unitMatchesEvidenceFacet(null, "unverified")).toBe(false);
  });
});

describe("state normalization", () => {
  it("accepts the five EBV states case-insensitively", () => {
    expect(normalizeVerificationState("Supported")).toBe("supported");
    expect(normalizeVerificationState(" contradicted ")).toBe("contradicted");
  });

  it("returns null for legacy verdicts and junk (never fabricates a state)", () => {
    for (const raw of ["ok", "weak", "removed", "", 42, null, undefined, {}]) {
      expect(normalizeVerificationState(raw)).toBeNull();
    }
  });

  it("normalizes binding statuses and rejects junk", () => {
    expect(normalizeEvidenceStatus("bound")).toBe("bound");
    expect(normalizeEvidenceStatus("NO_EVIDENCE")).toBe("no_evidence");
    expect(normalizeEvidenceStatus("maybe")).toBeNull();
  });
});

describe("accept guard (ledger row 2: unbound → never supported)", () => {
  it("allows accept only when the span is Layer-1 bound", () => {
    expect(
      canAcceptAsSupported({ verificationState: "unverified", evidenceStatus: "bound" }).ok,
    ).toBe(true);
  });

  it("refuses an unbound claim with the honest reason", () => {
    const res = canAcceptAsSupported({
      verificationState: "unverified",
      evidenceStatus: "unbound",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/never be marked supported/);
  });

  it("refuses a no-evidence claim — it can never be supported", () => {
    const res = canAcceptAsSupported({
      verificationState: "unverified",
      evidenceStatus: "no_evidence",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/No evidence span could be bound/);
  });

  it("refuses pre-EBV claims and points at re-ingest", () => {
    const res = canAcceptAsSupported({ verificationState: null, evidenceStatus: null });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/re-ingest/i);
    expect(predatesEvidenceBinding({ verificationState: null, evidenceStatus: null })).toBe(true);
    expect(predatesEvidenceBinding(null)).toBe(true);
    expect(
      predatesEvidenceBinding({ verificationState: "unverified", evidenceStatus: "unbound" }),
    ).toBe(false);
  });
});

describe("stamp visuals", () => {
  it("every state has an uppercase mono stamp and distinct classes", () => {
    const seen = new Set<string>();
    for (const state of VERIFICATION_STATES) {
      const v = verificationStampVisual(state);
      expect(v.stamp).toBe(v.stamp.toUpperCase());
      expect(seen.has(v.stampClass)).toBe(false);
      seen.add(v.stampClass);
    }
  });

  it("null state gets the honest pre-EBV stamp, not a fabricated verdict", () => {
    const v = verificationStampVisual(null);
    expect(v.stamp).toBe("UNBOUND");
    expect(v.meaning).toMatch(/re-ingest/i);
  });
});

describe("re-check copy fails closed (ledger row 9)", () => {
  const at = "2026-06-12T10:00:00.000Z";

  it("reports a pass with the match strictness, never hiding loose matches", () => {
    const copy = recheckResultCopy({ ok: true, match: "fuzzy", checkedAt: at });
    expect(copy.headline).toContain("FUZZY");
    expect(copy.headline).toContain("PASSED");
  });

  it("hash mismatch / text changed / bad offsets are reported as failures", () => {
    for (const reason of ["hash_mismatch", "text_changed", "offsets_out_of_range"] as const) {
      const copy = recheckResultCopy({ ok: false, reason, checkedAt: at });
      expect(copy.headline).toContain("FAILED");
    }
  });

  it("missing source text is unavailable — not a pass, not a silent failure", () => {
    const copy = recheckResultCopy({ ok: false, reason: "source_text_unavailable", checkedAt: at });
    expect(copy.headline).toContain("UNAVAILABLE");
    expect(copy.detail).toMatch(/cannot be re-verified/);
  });
});
