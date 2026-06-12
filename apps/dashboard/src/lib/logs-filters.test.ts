import { describe, expect, it } from "vitest";
import {
  parseLogFilters,
  logFiltersToQuery,
  hasActiveFilters,
  timePresetToWindow,
  isTimePreset,
  DEFAULT_TIME_PRESET,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  classifyLogSource,
  isSourceBucket,
  sourceBucketLabel,
  applyClientFilters,
  logMatchesQuery,
  buildNameMap,
  displayName,
  namedOptionsForIds,
  receiptOutcome,
  isFailureStatus,
  failureExplanation,
  receiptPolicyChecks,
  type LogRow,
  type LogFilterState,
} from "./logs-filters";

// Fixture mirrors RequestLogRecord (src/lib/server/neon.ts ~line 4569) + trimmed metadata.
function mkLog(over: Partial<LogRow> = {}): LogRow {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    projectId: "proj-aaaaaaaa-bbbb",
    environmentId: "env-1",
    routeId: "route-cccccccc-dddd",
    gatewayKeyId: null,
    providerType: "openai",
    finalModelId: "gpt-4o",
    requestStatus: "resolved",
    latencyMs: 42,
    ttftMs: 10,
    inputTokens: 100,
    outputTokens: 50,
    estimatedCost: 0.0012,
    fallbackCount: null,
    errorCode: null,
    createdAt: 1_700_000_000_000,
    source: null,
    metadata: null,
    ...over,
  };
}

function getter(rec: Record<string, string>) {
  return (k: string) => (k in rec ? rec[k] : null);
}

describe("time-range presets", () => {
  it("maps presets to a since/until window anchored at now", () => {
    const now = 1_000_000_000;
    expect(timePresetToWindow("15m", now)).toEqual({ since: now - 15 * 60_000, until: now, preset: "15m" });
    expect(timePresetToWindow("1h", now)).toEqual({ since: now - 60 * 60_000, until: now, preset: "1h" });
    expect(timePresetToWindow("24h", now).preset).toBe("24h");
    expect(timePresetToWindow("7d", now).preset).toBe("7d");
  });

  it("falls back to the default preset for unknown/empty values", () => {
    const now = 5;
    expect(timePresetToWindow("nonsense", now).preset).toBe(DEFAULT_TIME_PRESET);
    expect(timePresetToWindow(null, now).preset).toBe(DEFAULT_TIME_PRESET);
    expect(isTimePreset("15m")).toBe(true);
    expect(isTimePreset("90d")).toBe(false);
  });
});

describe("filter parse ⇄ query mapping", () => {
  it("parses all filter params with normalization", () => {
    const state = parseLogFilters(
      getter({
        projectId: " proj-1 ",
        routeId: "route-9",
        status: "no_route",
        source: "connect_ingest",
        time: "1h",
        q: " gpt ",
        limit: "200",
      }),
    );
    expect(state).toEqual<LogFilterState>({
      projectId: "proj-1",
      routeId: "route-9",
      status: "no_route",
      source: "connect_ingest",
      time: "1h",
      q: "gpt",
      limit: 200,
    });
  });

  it("clamps the limit and drops invalid source/time", () => {
    const state = parseLogFilters(getter({ limit: "9999", source: "bogus", time: "bogus" }));
    expect(state.limit).toBe(MAX_LIMIT);
    expect(state.source).toBeNull();
    expect(state.time).toBe(DEFAULT_TIME_PRESET);

    const lo = parseLogFilters(getter({ limit: "0" }));
    expect(lo.limit).toBe(1);
    const def = parseLogFilters(getter({}));
    expect(def.limit).toBe(DEFAULT_LIMIT);
  });

  it("omits default time + default limit from the query string (clean deep-links)", () => {
    expect(logFiltersToQuery({ time: DEFAULT_TIME_PRESET, limit: DEFAULT_LIMIT })).toBe("");
    const q = logFiltersToQuery({ projectId: "p1", routeId: "r1", status: "failed", source: "agent", time: "15m", q: "boom", limit: 200 });
    const params = new URLSearchParams(q);
    expect(params.get("projectId")).toBe("p1");
    expect(params.get("routeId")).toBe("r1");
    expect(params.get("status")).toBe("failed");
    expect(params.get("source")).toBe("agent");
    expect(params.get("time")).toBe("15m");
    expect(params.get("q")).toBe("boom");
    expect(params.get("limit")).toBe("200");
  });

  it("round-trips a state through query and back", () => {
    const original = { projectId: "p1", routeId: null, status: "policy_blocked", source: "connect_ingest" as const, time: "24h" as const, q: "claude", limit: 50 };
    const q = logFiltersToQuery(original);
    const back = parseLogFilters((k) => new URLSearchParams(q).get(k));
    expect(back.projectId).toBe("p1");
    expect(back.status).toBe("policy_blocked");
    expect(back.source).toBe("connect_ingest");
    expect(back.time).toBe("24h");
    expect(back.q).toBe("claude");
    expect(back.limit).toBe(50);
  });

  it("hasActiveFilters distinguishes default from filtered state", () => {
    expect(hasActiveFilters(parseLogFilters(getter({})))).toBe(false);
    expect(hasActiveFilters(parseLogFilters(getter({ status: "no_route" })))).toBe(true);
    expect(hasActiveFilters(parseLogFilters(getter({ time: "15m" })))).toBe(true);
  });
});

describe("source taxonomy + classifier", () => {
  it("classifies connect_ingest by stored tag", () => {
    expect(classifyLogSource(mkLog({ source: "connect_ingest" }))).toBe("connect_ingest");
  });
  it("derives agent from a gateway key, dashboard otherwise", () => {
    expect(classifyLogSource(mkLog({ source: null, gatewayKeyId: "gk-1" }))).toBe("agent");
    expect(classifyLogSource(mkLog({ source: null, gatewayKeyId: null }))).toBe("dashboard");
    expect(classifyLogSource(mkLog({ source: null, gatewayKeyId: "" }))).toBe("dashboard");
  });
  it("stored tag wins over a gateway key", () => {
    expect(classifyLogSource(mkLog({ source: "connect_ingest", gatewayKeyId: "gk-1" }))).toBe("connect_ingest");
  });
  it("guards + labels", () => {
    expect(isSourceBucket("agent")).toBe(true);
    expect(isSourceBucket("nope")).toBe(false);
    expect(sourceBucketLabel("connect_ingest")).toBe("Connect ingest");
  });
});

describe("client-side filtering", () => {
  const rows = [
    mkLog({ id: "a", requestStatus: "resolved", source: "connect_ingest", finalModelId: "gpt-4o" }),
    mkLog({ id: "b", requestStatus: "no_route", gatewayKeyId: "gk-1", finalModelId: "claude-3" }),
    mkLog({ id: "c", requestStatus: "failed", gatewayKeyId: null, errorCode: "credentials_missing" }),
  ];

  it("filters by status", () => {
    const out = applyClientFilters(rows, parseLogFilters(getter({ status: "no_route" })));
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });
  it("filters by source bucket", () => {
    expect(applyClientFilters(rows, parseLogFilters(getter({ source: "connect_ingest" }))).map((r) => r.id)).toEqual(["a"]);
    expect(applyClientFilters(rows, parseLogFilters(getter({ source: "agent" }))).map((r) => r.id)).toEqual(["b"]);
    expect(applyClientFilters(rows, parseLogFilters(getter({ source: "dashboard" }))).map((r) => r.id)).toEqual(["c"]);
  });
  it("free-text scans the stated fields (model, error code, status)", () => {
    expect(logMatchesQuery(rows[1], "claude")).toBe(true);
    expect(logMatchesQuery(rows[2], "credentials")).toBe(true);
    expect(logMatchesQuery(rows[0], "no_route")).toBe(false);
    expect(logMatchesQuery(rows[0], null)).toBe(true);
  });
  it("composes status + source + q", () => {
    const out = applyClientFilters(rows, parseLogFilters(getter({ status: "failed", q: "credentials" })));
    expect(out.map((r) => r.id)).toEqual(["c"]);
  });
});

describe("name resolution", () => {
  it("builds an id→name map and resolves names with a prefix fallback", () => {
    const map = buildNameMap([
      { id: "proj-aaaaaaaa-bbbb", name: "  Acme  " },
      { id: "proj-z", name: "" },
    ]);
    expect(map["proj-aaaaaaaa-bbbb"]).toBe("Acme");
    expect(map["proj-z"]).toBe("proj-z");
    expect(displayName("proj-aaaaaaaa-bbbb", map)).toBe("Acme");
    expect(displayName("unknown-uuid-1234567890", map)).toBe("unknown-…");
    expect(displayName(null, map)).toBe("—");
  });
  it("namedOptionsForIds dedupes, resolves, and sorts by name", () => {
    const map = { p1: "Zeta", p2: "Alpha" };
    const opts = namedOptionsForIds(["p2", "p1", "p2", "p3xxxxxx"], map);
    expect(opts.map((o) => o.name)).toEqual(["Alpha", "p3xxxxxx…", "Zeta"]);
  });
});

describe("receipt outcome + failure honesty", () => {
  it("maps statuses to coarse outcome classes", () => {
    expect(receiptOutcome("resolved")).toBe("resolved");
    expect(receiptOutcome("policy_blocked")).toBe("blocked");
    expect(receiptOutcome("no_route")).toBe("no_route");
    expect(receiptOutcome("usage_limit_reached")).toBe("limited");
    expect(receiptOutcome("no_key_available")).toBe("failed");
    expect(receiptOutcome("failed")).toBe("failed");
    expect(receiptOutcome("weird")).toBe("other");
  });
  it("isFailureStatus flags failure classes", () => {
    expect(isFailureStatus("resolved")).toBe(false);
    expect(isFailureStatus("no_route")).toBe(true);
    expect(isFailureStatus("policy_blocked")).toBe(true);
    expect(isFailureStatus("failed")).toBe(true);
  });
  it("failureExplanation prefers metadata.explanation, then errorCode, then a default", () => {
    expect(failureExplanation(mkLog({ requestStatus: "failed", metadata: { explanation: "boom upstream" } }))).toBe("boom upstream");
    expect(failureExplanation(mkLog({ requestStatus: "failed", errorCode: "credentials_missing", metadata: null }))).toBe("credentials_missing");
    expect(failureExplanation(mkLog({ requestStatus: "no_route", errorCode: null, metadata: null }))).toMatch(/No route matched/);
    expect(failureExplanation(mkLog({ requestStatus: "failed", errorCode: null, metadata: null }))).toMatch(/not recorded/);
  });
  it("receiptPolicyChecks renders violations and an honest absent for bare policy_blocked", () => {
    const withViolations = mkLog({
      requestStatus: "policy_blocked",
      metadata: { violations: [{ policyName: "Allowlist", message: "gpt-4o not allowed" }] },
    });
    expect(receiptPolicyChecks(withViolations)).toEqual([{ label: "Allowlist: gpt-4o not allowed" }]);
    const bare = mkLog({ requestStatus: "policy_blocked", metadata: null });
    expect(receiptPolicyChecks(bare)[0].label).toMatch(/details not recorded/);
    expect(receiptPolicyChecks(mkLog({ requestStatus: "resolved" }))).toEqual([]);
  });
});
