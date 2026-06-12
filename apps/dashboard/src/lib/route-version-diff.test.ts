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

describe("buildRouteDiff — type-aware display pair (m1)", () => {
  it('disambiguates "1" → 1 by quoting the string side so it does not read as 1 → 1', () => {
    // timeoutMs stored as string "8000" in one snapshot, number 8000 in the other.
    const from = routeVersion(1, baseRoute, [{ id: "s1", orderIndex: 0, timeoutMs: "8000" }]);
    const to = routeVersion(2, baseRoute, [{ id: "s1", orderIndex: 0, timeoutMs: 8000 }]);
    const model = buildRouteDiff(from, to);
    expect(model.empty).toBe(false);
    const change = model.rows[0].changes.find((c) => c.label === "Timeout (ms)");
    expect(change).toBeDefined();
    // The two sides must not render identically.
    expect(change?.from).not.toBe(change?.to);
    expect(change?.from).toBe('"8000"');
    expect(change?.to).toBe("8000");
  });

  it("leaves genuinely-distinct renderings untouched", () => {
    const from = routeVersion(1, baseRoute, [{ id: "s1", orderIndex: 0, modelId: "gpt-4o" }]);
    const to = routeVersion(2, baseRoute, [{ id: "s1", orderIndex: 0, modelId: "gpt-4o-mini" }]);
    const change = buildRouteDiff(from, to).rows[0].changes[0];
    expect(change.from).toBe("gpt-4o");
    expect(change.to).toBe("gpt-4o-mini");
  });
});

describe("buildRouteDiff — pure step reorder (M1)", () => {
  it("surfaces a reorder-only change (same steps, different order) as non-empty, naming the moved steps", () => {
    // Two versions with the SAME two steps by id, but swapped order. moveStep()
    // rewrites orderIndex and resets the route's entryStepId — both must show.
    const stepA = { id: "sA", providerPreference: "openai", modelId: "gpt-4o" };
    const stepB = { id: "sB", providerPreference: "anthropic", modelId: "claude-3" };
    const from = routeVersion(
      1,
      { ...baseRoute, entryStepId: "sA" },
      [
        { ...stepA, orderIndex: 0 },
        { ...stepB, orderIndex: 1 },
      ]
    );
    const to = routeVersion(
      2,
      { ...baseRoute, entryStepId: "sB" },
      [
        { ...stepB, orderIndex: 0 },
        { ...stepA, orderIndex: 1 },
      ]
    );
    const model = buildRouteDiff(from, to);

    // Truthfulness: a reorder is NOT "structurally identical".
    expect(model.empty).toBe(false);

    // Both moved steps surface as Position changes (named by their step title).
    const stepRows = model.rows.filter((r) => r.anchorPath.startsWith("step."));
    expect(stepRows.length).toBe(2);
    for (const row of stepRows) {
      expect(row.kind).toBe("changed");
      expect(row.changes.some((c) => c.label === "Position")).toBe(true);
    }
    const movedTitles = stepRows.map((r) => r.title);
    expect(movedTitles.some((t) => t.includes("anthropic/claude-3"))).toBe(true);
    expect(movedTitles.some((t) => t.includes("openai/gpt-4o"))).toBe(true);

    // The entry step change surfaces in route metadata.
    const meta = model.rows.find((r) => r.anchorPath === "route");
    expect(meta?.changes.find((c) => c.label === "Entry step")).toMatchObject({
      from: "sA",
      to: "sB",
    });

    // And the publish-confirm summary must NOT claim "No changes".
    expect(summarizeDiff(model)).not.toContain("No changes");
    expect(summarizeDiff(model)).toContain("step");
  });

  it("carries the snapshot stepId on changed/added step rows for drift-proof deep-linking (m4)", () => {
    const from = routeVersion(1, baseRoute, [{ id: "s1", orderIndex: 0, modelId: "a" }]);
    const to = routeVersion(2, baseRoute, [
      { id: "s1", orderIndex: 0, modelId: "b" },
      { id: "s2", orderIndex: 1, modelId: "new" },
    ]);
    const model = buildRouteDiff(from, to);
    const changed = model.rows.find((r) => r.kind === "changed" && r.anchorPath.startsWith("step."));
    const added = model.rows.find((r) => r.kind === "added");
    expect(changed?.stepId).toBe("s1");
    expect(added?.stepId).toBe("s2");
  });
});

describe("buildRouteDiff — publish blast radius (M2: draft vs live)", () => {
  // VersionsPanel computes the publish confirm by diffing the pending draft
  // (shaped like a stored snapshot) against the latest published snapshot, then
  // summarizing it. These assertions cover that exact computation.
  const liveSnapshot = routeVersion(3, { ...baseRoute, name: "Live" }, [
    { id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true },
  ]);

  it("reports the changes the draft introduces over the live version", () => {
    const draft = {
      version: null,
      routeSnapshot: { ...baseRoute, name: "Live" },
      stepsSnapshot: [
        { id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o-mini", enabled: true },
      ],
    };
    const model = buildRouteDiff(liveSnapshot, draft);
    const summary = summarizeDiff(model);
    // The confirm shows THIS publish's blast radius, not the previous change.
    expect(model.empty).toBe(false);
    expect(summary).toContain("1 step changed");
    expect(model.rows[0].changes.find((c) => c.label === "Model")).toMatchObject({
      from: "gpt-4o",
      to: "gpt-4o-mini",
    });
  });

  it("reports an honest empty blast radius when the draft equals the live version", () => {
    const draft = {
      version: null,
      routeSnapshot: { ...baseRoute, name: "Live" },
      stepsSnapshot: [
        { id: "s1", orderIndex: 0, providerPreference: "openai", modelId: "gpt-4o", enabled: true },
      ],
    };
    const model = buildRouteDiff(liveSnapshot, draft);
    expect(model.empty).toBe(true);
    expect(summarizeDiff(model)).toBe("No changes between the selected versions.");
  });

  it("a reorder-only draft confirms as a real change, not 'No changes' (M1 feeds M2)", () => {
    const live = routeVersion(
      2,
      { ...baseRoute, entryStepId: "s1" },
      [
        { id: "s1", orderIndex: 0, modelId: "a" },
        { id: "s2", orderIndex: 1, modelId: "b" },
      ]
    );
    const draft = {
      version: null,
      routeSnapshot: { ...baseRoute, entryStepId: "s2" },
      stepsSnapshot: [
        { id: "s2", orderIndex: 0, modelId: "b" },
        { id: "s1", orderIndex: 1, modelId: "a" },
      ],
    };
    const model = buildRouteDiff(live, draft);
    expect(model.empty).toBe(false);
    expect(summarizeDiff(model)).not.toContain("No changes");
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
