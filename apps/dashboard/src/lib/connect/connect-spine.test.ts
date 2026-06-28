/**
 * Phase 2 spine builder — pure-logic matrix tests (no Svelte render; the vitest
 * browser-condition gotcha means we unit-test only the deriving logic).
 *
 * Asserts: per-stage state derivation, exactly-one-current invariant, honest
 * disable-with-reason on every gated CTA, and the unknown (signal-absent) path.
 */
import { describe, it, expect } from "vitest";
import {
  buildConnectSpine,
  spineNumeral,
  spineReviewCount,
  spineStageAdvanceEvents,
  SPINE_STAGE_JOURNEY_TOKEN,
  type ConnectSpineSignals,
  type ConnectSpineStageId,
} from "./connect-spine";

function readinessOk(
  modelsReady = true,
): NonNullable<ConnectSpineSignals["readiness"]> {
  return {
    status: "ok",
    ready: 6,
    total: 6,
    firstGap: null,
    models: { modelsReady, hasChatRoute: modelsReady, hasEmbeddingRoute: modelsReady },
  };
}

function stage(spine: ReturnType<typeof buildConnectSpine>, id: ConnectSpineStageId) {
  const s = spine.stages.find((x) => x.id === id);
  if (!s) throw new Error(`stage ${id} missing`);
  return s;
}

describe("buildConnectSpine — stage derivation", () => {
  it("all signals absent → every stage is unknown, no current, none done", () => {
    const spine = buildConnectSpine({ readiness: null, ingest: null, graph: null });
    expect(spine.total).toBe(5);
    expect(spine.stages.every((s) => s.state === "unknown")).toBe(true);
    expect(spine.currentStageId).toBeNull();
    expect(spine.done).toBe(0);
  });

  it("readiness fail → Connect blocked with the first-gap fix CTA", () => {
    const spine = buildConnectSpine({
      readiness: {
        status: "fail",
        ready: 3,
        total: 6,
        firstGap: { label: "Store & documents", fixHref: "/fix/store", fixLabel: "Connect store" },
        models: { modelsReady: false, hasChatRoute: false, hasEmbeddingRoute: false },
      },
      ingest: { jobCount: 0, latestJob: null, storeReady: false, documentsReady: false },
      graph: null,
    });
    const connect = stage(spine, "connect");
    expect(connect.state).toBe("blocked");
    expect(connect.cta.href).toBe("/fix/store");
    expect(connect.cta.label).toBe("Connect store");
    expect(connect.cta.disabled).toBe(false); // a blocked stage still offers its fix link
  });

  it("readiness warn → Connect is current and actionable", () => {
    const spine = buildConnectSpine({
      readiness: {
        status: "warn",
        ready: 5,
        total: 6,
        firstGap: { label: "Gateway key", fixHref: "/fix/key", fixLabel: "Create a key" },
        models: { modelsReady: true, hasChatRoute: true, hasEmbeddingRoute: true },
      },
      ingest: { jobCount: 0, latestJob: null, storeReady: true, documentsReady: true },
      graph: null,
    });
    expect(stage(spine, "connect").state).toBe("current");
    expect(spine.currentStageId).toBe("connect");
  });

  it("ingest blocked-with-reason when no store, and again when no documents", () => {
    const noStore = buildConnectSpine({
      readiness: readinessOk(),
      ingest: { jobCount: 0, latestJob: null, storeReady: false, documentsReady: false },
      graph: null,
    });
    const ingestNoStore = stage(noStore, "ingest");
    expect(ingestNoStore.state).toBe("blocked");
    expect(ingestNoStore.cta.disabled).toBe(true);
    expect(ingestNoStore.cta.disabledReason).toMatch(/store/i);

    const noDocs = buildConnectSpine({
      readiness: readinessOk(),
      ingest: { jobCount: 0, latestJob: null, storeReady: true, documentsReady: false },
      graph: null,
    });
    const ingestNoDocs = stage(noDocs, "ingest");
    expect(ingestNoDocs.state).toBe("blocked");
    expect(ingestNoDocs.cta.disabled).toBe(true);
    expect(ingestNoDocs.cta.disabledReason).toMatch(/document/i);
  });

  it("ingest current+watch when a run is in progress", () => {
    const spine = buildConnectSpine({
      readiness: readinessOk(),
      ingest: {
        jobCount: 1,
        latestJob: { id: "job-1", status: "running" },
        storeReady: true,
        documentsReady: true,
      },
      graph: { units: 0, embedded: 0, validation: { ok: 0, weak: 0, unsupported: 0, unvalidated: 0 } },
    });
    const ingest = stage(spine, "ingest");
    expect(ingest.state).toBe("current");
    expect(ingest.cta.href).toContain("job-1");
    expect(ingest.cta.disabled).toBe(false);
  });

  it("make-ready blocked-with-reason when graph is empty", () => {
    const spine = buildConnectSpine({
      readiness: readinessOk(),
      ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
      graph: { units: 0, embedded: 0, validation: { ok: 0, weak: 0, unsupported: 0, unvalidated: 0 } },
    });
    const mr = stage(spine, "make_ready");
    expect(mr.state).toBe("blocked");
    expect(mr.cta.disabled).toBe(true);
    expect(mr.cta.disabledReason).toMatch(/run ingest/i);
  });

  it("make-ready prioritises validate over embed when both have work", () => {
    const spine = buildConnectSpine({
      readiness: readinessOk(),
      ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
      graph: { units: 100, embedded: 40, validation: { ok: 10, weak: 0, unsupported: 0, unvalidated: 50 } },
    });
    const mr = stage(spine, "make_ready");
    expect(mr.state).toBe("current");
    expect(mr.cta.label).toMatch(/^Validate 50/);
    expect(mr.summary).toMatch(/50 unchecked/);
  });

  it("make-ready offers embed when validated but unembedded", () => {
    const spine = buildConnectSpine({
      readiness: readinessOk(),
      ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
      graph: { units: 100, embedded: 70, validation: { ok: 100, weak: 0, unsupported: 0, unvalidated: 0 } },
    });
    const mr = stage(spine, "make_ready");
    expect(mr.state).toBe("current");
    expect(mr.cta.label).toMatch(/^Embed 30/);
  });

  it("make-ready done when fully embedded + validated", () => {
    const spine = buildConnectSpine({
      readiness: readinessOk(),
      ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
      graph: { units: 100, embedded: 100, validation: { ok: 100, weak: 0, unsupported: 0, unvalidated: 0 } },
    });
    expect(stage(spine, "make_ready").state).toBe("done");
  });

  it("review: done-with-disabled-reason when nothing flagged; current when flagged", () => {
    const clean = buildConnectSpine({
      readiness: readinessOk(),
      ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
      graph: { units: 100, embedded: 100, validation: { ok: 100, weak: 0, unsupported: 0, unvalidated: 0 } },
    });
    const reviewClean = stage(clean, "review");
    expect(reviewClean.state).toBe("done");
    expect(reviewClean.cta.disabled).toBe(true);
    expect(reviewClean.cta.disabledReason).toMatch(/no flagged/i);

    const flagged = buildConnectSpine({
      readiness: readinessOk(),
      ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
      graph: { units: 100, embedded: 100, validation: { ok: 80, weak: 8, unsupported: 4, unvalidated: 0 } },
    });
    const reviewFlagged = stage(flagged, "review");
    expect(reviewFlagged.state).toBe("current");
    expect(reviewFlagged.cta.label).toMatch(/^Review 12/);
    expect(reviewFlagged.cta.disabled).toBe(false);
  });

  it("review count prefers awaiting_triage when present", () => {
    expect(spineReviewCount({ ok: 1, weak: 5, unsupported: 5, unvalidated: 0, awaiting_triage: 3 })).toBe(3);
    expect(spineReviewCount({ ok: 1, weak: 5, unsupported: 5, unvalidated: 0 })).toBe(10);
  });

  it("go-live current with publish CTA when models not ready", () => {
    const spine = buildConnectSpine({
      readiness: readinessOk(false),
      ingest: { jobCount: 0, latestJob: null, storeReady: true, documentsReady: true },
      graph: { units: 10, embedded: 10, validation: { ok: 10, weak: 0, unsupported: 0, unvalidated: 0 } },
    });
    const gl = stage(spine, "go_live");
    expect(gl.state).toBe("current");
    expect(gl.cta.label).toBe("Publish routes");
    expect(gl.summary).toMatch(/chat \+ embedding/);
  });

  it("go-live done when models ready and a graph exists", () => {
    const spine = buildConnectSpine({
      readiness: readinessOk(true),
      ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
      graph: { units: 10, embedded: 10, validation: { ok: 10, weak: 0, unsupported: 0, unvalidated: 0 } },
    });
    expect(stage(spine, "go_live").state).toBe("done");
  });
});

describe("buildConnectSpine — exactly-one-current invariant", () => {
  it("highlights only the first current stage when several have work", () => {
    // Connect warn (current) AND make-ready has work — only Connect is current.
    const spine = buildConnectSpine({
      readiness: {
        status: "warn",
        ready: 5,
        total: 6,
        firstGap: { label: "Gateway key", fixHref: "/fix", fixLabel: "Fix" },
        models: { modelsReady: false, hasChatRoute: false, hasEmbeddingRoute: false },
      },
      ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
      graph: { units: 100, embedded: 50, validation: { ok: 10, weak: 0, unsupported: 0, unvalidated: 40 } },
    });
    const currentStages = spine.stages.filter((s) => s.isCurrent);
    expect(currentStages).toHaveLength(1);
    expect(currentStages[0]!.id).toBe("connect");
    expect(spine.currentStageId).toBe("connect");
  });

  it("never marks more than one stage current", () => {
    const spine = buildConnectSpine({
      readiness: readinessOk(false),
      ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
      graph: { units: 100, embedded: 50, validation: { ok: 10, weak: 5, unsupported: 5, unvalidated: 40 } },
    });
    expect(spine.stages.filter((s) => s.isCurrent).length).toBeLessThanOrEqual(1);
  });
});

describe("spineNumeral", () => {
  it("maps 1..5 to circled numerals and falls back beyond", () => {
    expect(spineNumeral(1)).toBe("①");
    expect(spineNumeral(5)).toBe("⑤");
    expect(spineNumeral(99)).toBe("99");
  });
});

describe("stage vocabulary (RES-113 PR-H — flag-gated rename)", () => {
  const signals: ConnectSpineSignals = {
    readiness: readinessOk(),
    ingest: { jobCount: 1, latestJob: { id: "j", status: "succeeded" }, storeReady: true, documentsReady: true },
    graph: { units: 100, embedded: 100, validation: { ok: 100, weak: 0, unsupported: 0, unvalidated: 0 } },
  };

  function labels(spine: ReturnType<typeof buildConnectSpine>): Record<string, string> {
    return Object.fromEntries(spine.stages.map((s) => [s.id, s.label]));
  }

  it("defaults to legacy labels — flag OFF is byte-for-byte the shipped names", () => {
    const legacyDefault = labels(buildConnectSpine(signals));
    const legacyExplicit = labels(buildConnectSpine(signals, { vocabulary: "legacy" }));
    expect(legacyDefault).toEqual(legacyExplicit);
    expect(legacyDefault).toEqual({
      connect: "Connect",
      ingest: "Ingest",
      make_ready: "Make ready",
      review: "Review",
      go_live: "Go live",
    });
  });

  it("journey vocabulary renames to M0–M4 / Build·Verify·Connect labels", () => {
    const journey = labels(buildConnectSpine(signals, { vocabulary: "journey" }));
    expect(journey).toEqual({
      connect: "Set up",
      ingest: "Build",
      make_ready: "Verify",
      review: "Review",
      go_live: "Connect",
    });
  });

  it("rename changes ONLY labels — ids, indices, states, summaries and CTAs are identical", () => {
    const legacy = buildConnectSpine(signals, { vocabulary: "legacy" });
    const journey = buildConnectSpine(signals, { vocabulary: "journey" });
    expect(journey.stages.map((s) => s.id)).toEqual(legacy.stages.map((s) => s.id));
    expect(journey.stages.map((s) => s.index)).toEqual(legacy.stages.map((s) => s.index));
    expect(journey.stages.map((s) => s.state)).toEqual(legacy.stages.map((s) => s.state));
    expect(journey.stages.map((s) => s.summary)).toEqual(legacy.stages.map((s) => s.summary));
    expect(journey.stages.map((s) => s.cta)).toEqual(legacy.stages.map((s) => s.cta));
    expect(journey.currentStageId).toBe(legacy.currentStageId);
    expect(journey.done).toBe(legacy.done);
  });
});

describe("spineStageAdvanceEvents (RES-113 PR-H — dual-emit continuity)", () => {
  it("emits BOTH the old connect_stage_advance and the new journey_stage_advance", () => {
    const events = spineStageAdvanceEvents("ingest", "make_ready");
    expect(events.map((e) => e.name)).toEqual([
      "connect_stage_advance",
      "journey_stage_advance",
    ]);
  });

  it("old event keeps the shipped spine ids verbatim (funnel continuity)", () => {
    const [oldEvent] = spineStageAdvanceEvents("review", "go_live");
    expect(oldEvent).toEqual({
      name: "connect_stage_advance",
      props: { from: "review", to: "go_live" },
    });
  });

  it("new event re-keys to the M0–M4 / Build·Verify·Connect tokens, 1:1", () => {
    const [, newEvent] = spineStageAdvanceEvents("ingest", "make_ready");
    expect(newEvent).toEqual({
      name: "journey_stage_advance",
      props: { from: "build", to: "verify" },
    });
  });

  it("maps the hub origin to `home` and go_live to `connect`", () => {
    const [, newEvent] = spineStageAdvanceEvents("hub", "go_live");
    expect(newEvent.props).toEqual({ from: "home", to: "connect" });
    // Token map mirrors the rename exactly.
    expect(SPINE_STAGE_JOURNEY_TOKEN).toEqual({
      hub: "home",
      connect: "set_up",
      ingest: "build",
      make_ready: "verify",
      review: "review",
      go_live: "connect",
    });
  });
});
