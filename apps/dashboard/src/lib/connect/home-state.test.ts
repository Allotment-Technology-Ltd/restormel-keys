/**
 * Home state derivation tests (RES-113 PR-3 / REC-ADR-022).
 *
 * Exhaustive boundary matrix for `deriveHomeState` — the four-state discriminated
 * union (EMPTY | INGEST_RUNNING | BUILT_NOT_CONNECTED | LIVE) the journey Home
 * shell switches over. Pins:
 *   • the state-selection boundaries (built/not-built, active-run, connected),
 *   • the M2 opt-in invariant (Verify ghost tile ONLY when awaitingTriage > 0,
 *     never on EMPTY, never pre-emptively — REC-ADR-016 / REC-ADR-022),
 *   • the honesty invariants (real stage name for the live region; trustScore
 *     passed through as null, never a fabricated placeholder).
 */
import { describe, it, expect } from "vitest";
import { deriveHomeState, type HomeStateSignals } from "./home-state";

function signals(over: Partial<HomeStateSignals> = {}): HomeStateSignals {
  return {
    trustScore: null,
    units: 0,
    awaitingTriage: 0,
    connectionCount: 0,
    latestJob: null,
    ...over,
  };
}

describe("deriveHomeState — EMPTY (no completed ingest)", () => {
  it("fresh workspace (no units, no run) → EMPTY, invitation only, 'Add your sources' CTA", () => {
    const s = deriveHomeState(signals());
    expect(s.kind).toBe("empty");
    expect(s.tiles).toEqual(["hero", "invitation"]);
    expect(s.primaryCta).toBe("add_sources");
  });

  it("EMPTY renders NO Verify apparatus even if a stale awaitingTriage leaks in", () => {
    // Defensive: an empty graph should never surface M2, regardless of the count.
    const s = deriveHomeState(signals({ awaitingTriage: 99 }));
    expect(s.kind).toBe("empty");
    expect(s.showVerifyGhost).toBe(false);
    expect(s.flaggedCount).toBe(0);
    expect(s.tiles).not.toContain("verify_ghost");
  });

  it("EMPTY mounts no meter/gates/triage/ledger/scorecard/activity — only hero + invitation", () => {
    const s = deriveHomeState(signals());
    expect(s.tiles).toEqual(["hero", "invitation"]);
    expect(s.tiles).not.toContain("ask_prove");
    expect(s.tiles).not.toContain("activity");
  });

  it("trustScore is passed through as null (ABSENT, never a placeholder) on EMPTY", () => {
    expect(deriveHomeState(signals()).trustScore).toBeNull();
  });

  it("a finished run with a since-emptied graph still reads EMPTY (units gate wins)", () => {
    // Home derives "graph built" purely from `units` — a completed/finished run that
    // left 0 units is genuinely nothing to connect. This is the SAME gate nav uses for
    // Connect reachability (`resolveJourneyNav` keys `graphExists` on `units > 0`), so
    // Home and nav cannot disagree about whether a graph exists.
    const s = deriveHomeState(signals({ units: 0, latestJob: { id: "j", status: "succeeded" } }));
    expect(s.kind).toBe("empty");
  });
});

describe("deriveHomeState — INGEST_RUNNING (a real active job)", () => {
  it("running job (no graph yet) → INGEST_RUNNING, run_status tile, 'View run' CTA", () => {
    const s = deriveHomeState(signals({ latestJob: { id: "job-1", status: "running", currentStage: "extracting" } }));
    expect(s.kind).toBe("ingest_running");
    expect(s.tiles).toEqual(["hero", "run_status"]);
    expect(s.primaryCta).toBe("view_run");
    expect(s.runJobId).toBe("job-1");
  });

  it("pending is an active status too", () => {
    expect(deriveHomeState(signals({ latestJob: { id: "j", status: "pending" } })).kind).toBe("ingest_running");
  });

  it("exposes the REAL stage name for the live region (never fabricated)", () => {
    const s = deriveHomeState(signals({ latestJob: { id: "j", status: "running", currentStage: "embedding" } }));
    expect(s.runStage).toBe("embedding");
  });

  it("runStage is null (not a placeholder) when the server supplied no stage — REC-ADR-016", () => {
    const s = deriveHomeState(signals({ latestJob: { id: "j", status: "running" } }));
    expect(s.runStage).toBeNull();
  });

  it("an active run takes priority over a built graph (honest progress, not LIVE/BUILT)", () => {
    const s = deriveHomeState(
      signals({ units: 1204, connectionCount: 5, awaitingTriage: 3, latestJob: { id: "j", status: "running" } }),
    );
    expect(s.kind).toBe("ingest_running");
    expect(s.showVerifyGhost).toBe(false); // no M2 apparatus mid-run
    expect(s.tiles).not.toContain("verify_ghost");
  });

  it("a finished (non-active) job does NOT enter INGEST_RUNNING", () => {
    const s = deriveHomeState(signals({ units: 100, latestJob: { id: "j", status: "succeeded" } }));
    expect(s.kind).not.toBe("ingest_running");
  });
});

describe("deriveHomeState — BUILT_NOT_CONNECTED (graph, no connection)", () => {
  it("built graph, zero connections → BUILT_NOT_CONNECTED, ask_prove tile, 'Connect your app' CTA", () => {
    const s = deriveHomeState(signals({ units: 1204, connectionCount: 0, latestJob: { id: "j", status: "succeeded" } }));
    expect(s.kind).toBe("built_not_connected");
    expect(s.tiles).toEqual(["hero", "ask_prove"]);
    expect(s.primaryCta).toBe("connect_app");
    expect(s.showVerifyGhost).toBe(false);
  });

  it("Verify ghost tile appears ONLY when awaitingTriage > 0 (opt-in M2)", () => {
    const s = deriveHomeState(signals({ units: 1204, connectionCount: 0, awaitingTriage: 6 }));
    expect(s.showVerifyGhost).toBe(true);
    expect(s.flaggedCount).toBe(6);
    expect(s.tiles).toEqual(["hero", "ask_prove", "verify_ghost"]);
  });

  it("awaitingTriage === 0 → NO ghost tile, flaggedCount 0 (never pre-emptive)", () => {
    const s = deriveHomeState(signals({ units: 1204, awaitingTriage: 0 }));
    expect(s.showVerifyGhost).toBe(false);
    expect(s.flaggedCount).toBe(0);
    expect(s.tiles).not.toContain("verify_ghost");
  });

  it("no activity panel in BUILT (activity moves inside LIVE)", () => {
    const s = deriveHomeState(signals({ units: 1204, connectionCount: 0 }));
    expect(s.tiles).not.toContain("activity");
  });
});

describe("deriveHomeState — LIVE (graph + ≥1 connection)", () => {
  it("built graph, ≥1 connection → LIVE, ask_prove + activity, 'Ask your graph' CTA", () => {
    const s = deriveHomeState(signals({ units: 1204, connectionCount: 2, latestJob: { id: "j", status: "succeeded" } }));
    expect(s.kind).toBe("live");
    expect(s.tiles).toEqual(["hero", "ask_prove", "activity"]);
    expect(s.primaryCta).toBe("ask_graph");
  });

  it("LIVE surfaces the Verify ghost BETWEEN ask_prove and activity when flagged > 0", () => {
    const s = deriveHomeState(signals({ units: 1204, connectionCount: 2, awaitingTriage: 4 }));
    expect(s.showVerifyGhost).toBe(true);
    expect(s.flaggedCount).toBe(4);
    expect(s.tiles).toEqual(["hero", "ask_prove", "verify_ghost", "activity"]);
  });

  it("LIVE with no flagged claims drops the ghost tile but keeps activity", () => {
    const s = deriveHomeState(signals({ units: 1204, connectionCount: 1, awaitingTriage: 0 }));
    expect(s.showVerifyGhost).toBe(false);
    expect(s.tiles).toEqual(["hero", "ask_prove", "activity"]);
  });

  it("the activity panel is present in LIVE (moved inside this state, plan §3.1)", () => {
    expect(deriveHomeState(signals({ units: 1, connectionCount: 1 })).tiles).toContain("activity");
  });
});

describe("deriveHomeState — boundaries & invariants", () => {
  it("units boundary: exactly 1 unit counts as built; 0 is EMPTY", () => {
    expect(deriveHomeState(signals({ units: 1 })).kind).toBe("built_not_connected");
    expect(deriveHomeState(signals({ units: 0 })).kind).toBe("empty");
  });

  it("connection boundary: 1 connection → LIVE; 0 → BUILT_NOT_CONNECTED", () => {
    expect(deriveHomeState(signals({ units: 5, connectionCount: 1 })).kind).toBe("live");
    expect(deriveHomeState(signals({ units: 5, connectionCount: 0 })).kind).toBe("built_not_connected");
  });

  it("the hero tile is present in EVERY state (persistent landing)", () => {
    const states: HomeStateSignals[] = [
      signals(),
      signals({ latestJob: { id: "j", status: "running" } }),
      signals({ units: 10 }),
      signals({ units: 10, connectionCount: 1 }),
    ];
    for (const s of states) expect(deriveHomeState(s).tiles[0]).toBe("hero");
  });

  it("exactly one primary CTA id per state, drawn from the closed set", () => {
    const ctas = new Set(["add_sources", "view_run", "connect_app", "ask_graph"]);
    const states: HomeStateSignals[] = [
      signals(),
      signals({ latestJob: { id: "j", status: "pending" } }),
      signals({ units: 10 }),
      signals({ units: 10, connectionCount: 1 }),
    ];
    for (const s of states) expect(ctas.has(deriveHomeState(s).primaryCta)).toBe(true);
  });

  it("showVerifyGhost mirrors tiles.includes('verify_ghost') exactly", () => {
    const states: HomeStateSignals[] = [
      signals(),
      signals({ units: 10, awaitingTriage: 0 }),
      signals({ units: 10, awaitingTriage: 3 }),
      signals({ units: 10, connectionCount: 1, awaitingTriage: 3 }),
      signals({ units: 10, connectionCount: 1, awaitingTriage: 0 }),
    ];
    for (const s of states) {
      const st = deriveHomeState(s);
      expect(st.showVerifyGhost).toBe(st.tiles.includes("verify_ghost"));
    }
  });

  it("fractional / negative signals are clamped and rounded (defensive)", () => {
    const s = deriveHomeState(signals({ units: 3.7, awaitingTriage: -2, connectionCount: 1.2 }));
    expect(s.units).toBe(4);
    expect(s.flaggedCount).toBe(0); // -2 clamped to 0 → no ghost
    expect(s.connectionCount).toBe(1);
    expect(s.kind).toBe("live");
  });
});
