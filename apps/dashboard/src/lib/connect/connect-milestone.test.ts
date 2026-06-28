/**
 * M0–M4 onboarding milestone state-derivation (RES-113 PR-F).
 *
 * Pure-logic matrix tests for `deriveOnboardingMilestone` — the helper that maps
 * the server-derived Connect spine signals onto the milestone the user is at
 * (m0 Explore → m4 Connect) plus one honest next action.
 *
 * Asserts: representative journey states (fresh / mid-ingest / verify / store /
 * connected), the one-adaptive-path / no-persona invariants (REC-ADR-020), and
 * that the next action is reused from the spine's honest CTAs (REC-ADR-021 §5 —
 * server-derived, no persisted client store).
 */
import { describe, it, expect } from "vitest";
import { deriveOnboardingMilestone, MILESTONE_SECTION } from "./connect-journey";
import type { ConnectSpineSignals } from "./connect-spine";

type OnboardingScenario = Parameters<typeof deriveOnboardingMilestone>[0];
type Readiness = NonNullable<ConnectSpineSignals["readiness"]>;
type Ingest = NonNullable<ConnectSpineSignals["ingest"]>;
type Graph = NonNullable<ConnectSpineSignals["graph"]>;

function readiness(modelsReady: boolean, status: Readiness["status"] = modelsReady ? "ok" : "warn"): Readiness {
  return {
    status,
    ready: modelsReady ? 6 : 4,
    total: 6,
    firstGap: modelsReady
      ? null
      : { label: "Routes", fixHref: "/fix/routes", fixLabel: "Publish routes" },
    models: { modelsReady, hasChatRoute: modelsReady, hasEmbeddingRoute: modelsReady },
  };
}

function ingest(over: Partial<Ingest> = {}): Ingest {
  return { jobCount: 0, latestJob: null, storeReady: true, documentsReady: true, ...over };
}

function graph(over: Partial<Graph> = {}): Graph {
  return {
    units: 0,
    embedded: 0,
    validation: { ok: 0, weak: 0, unsupported: 0, unvalidated: 0 },
    ...over,
  };
}

// A graph that is fully built, embedded and validated clean (no verify work).
function cleanGraph(units = 1204): Graph {
  return {
    units,
    embedded: units,
    validation: { ok: units, weak: 0, unsupported: 0, unvalidated: 0 },
  };
}

describe("deriveOnboardingMilestone — representative states", () => {
  it("fresh workspace (no run, no graph) → m0 Explore, next action builds the graph", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(false, "warn"),
        ingest: ingest({ storeReady: false, documentsReady: false }),
        graph: graph(),
      },
    });
    expect(pos.milestone).toBe("m0");
    expect(pos.section).toBe("home");
    expect(pos.label).toBe("Explore");
    expect(pos.status).toBe("current");
    expect(pos.completed).toEqual([]);
    // The single next action points at the build entry (m0 → m1) and is honest.
    expect(pos.nextAction.milestone).toBe("m0");
    expect(pos.nextAction.href).toBeTruthy();
  });

  it("mid-ingest (run in progress, graph not built yet) → m1 Build, watch the live run", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(true),
        ingest: ingest({ jobCount: 1, latestJob: { id: "job-1", status: "running" } }),
        graph: graph(),
      },
    });
    expect(pos.milestone).toBe("m1");
    expect(pos.section).toBe("build");
    expect(pos.completed).toContain("m0"); // a run exists → past explore
    expect(pos.completed).not.toContain("m1"); // graph not built yet
    expect(pos.nextAction.milestone).toBe("m1");
    expect(pos.nextAction.href).toContain("job-1"); // reuses the spine "watch live progress" CTA
    expect(pos.nextAction.disabled).toBe(false);
  });

  it("graph built with flagged/unchecked claims → m2 Verify (surfaced by state, not a persona)", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(true),
        ingest: ingest({ jobCount: 1, latestJob: { id: "j", status: "succeeded" } }),
        graph: graph({
          units: 1204,
          embedded: 1204,
          validation: { ok: 1190, weak: 6, unsupported: 8, unvalidated: 0 },
        }),
      },
    });
    expect(pos.milestone).toBe("m2");
    expect(pos.section).toBe("verify");
    expect(pos.completed).toEqual(expect.arrayContaining(["m0", "m1"]));
    expect(pos.completed).not.toContain("m2");
    expect(pos.availableDepth).toContain("m2");
    expect(pos.nextAction.milestone).toBe("m2");
    expect(pos.nextAction.label).toMatch(/^Review 14/); // 6 weak + 8 unsupported
  });

  it("graph built but still unchecked → m2 Verify prioritises validate (make-ready work)", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(true),
        ingest: ingest({ jobCount: 1, latestJob: { id: "j", status: "succeeded" } }),
        graph: graph({
          units: 100,
          embedded: 100,
          validation: { ok: 40, weak: 0, unsupported: 0, unvalidated: 60 },
        }),
      },
    });
    expect(pos.milestone).toBe("m2");
    expect(pos.nextAction.label).toMatch(/^Validate 60/);
  });

  it("verified clean, managed store, routes not published → m4 Connect (skip m2/m3 honestly)", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(false, "warn"),
        ingest: ingest({ jobCount: 1, latestJob: { id: "j", status: "succeeded" } }),
        graph: cleanGraph(),
      },
    });
    expect(pos.milestone).toBe("m4");
    expect(pos.section).toBe("connect");
    expect(pos.status).toBe("current");
    expect(pos.completed).toEqual(expect.arrayContaining(["m0", "m1", "m2"]));
    expect(pos.completed).not.toContain("m3"); // managed default — never forced
    expect(pos.availableDepth).not.toContain("m3");
    expect(pos.nextAction.milestone).toBe("m4");
    expect(pos.nextAction.label).toBe("Publish routes");
  });

  it("store flow engaged but own DB not yet connected → m3 Store", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(true),
        ingest: ingest({ jobCount: 1, latestJob: { id: "j", status: "succeeded" } }),
        graph: cleanGraph(),
      },
      ownStore: { engaged: true, connected: false },
    });
    expect(pos.milestone).toBe("m3");
    expect(pos.section).toBe("store");
    expect(pos.availableDepth).toContain("m3");
    expect(pos.completed).not.toContain("m3");
    expect(pos.nextAction.milestone).toBe("m3");
    expect(pos.nextAction.label).toMatch(/database/i);
  });

  it("own DB connected, verified clean, routes published → m4 complete (live)", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(true),
        ingest: ingest({ jobCount: 2, latestJob: { id: "j", status: "succeeded" } }),
        graph: cleanGraph(),
      },
      ownStore: { engaged: true, connected: true },
    });
    expect(pos.milestone).toBe("m4");
    expect(pos.status).toBe("complete");
    expect(pos.completed).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(pos.nextAction.label).toMatch(/manage connections/i);
  });

  it("connected workspace (explicit connections count) → m4 complete", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(true),
        ingest: ingest({ jobCount: 1, latestJob: { id: "j", status: "succeeded" } }),
        graph: cleanGraph(),
      },
      connections: 2,
    });
    expect(pos.milestone).toBe("m4");
    expect(pos.status).toBe("complete");
    expect(pos.completed).toContain("m4");
  });

  it("routes live but zero connections (explicit) → m4 current, wire the first connection", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(true),
        ingest: ingest({ jobCount: 1, latestJob: { id: "j", status: "succeeded" } }),
        graph: cleanGraph(),
      },
      connections: 0,
    });
    expect(pos.milestone).toBe("m4");
    expect(pos.status).toBe("current");
    expect(pos.completed).not.toContain("m4");
    expect(pos.nextAction.label).toMatch(/connect your app/i);
  });
});

describe("deriveOnboardingMilestone — adaptive-path invariants (REC-ADR-020)", () => {
  it("m3 is never forced: verified-clean managed workspace skips straight to m4", () => {
    const pos = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(true),
        ingest: ingest({ jobCount: 1, latestJob: { id: "j", status: "succeeded" } }),
        graph: cleanGraph(),
      },
      // no ownStore signal → managed default
    });
    expect(pos.milestone).toBe("m4");
    expect(pos.availableDepth).not.toContain("m3");
  });

  it("verify only surfaces when there is verify work (clean graph never blocks on m2)", () => {
    const clean = deriveOnboardingMilestone({
      spine: {
        readiness: readiness(true),
        ingest: ingest({ jobCount: 1, latestJob: { id: "j", status: "succeeded" } }),
        graph: cleanGraph(),
      },
    });
    expect(clean.availableDepth).not.toContain("m2");
    expect(clean.completed).toContain("m2");
  });

  it("position is always exactly one milestone and a valid section", () => {
    const states: OnboardingScenario[] = [
      { spine: { readiness: readiness(false, "fail"), ingest: ingest({ storeReady: false }), graph: graph() } },
      { spine: { readiness: readiness(true), ingest: ingest({ latestJob: { id: "j", status: "running" } }), graph: graph() } },
      {
        spine: {
          readiness: readiness(true),
          ingest: ingest({ jobCount: 1 }),
          graph: graph({ units: 50, embedded: 50, validation: { ok: 40, weak: 5, unsupported: 5, unvalidated: 0 } }),
        },
      },
      { spine: { readiness: readiness(true), ingest: ingest({ jobCount: 1 }), graph: cleanGraph() }, connections: 3 },
    ];
    for (const s of states) {
      const pos = deriveOnboardingMilestone(s);
      expect(["m0", "m1", "m2", "m3", "m4"]).toContain(pos.milestone);
      expect(pos.section).toBe(MILESTONE_SECTION[pos.milestone]);
      // The next action always advances the reported milestone.
      expect(pos.nextAction.milestone).toBe(pos.milestone);
      // Honest CTA: disabled implies a reason; enabled implies none.
      if (pos.nextAction.disabled) expect(pos.nextAction.disabledReason).toBeTruthy();
      else expect(pos.nextAction.disabledReason).toBeNull();
    }
  });

  it("absent signals degrade honestly (no graph signal) → still resolves a position", () => {
    const pos = deriveOnboardingMilestone({
      spine: { readiness: null, ingest: null, graph: null },
    });
    // Nothing built and nothing known → fresh Explore.
    expect(pos.milestone).toBe("m0");
    expect(pos.completed).toEqual([]);
  });
});
