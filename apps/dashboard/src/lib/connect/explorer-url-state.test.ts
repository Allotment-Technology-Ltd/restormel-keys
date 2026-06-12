import { describe, it, expect } from "vitest";
import {
  parseExplorerUrlState,
  buildExplorerSearchParams,
  buildExplorerUrl,
  isVerificationStateFilter,
  normalizeAsOf,
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

// ---------------------------------------------------------------------------
// W2.5 — as-of time travel: parse / build / compose / strip
// ---------------------------------------------------------------------------

describe("normalizeAsOf (W2.5)", () => {
  it("canonicalises a valid datetime-local value to ISO", () => {
    expect(normalizeAsOf("2026-05-03T14:02")).toBe(new Date("2026-05-03T14:02").toISOString());
  });
  it("passes a full ISO instant through unchanged (canonical)", () => {
    expect(normalizeAsOf("2026-05-03T14:02:00.000Z")).toBe("2026-05-03T14:02:00.000Z");
  });
  it("returns null for empty / whitespace / garbage", () => {
    expect(normalizeAsOf("")).toBeNull();
    expect(normalizeAsOf("   ")).toBeNull();
    expect(normalizeAsOf("not-a-date")).toBeNull();
    expect(normalizeAsOf(null)).toBeNull();
    expect(normalizeAsOf(undefined)).toBeNull();
  });
});

describe("parseExplorerUrlState — as_of / audit (W2.5)", () => {
  it("defaults to live (asOf=null, includeSuperseded=false)", () => {
    const s = parseExplorerUrlState(params({}));
    expect(s.asOf).toBeNull();
    expect(s.includeSuperseded).toBe(false);
  });

  it("?as_of=<iso> parses to a canonical ISO instant", () => {
    const s = parseExplorerUrlState(params({ as_of: "2026-05-03T14:02:00.000Z" }));
    expect(s.asOf).toBe("2026-05-03T14:02:00.000Z");
  });

  it("an unparseable ?as_of is dropped to live (mangled share link degrades safely)", () => {
    const s = parseExplorerUrlState(params({ as_of: "garbage" }));
    expect(s.asOf).toBeNull();
  });

  it("?audit=1 sets includeSuperseded", () => {
    expect(parseExplorerUrlState(params({ audit: "1" })).includeSuperseded).toBe(true);
    expect(parseExplorerUrlState(params({ audit: "0" })).includeSuperseded).toBe(false);
    expect(parseExplorerUrlState(params({ audit: "true" })).includeSuperseded).toBe(false);
  });

  it("composes with ?filter and ?unit", () => {
    const s = parseExplorerUrlState(
      params({ filter: "unsupported", unit: "abc", as_of: "2026-05-03T00:00:00.000Z", audit: "1" }),
    );
    expect(s.verdictFilter).toBe("unsupported");
    expect(s.selectedUnitId).toBe("abc");
    expect(s.asOf).toBe("2026-05-03T00:00:00.000Z");
    expect(s.includeSuperseded).toBe(true);
  });
});

describe("buildExplorerSearchParams — as_of / audit (W2.5)", () => {
  const base = {
    queueScope: "review" as const,
    verdictFilter: null,
    verificationStateFilter: null,
    selectedUnitId: null,
  };

  it("omits as_of/audit at their defaults (clean URL)", () => {
    const p = buildExplorerSearchParams({ ...base, asOf: null, includeSuperseded: false });
    expect(p.has("as_of")).toBe(false);
    expect(p.has("audit")).toBe(false);
  });

  it("writes as_of when set", () => {
    const p = buildExplorerSearchParams({
      ...base,
      asOf: "2026-05-03T14:02:00.000Z",
      includeSuperseded: false,
    });
    expect(p.get("as_of")).toBe("2026-05-03T14:02:00.000Z");
  });

  it("writes audit=1 when includeSuperseded", () => {
    const p = buildExplorerSearchParams({ ...base, asOf: null, includeSuperseded: true });
    expect(p.get("audit")).toBe("1");
  });
});

describe("buildExplorerUrl — as_of composes with existing params (W2.5)", () => {
  it("merges as_of without clobbering filter/unit/workspace/focus", () => {
    const url = new URL("https://example.com/claims?workspace=tools&focus=embed&filter=unsupported&unit=u1");
    const out = buildExplorerUrl(url, {
      queueScope: "all",
      verdictFilter: "unsupported",
      verificationStateFilter: null,
      selectedUnitId: "u1",
      asOf: "2026-05-03T14:02:00.000Z",
      includeSuperseded: true,
    });
    expect(out).toContain("workspace=tools");
    expect(out).toContain("focus=embed");
    expect(out).toContain("filter=unsupported");
    expect(out).toContain("unit=u1");
    expect(out).toContain("as_of=");
    expect(out).toContain("audit=1");
  });

  it("strips as_of/audit when returning to now (default state)", () => {
    const url = new URL("https://example.com/claims?as_of=2026-05-03T14:02:00.000Z&audit=1&workspace=w");
    const out = buildExplorerUrl(url, {
      queueScope: "review",
      verdictFilter: null,
      verificationStateFilter: null,
      selectedUnitId: null,
      asOf: null,
      includeSuperseded: false,
    });
    expect(out).not.toContain("as_of");
    expect(out).not.toContain("audit");
    // ...but preserves unrelated params.
    expect(out).toContain("workspace=w");
  });
});
