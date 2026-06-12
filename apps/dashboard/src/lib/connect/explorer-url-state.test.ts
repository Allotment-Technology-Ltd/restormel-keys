import { describe, it, expect } from "vitest";
import {
  parseExplorerUrlState,
  buildExplorerSearchParams,
  buildExplorerUrl,
  isVerificationStateFilter,
} from "./explorer-url-state";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function params(record: Record<string, string>): URLSearchParams {
  return new URLSearchParams(record);
}

// ---------------------------------------------------------------------------
// parseExplorerUrlState
// ---------------------------------------------------------------------------

describe("parseExplorerUrlState", () => {
  it("defaults to review scope with no filter/unit", () => {
    const state = parseExplorerUrlState(params({}));
    expect(state.queueScope).toBe("review");
    expect(state.verdictFilter).toBeNull();
    expect(state.verificationStateFilter).toBeNull();
    expect(state.selectedUnitId).toBeNull();
  });

  it("?filter=review → queueScope=review", () => {
    const state = parseExplorerUrlState(params({ filter: "review" }));
    expect(state.queueScope).toBe("review");
    expect(state.verdictFilter).toBeNull();
  });

  it("?filter=all → queueScope=all", () => {
    const state = parseExplorerUrlState(params({ filter: "all" }));
    expect(state.queueScope).toBe("all");
    expect(state.verdictFilter).toBeNull();
  });

  it("?filter=ok → verdictFilter=ok, queueScope=all (ok can't live in quarantine)", () => {
    const state = parseExplorerUrlState(params({ filter: "ok" }));
    expect(state.queueScope).toBe("all");
    expect(state.verdictFilter).toBe("ok");
  });

  it("?filter=weak → verdictFilter=weak, queueScope=review", () => {
    const state = parseExplorerUrlState(params({ filter: "weak" }));
    expect(state.verdictFilter).toBe("weak");
    expect(state.queueScope).toBe("review");
  });

  it("?filter=unsupported → verdictFilter=unsupported", () => {
    const state = parseExplorerUrlState(params({ filter: "unsupported" }));
    expect(state.verdictFilter).toBe("unsupported");
  });

  it("?filter=unknown → verdictFilter=unknown", () => {
    const state = parseExplorerUrlState(params({ filter: "unknown" }));
    expect(state.verdictFilter).toBe("unknown");
  });

  it("?filter=unverified → verificationStateFilter=unverified, scope widens to all (W2.2)", () => {
    const state = parseExplorerUrlState(params({ filter: "unverified" }));
    expect(state.verificationStateFilter).toBe("unverified");
    expect(state.verdictFilter).toBeNull();
    // Verification states span the whole graph — scope widens to "all".
    expect(state.queueScope).toBe("all");
  });

  it("?filter=contradicted → verificationStateFilter=contradicted", () => {
    const state = parseExplorerUrlState(params({ filter: "contradicted" }));
    expect(state.verificationStateFilter).toBe("contradicted");
  });

  it("?filter=abstained → verificationStateFilter=abstained", () => {
    const state = parseExplorerUrlState(params({ filter: "abstained" }));
    expect(state.verificationStateFilter).toBe("abstained");
  });

  it("?filter=supported → verificationStateFilter=supported", () => {
    const state = parseExplorerUrlState(params({ filter: "supported" }));
    expect(state.verificationStateFilter).toBe("supported");
  });

  it("?filter=inferred / ?filter=excluded → facet states added in W2.2", () => {
    expect(parseExplorerUrlState(params({ filter: "inferred" })).verificationStateFilter).toBe(
      "inferred",
    );
    expect(parseExplorerUrlState(params({ filter: "excluded" })).verificationStateFilter).toBe(
      "excluded",
    );
  });

  it("unknown filter value is silently ignored", () => {
    const state = parseExplorerUrlState(params({ filter: "totally-unknown" }));
    expect(state.queueScope).toBe("review");
    expect(state.verdictFilter).toBeNull();
    expect(state.verificationStateFilter).toBeNull();
  });

  it("?unit=abc123 → selectedUnitId=abc123", () => {
    const state = parseExplorerUrlState(params({ unit: "abc123" }));
    expect(state.selectedUnitId).toBe("abc123");
  });

  it("?filter=review&unit=abc123 parses both", () => {
    const state = parseExplorerUrlState(params({ filter: "review", unit: "abc123" }));
    expect(state.queueScope).toBe("review");
    expect(state.selectedUnitId).toBe("abc123");
  });

  it("empty unit string is treated as null", () => {
    const state = parseExplorerUrlState(params({ unit: "" }));
    expect(state.selectedUnitId).toBeNull();
  });

  it("whitespace-only filter is treated as default", () => {
    const state = parseExplorerUrlState(params({ filter: "   " }));
    expect(state.queueScope).toBe("review");
    expect(state.verdictFilter).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildExplorerSearchParams
// ---------------------------------------------------------------------------

describe("buildExplorerSearchParams", () => {
  it("default state (review, no filters) produces no params", () => {
    const p = buildExplorerSearchParams({
      queueScope: "review",
      verdictFilter: null,
      verificationStateFilter: null,
      selectedUnitId: null,
    });
    expect(p.toString()).toBe("");
  });

  it("queueScope=all → ?filter=all", () => {
    const p = buildExplorerSearchParams({
      queueScope: "all",
      verdictFilter: null,
      verificationStateFilter: null,
      selectedUnitId: null,
    });
    expect(p.get("filter")).toBe("all");
  });

  it("verdictFilter takes precedence over queueScope for the filter param", () => {
    const p = buildExplorerSearchParams({
      queueScope: "all",
      verdictFilter: "ok",
      verificationStateFilter: null,
      selectedUnitId: null,
    });
    expect(p.get("filter")).toBe("ok");
  });

  it("verificationStateFilter is written when no verdictFilter", () => {
    const p = buildExplorerSearchParams({
      queueScope: "review",
      verdictFilter: null,
      verificationStateFilter: "unverified",
      selectedUnitId: null,
    });
    expect(p.get("filter")).toBe("unverified");
  });

  it("verdictFilter beats verificationStateFilter", () => {
    const p = buildExplorerSearchParams({
      queueScope: "all",
      verdictFilter: "weak",
      verificationStateFilter: "unverified",
      selectedUnitId: null,
    });
    expect(p.get("filter")).toBe("weak");
  });

  it("selectedUnitId → ?unit=<id>", () => {
    const p = buildExplorerSearchParams({
      queueScope: "review",
      verdictFilter: null,
      verificationStateFilter: null,
      selectedUnitId: "unit-xyz",
    });
    expect(p.get("unit")).toBe("unit-xyz");
    // filter is omitted (default).
    expect(p.has("filter")).toBe(false);
  });

  it("both filter and unit are set when both are non-default", () => {
    const p = buildExplorerSearchParams({
      queueScope: "all",
      verdictFilter: null,
      verificationStateFilter: null,
      selectedUnitId: "unit-xyz",
    });
    expect(p.get("filter")).toBe("all");
    expect(p.get("unit")).toBe("unit-xyz");
  });
});

// ---------------------------------------------------------------------------
// buildExplorerUrl — preserves other params
// ---------------------------------------------------------------------------

describe("buildExplorerUrl", () => {
  it("merges explorer state without clobbering other params", () => {
    const base = new URL("https://example.com/claims?workspace=tools&focus=embed");
    const url = buildExplorerUrl(base, {
      queueScope: "all",
      verdictFilter: null,
      verificationStateFilter: null,
      selectedUnitId: "unit-1",
    });
    expect(url).toContain("workspace=tools");
    expect(url).toContain("focus=embed");
    expect(url).toContain("filter=all");
    expect(url).toContain("unit=unit-1");
  });

  it("removes filter+unit when state is default", () => {
    const base = new URL("https://example.com/claims?filter=review&unit=abc");
    const url = buildExplorerUrl(base, {
      queueScope: "review",
      verdictFilter: null,
      verificationStateFilter: null,
      selectedUnitId: null,
    });
    expect(url).not.toContain("filter=");
    expect(url).not.toContain("unit=");
  });

  it("returns path-only url (no host)", () => {
    const base = new URL("https://example.com/claims");
    const url = buildExplorerUrl(base, {
      queueScope: "review",
      verdictFilter: null,
      verificationStateFilter: null,
      selectedUnitId: null,
    });
    expect(url).toBe("/claims");
  });
});

// ---------------------------------------------------------------------------
// round-trip
// ---------------------------------------------------------------------------

describe("round-trip: parse → build", () => {
  const cases: Array<{ label: string; qs: string }> = [
    { label: "default", qs: "" },
    { label: "?filter=review", qs: "filter=review" },
    { label: "?filter=all", qs: "filter=all" },
    { label: "?filter=ok", qs: "filter=ok" },
    { label: "?filter=weak", qs: "filter=weak" },
    { label: "?filter=unsupported", qs: "filter=unsupported" },
    { label: "?filter=unverified", qs: "filter=unverified" },
    { label: "?unit=abc", qs: "unit=abc" },
    { label: "?filter=all&unit=abc", qs: "filter=all&unit=abc" },
  ];

  for (const { label, qs } of cases) {
    it(label, () => {
      const base = new URL(`https://host/graph${qs ? "?" + qs : ""}`);
      const parsed = parseExplorerUrlState(base.searchParams);
      const built = buildExplorerSearchParams(parsed);
      // Re-parse to compare semantic equality (order may differ).
      const reparsed = parseExplorerUrlState(built);
      expect(reparsed).toEqual(parsed);
    });
  }
});

// ---------------------------------------------------------------------------
// isVerificationStateFilter
// ---------------------------------------------------------------------------

describe("isVerificationStateFilter", () => {
  it("returns true for all EBV verification-state values", () => {
    for (const v of [
      "unverified",
      "contradicted",
      "abstained",
      "supported",
      "inferred",
      "excluded",
    ]) {
      expect(isVerificationStateFilter(v)).toBe(true);
    }
  });

  it("returns false for verdict/scope values", () => {
    for (const v of ["review", "all", "ok", "weak", "unsupported", "unknown", ""]) {
      expect(isVerificationStateFilter(v)).toBe(false);
    }
  });
});
