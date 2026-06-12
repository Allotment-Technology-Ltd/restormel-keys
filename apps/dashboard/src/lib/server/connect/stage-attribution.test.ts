import { describe, expect, it } from "vitest";
import {
  StageAttributionCollector,
  attributionEntryChanged,
  buildStageAttributionEntry,
  deriveValidationFamilyAttribution,
  mergeStageAttribution,
  parseConnectRunAttribution,
  type ConnectRunAttribution,
} from "./stage-attribution";

/**
 * K5 — run attribution capture/merge/parse. The shapes mirror
 * route-resolver.ts `ResolvedRouteResult` (route.id/name, providerType, modelId,
 * selectedStepId, selectedOrderIndex) and the resolve loop's 0-based attemptNumber.
 */
describe("buildStageAttributionEntry", () => {
  it("maps a resolved snapshot to an entry; attemptNumber 0 → attempts 1 (first try)", () => {
    const entry = buildStageAttributionEntry(
      {
        routeId: "route-1",
        routeName: "Extraction route",
        projectId: "proj-1",
        stepId: "step-a",
        stepOrderIndex: 0,
        provider: "openai",
        modelId: "gpt-4o-mini",
        attemptNumber: 0,
      },
      "2026-06-12T10:00:00.000Z",
    );
    expect(entry).toEqual({
      routeId: "route-1",
      routeName: "Extraction route",
      projectId: "proj-1",
      stepId: "step-a",
      stepOrderIndex: 0,
      provider: "openai",
      modelId: "gpt-4o-mini",
      attempts: 1,
      recordedAt: "2026-06-12T10:00:00.000Z",
    });
  });

  it("a 2-attempt fallback records attempts=3 (0-based attemptNumber 2 → 3 human attempts)", () => {
    const entry = buildStageAttributionEntry({ provider: "anthropic", modelId: "claude", attemptNumber: 2 });
    expect(entry.attempts).toBe(3);
  });

  it("blank/whitespace fields normalize to null", () => {
    const entry = buildStageAttributionEntry({ routeId: "  ", routeName: "", provider: "openai", modelId: "m" });
    expect(entry.routeId).toBeNull();
    expect(entry.routeName).toBeNull();
    expect(entry.attempts).toBe(1);
  });
});

describe("mergeStageAttribution — restart/checkpoint safety", () => {
  it("merges a new stage while preserving prior stages (append, not clobber)", () => {
    const prior: ConnectRunAttribution = {
      extraction: buildStageAttributionEntry({ provider: "openai", modelId: "gpt-4o", attemptNumber: 0 }),
    };
    const merged = mergeStageAttribution(
      prior,
      "validation",
      buildStageAttributionEntry({ provider: "anthropic", modelId: "claude", attemptNumber: 0 }),
    );
    expect(merged.extraction?.provider).toBe("openai");
    expect(merged.validation?.provider).toBe("anthropic");
  });

  it("re-running a stage overwrites its own entry with the latest successful attempt", () => {
    let map: ConnectRunAttribution = mergeStageAttribution(
      null,
      "extraction",
      buildStageAttributionEntry({ provider: "openai", modelId: "gpt-4o", attemptNumber: 0 }),
    );
    map = mergeStageAttribution(
      map,
      "extraction",
      buildStageAttributionEntry({ provider: "openai", modelId: "gpt-4o", attemptNumber: 1 }),
    );
    expect(map.extraction?.attempts).toBe(2);
    expect(Object.keys(map)).toEqual(["extraction"]);
  });

  it("drops unknown/junk keys from the prior map (bounded to the 5 known stages)", () => {
    const prior = {
      extraction: buildStageAttributionEntry({ provider: "openai", modelId: "m" }),
      bogus: { provider: "evil" },
    } as unknown as ConnectRunAttribution;
    const merged = mergeStageAttribution(prior, "grouping", buildStageAttributionEntry({ provider: "p", modelId: "m" }));
    expect(Object.keys(merged).sort()).toEqual(["extraction", "grouping"]);
  });
});

describe("StageAttributionCollector — across a mocked 2-attempt fallback", () => {
  it("records the last successful attempt per stage with the attempt count", () => {
    const c = new StageAttributionCollector();
    // extraction succeeds first try (attemptNumber 0)
    c.record("extraction", { routeId: "r-ext", routeName: "Ext", projectId: "p", provider: "openai", modelId: "gpt-4o", attemptNumber: 0 });
    // validation only succeeds on the 3rd resolve (attemptNumber 2) → 2-attempt fallback
    c.record("validation", { routeId: "r-val", routeName: "Val", projectId: "p", provider: "anthropic", modelId: "claude", stepOrderIndex: 1, attemptNumber: 2 });
    const snap = c.snapshot();
    expect(snap.extraction?.modelId).toBe("gpt-4o");
    expect(snap.extraction?.attempts).toBe(1);
    expect(snap.validation?.provider).toBe("anthropic");
    expect(snap.validation?.attempts).toBe(3);
    expect(snap.validation?.stepOrderIndex).toBe(1);
  });

  it("reports changed=true on first record and changed=false on an identical re-resolve", () => {
    const c = new StageAttributionCollector();
    const snap = { routeId: "r", routeName: "R", projectId: "p", provider: "openai", modelId: "gpt-4o", stepOrderIndex: 0, attemptNumber: 0 };
    expect(c.record("extraction", snap).changed).toBe(true);
    // Same served route/provider/model/attempts on the next chunk → no persist needed.
    expect(c.record("extraction", snap).changed).toBe(false);
    // A fallback (different attempt count) IS a change.
    expect(c.record("extraction", { ...snap, attemptNumber: 1 }).changed).toBe(true);
  });
});

describe("attributionEntryChanged", () => {
  it("is true vs an absent prior, false vs an identical entry (ignoring recordedAt)", () => {
    const a = buildStageAttributionEntry({ provider: "openai", modelId: "m" }, "2026-06-12T10:00:00.000Z");
    const aLater = buildStageAttributionEntry({ provider: "openai", modelId: "m" }, "2026-06-12T11:00:00.000Z");
    const b = buildStageAttributionEntry({ provider: "anthropic", modelId: "m" });
    expect(attributionEntryChanged(undefined, a)).toBe(true);
    expect(attributionEntryChanged(a, aLater)).toBe(false); // only recordedAt differs
    expect(attributionEntryChanged(a, b)).toBe(true);
  });
});

describe("parseConnectRunAttribution — legacy/absent + junk handling", () => {
  it("returns undefined for a run that predates attribution (null/empty)", () => {
    expect(parseConnectRunAttribution(null)).toBeUndefined();
    expect(parseConnectRunAttribution({})).toBeUndefined();
    expect(parseConnectRunAttribution("nope")).toBeUndefined();
  });

  it("round-trips a captured map and clamps attempts to >= 1", () => {
    const built: ConnectRunAttribution = {
      extraction: buildStageAttributionEntry({ routeId: "r", routeName: "R", projectId: "p", provider: "openai", modelId: "m", attemptNumber: 0 }),
    };
    const parsed = parseConnectRunAttribution(JSON.parse(JSON.stringify(built)));
    expect(parsed?.extraction?.modelId).toBe("m");
    // attempts below 1 in a malformed blob is clamped
    const bad = parseConnectRunAttribution({ grouping: { provider: "p", modelId: "m", attempts: 0 } });
    expect(bad?.grouping?.attempts).toBe(1);
  });
});

describe("deriveValidationFamilyAttribution — feeds K4 cross-model disclosure", () => {
  it("returns providers when validation is captured", () => {
    const attribution: ConnectRunAttribution = {
      extraction: buildStageAttributionEntry({ provider: "openai", modelId: "gpt-4o" }),
      validation: buildStageAttributionEntry({ provider: "anthropic", modelId: "claude" }),
    };
    expect(deriveValidationFamilyAttribution(attribution)).toEqual({
      validationProvider: "anthropic",
      extractionProvider: "openai",
    });
  });

  it("returns undefined when neither stage was captured (graceful absent-state)", () => {
    expect(deriveValidationFamilyAttribution(null)).toBeUndefined();
    expect(deriveValidationFamilyAttribution({})).toBeUndefined();
  });
});
