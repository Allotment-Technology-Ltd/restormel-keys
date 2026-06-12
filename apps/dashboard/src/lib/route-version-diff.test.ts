import { describe, it, expect, vi, afterEach } from "vitest";
import {
  buildRouteDiff,
  buildPolicyDiff,
  summarizeDiff,
  displayValue,
  exportBundleFileName,
  parseRecommendations,
  type DiffModel,
} from "./route-version-diff";

function routeVersion(version: number, route: Record<string, unknown>, steps: Record<string, unknown>[]) {
  return { version, routeSnapshot: route, stepsSnapshot: steps };
}

const baseRoute = { name: "Default", status: "active", billingMode: "pass_through" };

describe("displayValue", () => {
  it("returns null for nullish/empty, strings for primitives, JSON for objects", () => {
    expect(displayValue(null)).toBeNull();
    expect(displayValue(undefined)).toBeNull();
    expect(displayValue("")).toBeNull();
    expect(displayValue("gpt-4o")).toBe("gpt-4o");
    expect(displayValue(12000)).toBe("12000");
    expect(displayValue(true)).toBe("true");
    expect(displayValue({ a: 1 })).toBe('{"a":1}');
  });
});

describe("buildRouteDiff — changed fields", () => {
  it("detects a changed step field with a deep-link fieldPath", () => {
    const from = routeVersion(1, baseRoute, [
      { id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", timeoutMs: 12000, enabled: true },
    ]);
    const to = routeVersion(2, baseRoute, [
      { id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o-mini", timeoutMs: 8000, enabled: true },
    ]);
    const model = buildRouteDiff(from, to);
    expect(model.empty).toBe(false);
    expect(model.fromVersion).toBe(1);
    expect(model.toVersion).toBe(2);
    expect(model.rows).toHaveLength(1);
    const row = model.rows[0];
    expect(row.kind).toBe("changed");
    expect(row.anchorPath).toBe("step.0");
    const fields = row.changes.map((c) => [c.label, c.from, c.to, c.fieldPath]);
    expect(fields).toContainEqual(["Model", "gpt-4o", "gpt-4o-mini", "step.0.modelId"]);
    expect(fields).toContainEqual(["Timeout (ms)", "12000", "8000", "step.0.timeoutMs"]);
  });

  it("detects route metadata changes as one grouped row anchored at route", () => {
    const from = routeVersion(1, { ...baseRoute, name: "Old", status: "active" }, []);
    const to = routeVersion(2, { ...baseRoute, name: "New", status: "paused" }, []);
    const model = buildRouteDiff(from, to);
    const meta = model.rows.find((r) => r.anchorPath === "route");
    expect(meta).toBeDefined();
    expect(meta?.title).toBe("Route metadata");
    const labels = meta?.changes.map((c) => c.label).sort();
    expect(labels).toEqual(["Name", "Status"]);
    expect(meta?.changes.find((c) => c.label === "Name")?.fieldPath).toBe("route.name");
  });

  it("ignores version/hash/timestamp churn in route metadata", () => {
    const from = routeVersion(1, { ...baseRoute, version: 1, contentHash: "aaa", updatedAt: 1 }, []);
    const to = routeVersion(2, { ...baseRoute, version: 2, contentHash: "bbb", updatedAt: 2 }, []);
    const model = buildRouteDiff(from, to);
    expect(model.empty).toBe(true);
  });
});

describe("buildRouteDiff — added / removed steps", () => {
  it("flags an added step (present in to, absent in from)", () => {
    const from = routeVersion(1, baseRoute, [{ id: "s1", orderIndex: 0, providerPreference: "openai" }]);
    const to = routeVersion(2, baseRoute, [
      { id: "s1", orderIndex: 0, providerPreference: "openai" },
      { id: "s2", orderIndex: 1, providerPreference: "anthropic", modelId: "claude-3" },
    ]);
    const model = buildRouteDiff(from, to);
    const added = model.rows.find((r) => r.kind === "added");
    expect(added).toBeDefined();
    expect(added?.anchorPath).toBe("step.1");
    expect(added?.title).toContain("anthropic/claude-3");
  });

  it("flags a removed step (present in from, absent in to)", () => {
    const from = routeVersion(2, baseRoute, [
      { id: "s1", orderIndex: 0, providerPreference: "openai" },
      { id: "s2", orderIndex: 1, providerPreference: "anthropic" },
    ]);
    const to = routeVersion(3, baseRoute, [{ id: "s1", orderIndex: 0, providerPreference: "openai" }]);
    const model = buildRouteDiff(from, to);
    const removed = model.rows.find((r) => r.kind === "removed");
    expect(removed).toBeDefined();
    expect(removed?.anchorPath).toBe(""); // removed steps have no builder anchor
    expect(removed?.title).toContain("Step 2");
  });

  it("aligns steps by orderIndex when ids are absent", () => {
    const from = routeVersion(1, baseRoute, [{ orderIndex: 0, modelId: "a" }]);
    const to = routeVersion(2, baseRoute, [{ orderIndex: 0, modelId: "b" }]);
    const model = buildRouteDiff(from, to);
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].kind).toBe("changed");
    expect(model.rows[0].changes[0].fieldPath).toBe("step.0.modelId");
  });
});

describe("buildRouteDiff — empty + malformed", () => {
  it("returns empty when snapshots are identical", () => {
    const v = routeVersion(1, baseRoute, [{ id: "s1", orderIndex: 0, modelId: "gpt-4o" }]);
    const model = buildRouteDiff(v, { ...v, version: 2 });
    expect(model.empty).toBe(true);
    expect(model.rows).toHaveLength(0);
  });

  it("tolerates null / missing snapshots without throwing", () => {
    expect(() => buildRouteDiff(null, null)).not.toThrow();
    expect(buildRouteDiff(null, null).empty).toBe(true);
    const half = buildRouteDiff(
      { version: 1, routeSnapshot: undefined, stepsSnapshot: undefined },
      routeVersion(2, baseRoute, [{ id: "s1", orderIndex: 0, modelId: "x" }])
    );
    // from is empty → the to step counts as added; must not throw.
    expect(half.rows.some((r) => r.kind === "added")).toBe(true);
  });

  it("tolerates a malformed stepsSnapshot (non-array / non-object entries)", () => {
    const from = { version: 1, routeSnapshot: baseRoute, stepsSnapshot: "not-an-array" };
    const to = { version: 2, routeSnapshot: baseRoute, stepsSnapshot: [42, null, { orderIndex: 0, modelId: "ok" }] };
    expect(() => buildRouteDiff(from, to)).not.toThrow();
    const model = buildRouteDiff(from, to);
    // Garbage step entries coerce to empty records keyed by order:0; the real one wins.
    expect(model.empty).toBe(false);
  });
});

describe("buildPolicyDiff", () => {
  it("normalises server changes into a single grouped Policy row", () => {
    const model = buildPolicyDiff(
      [
        { field: "name", from: "Old", to: "New" },
        { field: "ruleDefinition", from: { modelIds: ["a"] }, to: { modelIds: ["a", "b"] } },
      ],
      1,
      2
    );
    expect(model.entity).toBe("policy");
    expect(model.rows).toHaveLength(1);
    expect(model.rows[0].anchorPath).toBe("policy");
    const labels = model.rows[0].changes.map((c) => c.label);
    expect(labels).toEqual(["Name", "Rule definition"]);
    expect(model.rows[0].changes[1].fieldPath).toBe("policy.ruleDefinition");
  });

  it("filters version/hash noise and reports empty when nothing meaningful changed", () => {
    const model = buildPolicyDiff(
      [
        { field: "version", from: 1, to: 2 },
        { field: "contentHash", from: "a", to: "b" },
      ],
      1,
      2
    );
    expect(model.empty).toBe(true);
  });

  it("tolerates null/undefined changes", () => {
    expect(() => buildPolicyDiff(null, null, null)).not.toThrow();
    expect(buildPolicyDiff(undefined, 1, 2).empty).toBe(true);
  });
});

describe("summarizeDiff", () => {
  it("summarises an empty diff", () => {
    const empty: DiffModel = { entity: "route", fromVersion: 1, toVersion: 2, rows: [], empty: true };
    expect(summarizeDiff(empty)).toBe("No changes between the selected versions.");
  });

  it("summarises mixed route changes in plain English", () => {
    const from = routeVersion(1, { ...baseRoute, name: "A" }, [
      { id: "s1", orderIndex: 0, modelId: "gpt-4o" },
      { id: "s2", orderIndex: 1, modelId: "old" },
    ]);
    const to = routeVersion(2, { ...baseRoute, name: "B" }, [
      { id: "s1", orderIndex: 0, modelId: "gpt-4o-mini" },
      { id: "s3", orderIndex: 2, modelId: "new" },
    ]);
    const summary = summarizeDiff(buildRouteDiff(from, to));
    expect(summary).toContain("1 step changed");
    expect(summary).toContain("1 step added");
    expect(summary).toContain("1 step removed");
    expect(summary).toContain("route metadata changed");
  });

  it("uses field noun for policies", () => {
    const model = buildPolicyDiff([{ field: "ruleDefinition", from: 1, to: 2 }], 1, 2);
    // a single grouped policy row counts as metadata-style change
    expect(summarizeDiff(model)).toContain("rule details changed");
  });
});

describe("exportBundleFileName", () => {
  it("slugifies a route name into a safe bundle filename", () => {
    expect(exportBundleFileName("My Route / 2")).toBe("my-route-2.route-bundle.json");
    expect(exportBundleFileName("")).toBe("route.route-bundle.json");
    expect(exportBundleFileName("  --weird--  ")).toBe("weird.route-bundle.json");
  });
});

describe("parseRecommendations — recommend wiring", () => {
  it("quotes the endpoint's recommendations and sorts by priority", () => {
    const recs = parseRecommendations({
      data: {
        recommendations: [
          { id: "normalize_order", priority: "medium", action: "Normalize order indexes." },
          { id: "add_steps", priority: "high", action: "Add at least one enabled step." },
          { id: "x", priority: "low", action: "Optional cleanup." },
        ],
      },
    });
    expect(recs.map((r) => r.id)).toEqual(["add_steps", "normalize_order", "x"]);
    // verbatim — no rewording
    expect(recs[0].action).toBe("Add at least one enabled step.");
  });

  it("drops malformed rows and tolerates non-array / missing payloads", () => {
    expect(parseRecommendations(null)).toEqual([]);
    expect(parseRecommendations({ data: {} })).toEqual([]);
    expect(parseRecommendations({ data: { recommendations: "nope" } })).toEqual([]);
    const recs = parseRecommendations({
      data: {
        recommendations: [
          { id: "ok", priority: "high", action: "Keep me." },
          { id: 42, priority: "high", action: "bad id" },
          { id: "bad-priority", priority: "urgent", action: "bad priority" },
          null,
        ],
      },
    });
    expect(recs).toHaveLength(1);
    expect(recs[0].id).toBe("ok");
  });

  it("accepts the raw endpoint shape passed through fetch (mocked)", async () => {
    const payload = {
      data: {
        routeId: "r1",
        recommendations: [{ id: "enable_step", priority: "high", action: "Enable at least one step." }],
        diagnostics: { totalSteps: 1, enabledSteps: 0 },
        safeAutoApply: false,
      },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await fetch("/api/projects/p1/routes/r1/recommend", { method: "POST", body: "{}" });
    const body = await res.json();
    const recs = parseRecommendations(body);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/p1/routes/r1/recommend",
      expect.objectContaining({ method: "POST" })
    );
    expect(recs).toHaveLength(1);
    expect(recs[0].action).toBe("Enable at least one step.");
    // recommendations are surfaced as guidance only — the endpoint says never auto-apply
    expect(body.data.safeAutoApply).toBe(false);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});
