// @vitest-environment jsdom
/**
 * RES-113 PR-3 — the journey Home shell (REC-ADR-022 / copy pack §1).
 *
 * Renders `home/+page.svelte` with the `onboardingJourney` flag ON and asserts
 * the four `deriveHomeState` states compose exactly what the copy pack allows:
 *   • EMPTY: hero + one sentence + ONE yellow CTA — nothing else mounts.
 *   • INGEST_RUNNING: honest run-status naming the copy-pack stage name.
 *   • BUILT_NOT_CONNECTED: Connect primary + ask box (secondary submit) +
 *     Verify ghost tile ONLY when flagged > 0.
 *   • LIVE: ask submit is the yellow primary; activity panel inside this state.
 * Plus: trustScore null ⇒ the stat is ABSENT (never "—"); exactly one yellow
 * primary per state; flag-OFF renders the legacy masthead (byte-identity smoke).
 *
 * ux-contracts §3 states covered: empty / loading (activity) / error (activity)
 * / success. getByRole-first per the accessibility skill.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/svelte";
import { readable } from "svelte/store";
import { tick } from "svelte";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// RES-113 Track A A1: source-scan the component for the hero-settings-link
// hit-target rule (mirrors evidence-dossier.pr6-lines.test.ts) — jsdom does not
// apply scoped <style>, so the 44px floor is asserted against the source.
const HOME_PAGE_SOURCE = readFileSync(resolve(__dirname, "./+page.svelte"), "utf8");

// ── $app mocks ────────────────────────────────────────────────────────────
const gotoSpy = vi.fn();
vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn().mockResolvedValue(undefined),
  goto: (...args: unknown[]) => gotoSpy(...args),
}));

// The page store carries moduleFlags + the hoisted journeySignals (PR-2).
let pageData: Record<string, unknown> = {};
vi.mock("$app/stores", () => ({
  get page() {
    return readable({ data: pageData });
  },
}));

import HomePage from "./+page.svelte";

type HubJourney = {
  stats: { units: number; validation: { awaiting_triage: number } } | null;
  latestJob: { id: string; status: string; currentStage?: string | null } | null;
};

function hubPayload(
  journey: Partial<HubJourney> = {},
  spine: { stages: { id: string; state: string }[] } | null = null,
) {
  return {
    journey: {
      stats: journey.stats ?? null,
      latestJob: journey.latestJob ?? null,
    },
    // RES-113 PR-6a: the Verify ready tile reads the hub spine via
    // `resolveM2SurfaceFromSpine`. Default null (spine unresolved) so the
    // pre-PR-6 fixtures keep asserting an honest no-tile absence.
    spine,
  };
}

/** A spine whose make_ready + review stages are cleared — `resolveM2Surface` reads "ready". */
const SPINE_VERIFY_CLEAR = {
  stages: [
    { id: "make_ready", state: "done" },
    { id: "review", state: "done" },
  ],
};

function scorecard(
  over: { trust_score?: number | null; units?: number; unbound?: number } = {},
) {
  if (over.trust_score === null) return null;
  const units = over.units ?? 1204;
  const unbound = over.unbound ?? 0;
  return {
    trust_score: over.trust_score ?? 88,
    units,
    // RES-113 PR-6 (5-lens review, lens 2): the Verify ready tile's reveal
    // predicate reads the Sources signal too — "All facts are matched to
    // sources." is never asserted while units still need a link.
    evidence: {
      bound: units - unbound,
      unbound,
      no_evidence: 0,
      bound_pct: units > 0 ? Math.round(((units - unbound) / units) * 100) : 0,
    },
  };
}

/** Minimal page data — only the fields the flag-ON branch (and shared shell) read. */
function pageProps(over: Record<string, unknown> = {}) {
  return {
    data: {
      workspaceId: "ws-1",
      projects: [],
      projectsError: null,
      entitlements: null,
      usage: null,
      setup: null,
      livePulse: null,
      contextSignals: { noRouteCount24h: 0, hasAnyRoutePolicyBinding: true },
      connectCompletion: {
        storeConnected: false,
        firstRunStarted: false,
        firstRunCompleted: false,
        agentReady: false,
      },
      connectReadiness: Promise.resolve(null),
      trustStrip: Promise.resolve(null),
      hubSignedIn: true,
      encryptionWarning: false,
      hub: Promise.resolve(hubPayload()),
      graphPulse: Promise.resolve(null),
      scorecard: Promise.resolve(null),
      qualityHistory: Promise.resolve([]),
      graphName: null,
      homeActivity: Promise.resolve([]),
      hasAppTraffic24h: false,
      ...over,
      // Cast: the fixture carries only the fields the flag-ON branch reads —
      // the full ConnectHubPayload shape is irrelevant to these render tests.
    } as never,
  };
}

function setJourneyPageData(over: Record<string, unknown> = {}) {
  pageData = {
    moduleFlags: { onboardingJourney: true },
    journeySignals: {
      integrationCount: 0,
      gatewayKeyCount: 0,
      sourceCount: 12,
      completedRunCount: 1,
      flaggedClaimCount: 0,
      connectionCount: 0,
    },
    ...over,
  };
}

/** Resolve the {#await Promise.all([scorecard, hub])} swap. */
async function settle() {
  await tick();
  await new Promise((r) => setTimeout(r, 0));
  await tick();
}

beforeEach(() => {
  gotoSpy.mockClear();
});

describe("HOME · EMPTY (flag ON)", () => {
  it("renders hero + one sentence + ONE yellow CTA and nothing else", async () => {
    setJourneyPageData();
    const { getByRole, queryByRole, queryByText, container } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(hubPayload({ stats: { units: 0, validation: { awaiting_triage: 0 } } })),
      }),
    );
    await settle();

    // Hero: plain "Your graph" title, NOT CONNECTED chip, NO metric row.
    expect(getByRole("heading", { name: "Your graph" })).toBeTruthy();
    expect(getByRole("img", { name: /not connected — no app is using this graph yet/i })).toBeTruthy();
    expect(container.querySelector(".hero-metrics")).toBeNull();

    // The invitation (copy pack §1.1) with the single primary CTA.
    expect(getByRole("heading", { name: "Turn your documents into answers you can check" })).toBeTruthy();
    const cta = getByRole("link", { name: "Add your documents" });
    expect(cta.className).toContain("btn-primary");
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);
    expect(queryByText("Usually a few minutes from first document to first answer.")).toBeTruthy();

    // NOTHING else mounts: no ask box, no Verify tile, no activity, no ledger/scorecard.
    expect(queryByRole("textbox", { name: "Your question" })).toBeNull();
    expect(queryByText(/couldn't be matched to a source yet/)).toBeNull();
    expect(queryByRole("heading", { name: /recent activity/i })).toBeNull();
    expect(queryByRole("heading", { name: /^trust$/i })).toBeNull();
  });
});

describe("HOME · INGEST_RUNNING (flag ON)", () => {
  it("names the real stage in copy-pack language inside a status region", async () => {
    setJourneyPageData();
    const { getByRole, getByText, container } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(
          hubPayload({
            stats: { units: 0, validation: { awaiting_triage: 0 } },
            latestJob: { id: "job-1", status: "running", currentStage: "extracting" },
          }),
        ),
      }),
    );
    await settle();

    expect(getByRole("heading", { name: "Building your graph" })).toBeTruthy();
    const status = getByRole("status");
    expect(status.textContent).toContain("Reading your documents… usually 1–3 minutes.");
    const cta = getByRole("link", { name: "View progress" });
    expect(cta.getAttribute("href")).toContain("/runs/job-1");
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);
    expect(getByText("You can leave this page — we'll keep working and show progress here.")).toBeTruthy();
  });

  it("falls back to 'Getting ready' for an internal stage — engineering names never leak", async () => {
    setJourneyPageData();
    const { getByRole } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(
          hubPayload({
            stats: { units: 0, validation: { awaiting_triage: 0 } },
            latestJob: { id: "job-2", status: "pending", currentStage: "storing" },
          }),
        ),
      }),
    );
    await settle();
    expect(getByRole("status").textContent).toContain("Getting ready… usually 1–3 minutes.");
  });
});

describe("HOME · BUILT_NOT_CONNECTED (flag ON)", () => {
  it("shows real counts, Connect primary, secondary ask submit, and NO Verify tile at flagged=0", async () => {
    setJourneyPageData();
    const { getByRole, getByText, queryByText, container } = render(
      HomePage,
      pageProps({
        graphName: "acme-graph",
        scorecard: Promise.resolve(scorecard({ trust_score: 88, units: 1204 })),
        hub: Promise.resolve(hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 0 } } })),
      }),
    );
    await settle();

    // Hero: real graph name + real counts + quoted trust score.
    expect(getByRole("heading", { name: "acme-graph" })).toBeTruthy();
    expect(getByText("1,204 facts")).toBeTruthy();
    expect(getByText("12 sources")).toBeTruthy();
    expect(getByText(/trust score 88/)).toBeTruthy();

    // One yellow primary: Connect. Ask submit is secondary-styled.
    const connect = getByRole("link", { name: "Connect your app or agent" });
    expect(connect.className).toContain("btn-primary");
    const ask = getByRole("button", { name: "Ask" });
    expect(ask.className).toContain("btn-outline");
    expect(ask.className).not.toContain("btn-primary");
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);

    // Ask box anatomy (copy pack §1.3): visible label + helper, empty placeholder.
    const input = getByRole("textbox", { name: "Your question" });
    expect(input.getAttribute("placeholder")).toBeNull();
    expect(getByText("Every answer comes with citations — links to the exact passages it came from.")).toBeTruthy();

    // No Verify tile when nothing is flagged; no activity panel outside LIVE.
    expect(queryByText(/couldn't be matched to a source yet/)).toBeNull();
    expect(container.querySelector(".activity-panel")).toBeNull();
  });

  it("mounts the ghost Verify tile ONLY when flagged > 0 (reveal predicate)", async () => {
    setJourneyPageData();
    const { getByRole, getByText } = render(
      HomePage,
      pageProps({
        graphName: "acme-graph",
        scorecard: Promise.resolve(scorecard({ units: 1204 })),
        hub: Promise.resolve(hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 6 } } })),
      }),
    );
    await settle();
    expect(getByText("6 facts couldn't be matched to a source yet.")).toBeTruthy();
    const link = getByRole("link", { name: "Review 6 facts" });
    expect(link.getAttribute("href")).toContain("/verify");
    // Ghost, never a button: no primary styling anywhere near it.
    expect(link.className).not.toContain("btn-primary");
  });

  it("singular tile copy at flagged=1", async () => {
    setJourneyPageData();
    const { getByRole, getByText } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(scorecard({ units: 10 })),
        hub: Promise.resolve(hubPayload({ stats: { units: 10, validation: { awaiting_triage: 1 } } })),
      }),
    );
    await settle();
    expect(getByText("1 fact couldn't be matched to a source yet.")).toBeTruthy();
    expect(getByRole("link", { name: "Review 1 fact" })).toBeTruthy();
  });

  it("mounts the ghost READY tile when verify work is cleared (spine-derived, copy pack §3.4)", async () => {
    // RES-113 PR-6a: `resolveM2SurfaceFromSpine` reads "ready" → the ok ghost tile.
    setJourneyPageData();
    const { getByRole, getByText, container } = render(
      HomePage,
      pageProps({
        graphName: "acme-graph",
        scorecard: Promise.resolve(scorecard({ units: 1204 })),
        hub: Promise.resolve(
          hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 0 } } }, SPINE_VERIFY_CLEAR),
        ),
      }),
    );
    await settle();
    expect(getByText("All facts are matched to sources.")).toBeTruthy();
    const link = getByRole("link", { name: "Open Verify" });
    expect(link.getAttribute("href")).toContain("/verify");
    // Ghost, never a second primary — Connect keeps the one yellow CTA.
    expect(link.className).not.toContain("btn-primary");
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);
  });

  it("renders NO ready tile while units still need a link — spine-clear alone never asserts 'all matched to sources'", async () => {
    // 5-lens review (lens 2, CONFIRMED): the spine stages never check evidence
    // binding — the ready tile's completion claim needs the Sources signal too.
    setJourneyPageData();
    const { queryByText } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(scorecard({ units: 1204, unbound: 12 })),
        hub: Promise.resolve(
          hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 0 } } }, SPINE_VERIFY_CLEAR),
        ),
      }),
    );
    await settle();
    expect(queryByText("All facts are matched to sources.")).toBeNull();
    expect(queryByText("Open Verify")).toBeNull();
  });

  it("renders NO ready tile when the scorecard is unreadable (honest absence — the Sources signal is unknown)", async () => {
    setJourneyPageData();
    const { queryByText } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(
          hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 0 } } }, SPINE_VERIFY_CLEAR),
        ),
      }),
    );
    await settle();
    expect(queryByText("All facts are matched to sources.")).toBeNull();
    expect(queryByText("Open Verify")).toBeNull();
  });

  it("renders NO ready tile when the spine is unresolved (honest absence, never a fabricated 'all matched')", async () => {
    setJourneyPageData();
    const { queryByText } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(scorecard({ units: 1204 })),
        // spine defaults to null in the fixture — unresolved.
        hub: Promise.resolve(hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 0 } } })),
      }),
    );
    await settle();
    expect(queryByText("All facts are matched to sources.")).toBeNull();
    expect(queryByText("Open Verify")).toBeNull();
  });

  it("the triage tile wins over the ready tile while facts are flagged", async () => {
    setJourneyPageData();
    const { getByText, queryByText } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(scorecard({ units: 1204 })),
        hub: Promise.resolve(
          hubPayload(
            { stats: { units: 1204, validation: { awaiting_triage: 6 } } },
            { stages: [{ id: "make_ready", state: "done" }, { id: "review", state: "current" }] },
          ),
        ),
      }),
    );
    await settle();
    expect(getByText("6 facts couldn't be matched to a source yet.")).toBeTruthy();
    expect(queryByText("All facts are matched to sources.")).toBeNull();
  });

  it("trustScore null ⇒ the stat is ABSENT — never a placeholder dash", async () => {
    setJourneyPageData();
    const { getByText, queryByText } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(null), // no scorecard at all
        hub: Promise.resolve(hubPayload({ stats: { units: 42, validation: { awaiting_triage: 0 } } })),
      }),
    );
    await settle();
    expect(getByText("42 facts")).toBeTruthy();
    expect(queryByText(/trust score/)).toBeNull();
    expect(queryByText("—")).toBeNull();
  });
});

describe("HOME · LIVE (flag ON)", () => {
  function livePageProps(over: Record<string, unknown> = {}) {
    return pageProps({
      graphName: "acme-graph",
      scorecard: Promise.resolve(scorecard({ units: 1204 })),
      hub: Promise.resolve(hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 0 } } })),
      // The chip's traffic signal is the server's ingest-EXCLUDED 24h probe —
      // NOT livePulse.requestCount24h (which counts the pipeline's own writes).
      hasAppTraffic24h: true,
      livePulse: {
        requestCount24h: 9,
        errorRate: 0,
        p50LatencyMs: null,
        p95LatencyMs: null,
        avgLatencyMs: null,
        topRoute: null,
        analyticsUnavailable: false,
      },
      ...over,
    });
  }

  it("promotes the ask submit to the ONE yellow primary and moves activity inside LIVE", async () => {
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 2,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 2,
      },
    });
    const { getByRole, getByText, container } = render(
      HomePage,
      livePageProps({
        homeActivity: Promise.resolve([
          { id: "r1", connectionName: "support-agent", createdAt: Date.now() - 9 * 60000 },
          { id: "r2", connectionName: "backend", createdAt: Date.now() - 2 * 3600000 },
        ]),
      }),
    );
    await settle();

    // LIVE chip from REAL observed traffic.
    expect(getByRole("img", { name: /live — serving answers to your app/i })).toBeTruthy();

    // Ask box heading + yellow primary submit — the only primary in the state.
    expect(getByRole("heading", { name: "Ask your graph" })).toBeTruthy();
    const ask = getByRole("button", { name: "Ask" });
    expect(ask.className).toContain("btn-primary");
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);

    // Connect tile (ghost) with plural copy.
    expect(getByText("Connected · 2 connections")).toBeTruthy();
    expect(getByRole("link", { name: "Manage connections" })).toBeTruthy();

    // Activity panel INSIDE the state with attributed rows. Heading authored
    // uppercase — the copy pack §1.4 literal is `RECENT ACTIVITY` (X12 label).
    expect(getByRole("heading", { name: "RECENT ACTIVITY" })).toBeTruthy();
    await waitFor(() => expect(getByText(/support-agent asked · 9m ago/)).toBeTruthy());
    expect(getByText(/backend asked · 2h ago/)).toBeTruthy();
  });

  it("mounts the ghost READY tile inside LIVE too when the spine reads verify-clear (PR-6a)", async () => {
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 1,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 1,
      },
    });
    const { getByRole, getByText, container } = render(
      HomePage,
      livePageProps({
        hub: Promise.resolve(
          hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 0 } } }, SPINE_VERIFY_CLEAR),
        ),
        homeActivity: Promise.resolve([]),
      }),
    );
    await settle();
    expect(getByText("All facts are matched to sources.")).toBeTruthy();
    expect(getByRole("link", { name: "Open Verify" })).toBeTruthy();
    // The ask submit stays the ONE yellow primary.
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);
  });

  it("activity empty state (copy pack §1.4)", async () => {
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 1,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 1,
      },
    });
    const { getByText } = render(HomePage, livePageProps({ homeActivity: Promise.resolve([]) }));
    await settle();
    await waitFor(() =>
      expect(getByText("No requests yet. When your app asks a question, it shows up here.")).toBeTruthy(),
    );
    // Singular connect tile copy.
    expect(getByText("Connected · 1 connection")).toBeTruthy();
  });

  it("activity error state offers a recovery action (ux-contracts §3 floor)", async () => {
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 1,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 1,
      },
    });
    const { getByRole, getByText } = render(
      HomePage,
      livePageProps({ homeActivity: Promise.resolve(null) }),
    );
    await settle();
    await waitFor(() => expect(getByText("We couldn't load recent activity. Try again.")).toBeTruthy());
    expect(getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("CONNECTED (not LIVE) chip when a connection exists but no traffic observed", async () => {
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 1,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 1,
      },
    });
    const { getByRole } = render(
      HomePage,
      livePageProps({ hasAppTraffic24h: false, livePulse: null }),
    );
    await settle();
    expect(getByRole("img", { name: /connected — no requests served yet/i })).toBeTruthy();
  });

  it("chip stays CONNECTED when 24h traffic is ingest-only — livePulse counts it, the chip must not", async () => {
    // 5-lens review fix (honesty rule): the pipeline writes a request log per
    // ingest resolve, so livePulse.requestCount24h > 0 after a mere rebuild.
    // The chip's signal is the ingest-EXCLUDED probe — with it false, the chip
    // and the activity panel below agree ("no requests yet"), never contradict.
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 1,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 1,
      },
    });
    const { getByRole, getByText, queryByRole } = render(
      HomePage,
      livePageProps({ hasAppTraffic24h: false, homeActivity: Promise.resolve([]) }),
    );
    await settle();
    expect(getByRole("img", { name: /connected — no requests served yet/i })).toBeTruthy();
    expect(queryByRole("img", { name: /live — serving answers to your app/i })).toBeNull();
    await waitFor(() =>
      expect(getByText("No requests yet. When your app asks a question, it shows up here.")).toBeTruthy(),
    );
  });

  it("activity swap carries aria-busy on the panel and announces the outcome via the persistent status region", async () => {
    // a11y skill loading-semantics row (5-lens review fix): aria-busy on the ONE
    // container being replaced, outcome announced through the persistent
    // role="status" region (a region born inside the swap would never announce).
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 1,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 1,
      },
    });
    let resolveActivity!: (rows: unknown) => void;
    const deferred = new Promise((r) => (resolveActivity = r));
    const { container, getByRole } = render(
      HomePage,
      livePageProps({ homeActivity: deferred }),
    );
    await settle();

    const panel = container.querySelector(".activity-panel")!;
    expect(panel.getAttribute("aria-busy")).toBe("true");

    resolveActivity([]);
    await settle();
    expect(panel.getAttribute("aria-busy")).toBe("false");
    expect(getByRole("status").textContent).toContain(
      "No requests yet. When your app asks a question, it shows up here.",
    );
  });

  it("activity failure arriving after mount is announced via the persistent status region", async () => {
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 1,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 1,
      },
    });
    let resolveActivity!: (rows: unknown) => void;
    const deferred = new Promise((r) => (resolveActivity = r));
    const { getByRole } = render(HomePage, livePageProps({ homeActivity: deferred }));
    await settle();
    resolveActivity(null); // the load's failure contract: resolves null, never rejects
    await settle();
    expect(getByRole("status").textContent).toContain(
      "We couldn't load recent activity. Try again.",
    );
  });

  it("activity retry relocates focus to the remounted panel heading (never <body>)", async () => {
    // a11y skill "no focus loss" (5-lens review fix): invalidateAll unmounts the
    // retry button with everything else; focus must land on the REMOUNTED
    // content, not drop to <body>.
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 1,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 1,
      },
    });
    const { getByRole, rerender } = render(
      HomePage,
      livePageProps({ homeActivity: Promise.resolve(null) }),
    );
    await settle();
    await waitFor(() => expect(getByRole("button", { name: "Try again" })).toBeTruthy());

    getByRole("button", { name: "Try again" }).click();
    await settle();
    // invalidateAll (mocked) hands the page NEW promises — simulate the data swap.
    await rerender(
      livePageProps({
        homeActivity: Promise.resolve([
          { id: "r1", connectionName: "support-agent", createdAt: Date.now() - 60000 },
        ]),
      }),
    );
    await settle();

    const heading = getByRole("heading", { name: "RECENT ACTIVITY" });
    expect(document.activeElement).toBe(heading);
  });

  it("submitting a question hands off to the Answer Console with ?q=", async () => {
    setJourneyPageData({
      journeySignals: {
        integrationCount: 0,
        gatewayKeyCount: 1,
        sourceCount: 12,
        completedRunCount: 1,
        flaggedClaimCount: 0,
        connectionCount: 1,
      },
    });
    const { getByRole } = render(HomePage, livePageProps());
    await settle();
    const input = getByRole("textbox", { name: "Your question" }) as HTMLInputElement;
    input.value = "What does the contract say about renewals?";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    const form = input.closest("form")!;
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    expect(gotoSpy).toHaveBeenCalledTimes(1);
    const target = String(gotoSpy.mock.calls[0][0]);
    expect(target).toContain("/prove/proof?q=");
    expect(target).toContain(encodeURIComponent("What does the contract say about renewals?"));
  });
});

describe("HOME · journey shell load failure (flag ON)", () => {
  it("a REJECTED workspace load renders the recovery banner — never a dead skeleton", async () => {
    // ux-contracts §3 floor (5-lens review fix): data.hub resolves null on
    // failure, but the scorecard load can reject — the {:catch} branch must
    // offer the same error + retry as the null-hub branch.
    setJourneyPageData();
    const rejected = Promise.reject(new Error("scorecard store unavailable"));
    rejected.catch(() => {}); // pre-observed: the test owns this rejection
    const { getByText, getByRole } = render(HomePage, pageProps({ scorecard: rejected }));
    await settle();

    expect(getByText("Workspace unavailable")).toBeTruthy();
    expect(
      getByText("Could not load your workspace. Your data is unaffected — this is a load failure."),
    ).toBeTruthy();
    expect(getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("journey retry relocates focus to the remounted content (never <body>)", async () => {
    // a11y skill "no focus loss" (5-lens review fix): after retry, the new data
    // remounts the whole journey branch — focus lands on the remounted hero
    // heading (recovery succeeded), not on <body>.
    setJourneyPageData();
    const { getByText, getByRole, rerender } = render(
      HomePage,
      pageProps({ scorecard: Promise.resolve(null), hub: Promise.resolve(null) }),
    );
    await settle();
    expect(getByText("Workspace unavailable")).toBeTruthy();

    getByRole("button", { name: "Try again" }).click();
    await settle();
    // invalidateAll (mocked) hands the page NEW promises — simulate the data swap.
    await rerender(
      pageProps({
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(
          hubPayload({ stats: { units: 0, validation: { awaiting_triage: 0 } } }),
        ),
      }),
    );
    await settle();

    const hero = getByRole("heading", { name: "Your graph" });
    expect(document.activeElement).toBe(hero);
  });

  it("journey retry lands on the remounted error region when the failure persists", async () => {
    setJourneyPageData();
    const { getByText, getByRole, rerender, container } = render(
      HomePage,
      pageProps({ scorecard: Promise.resolve(null), hub: Promise.resolve(null) }),
    );
    await settle();
    getByRole("button", { name: "Try again" }).click();
    await settle();
    await rerender(pageProps({ scorecard: Promise.resolve(null), hub: Promise.resolve(null) }));
    await settle();

    expect(getByText("Workspace unavailable")).toBeTruthy();
    expect(document.activeElement).toBe(container.querySelector(".journey-error"));
  });
});

describe("flag OFF — legacy masthead unchanged (smoke)", () => {
  it("renders the legacy operator description + pulse panel; no journey hero", async () => {
    pageData = { moduleFlags: { onboardingJourney: false }, journeySignals: null };
    const { getByText, queryByRole, getByRole, queryByText } = render(HomePage, pageProps());
    await settle();
    expect(
      getByText("One screen for the daily loop — trust, review queue, last run, and live agent traffic."),
    ).toBeTruthy();
    // The pulse panel still renders OUTSIDE any journey state (legacy position).
    expect(getByRole("heading", { name: "Recent activity" })).toBeTruthy();
    // No journey hero.
    expect(queryByRole("heading", { name: "Your graph" })).toBeNull();
    // RES-113 Track A A1: the hero "Workspace settings" link lives INSIDE the
    // flag-ON `{#if onboardingJourney}` hero — it must be structurally absent
    // flag-OFF (byte-identity guard for the legacy masthead).
    expect(queryByText("Workspace settings")).toBeNull();
  });
});

describe("HOME · hero 'Workspace settings' link (Track A A1, flag ON)", () => {
  const A1_ARIA = "Workspace settings — providers, store, graph, routes, audit";

  // The four HomeState renders — the link is state-independent chrome above the
  // `home.kind` switch, so it must resolve identically in every one.
  const STATES: { name: string; over: Record<string, unknown> }[] = [
    {
      name: "EMPTY",
      over: {
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(hubPayload({ stats: { units: 0, validation: { awaiting_triage: 0 } } })),
      },
    },
    {
      name: "INGEST_RUNNING",
      over: {
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(
          hubPayload({
            stats: { units: 0, validation: { awaiting_triage: 0 } },
            latestJob: { id: "job-1", status: "running", currentStage: "extracting" },
          }),
        ),
      },
    },
    {
      name: "BUILT_NOT_CONNECTED",
      over: {
        graphName: "acme-graph",
        scorecard: Promise.resolve(scorecard({ trust_score: 88, units: 1204 })),
        hub: Promise.resolve(hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 0 } } })),
      },
    },
    {
      name: "LIVE",
      over: {
        graphName: "acme-graph",
        scorecard: Promise.resolve(scorecard({ units: 1204 })),
        hub: Promise.resolve(hubPayload({ stats: { units: 1204, validation: { awaiting_triage: 0 } } })),
        hasAppTraffic24h: true,
        homeActivity: Promise.resolve([]),
      },
    },
  ];

  for (const state of STATES) {
    it(`is present and targets /integrations in ${state.name}`, async () => {
      setJourneyPageData(
        state.name === "LIVE"
          ? {
              journeySignals: {
                integrationCount: 0,
                gatewayKeyCount: 2,
                sourceCount: 12,
                completedRunCount: 1,
                flaggedClaimCount: 0,
                connectionCount: 2,
              },
            }
          : {},
      );
      const { getByRole } = render(HomePage, pageProps(state.over));
      await settle();
      const link = getByRole("link", { name: A1_ARIA });
      expect(link.getAttribute("href")).toMatch(/\/integrations$/);
    });
  }

  it("aria-label CONTAINS the visible text verbatim (WCAG 2.5.3 Label-in-Name)", async () => {
    setJourneyPageData();
    const { getByRole } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(hubPayload({ stats: { units: 0, validation: { awaiting_triage: 0 } } })),
      }),
    );
    await settle();
    const link = getByRole("link", { name: A1_ARIA });
    expect(link.textContent?.trim()).toBe("Workspace settings");
    expect(link.getAttribute("aria-label")).toContain("Workspace settings");
  });

  it("carries the visible focus ring class and a ≥44px hit target (net-new focusable a11y floor)", async () => {
    setJourneyPageData();
    const { getByRole } = render(
      HomePage,
      pageProps({
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(hubPayload({ stats: { units: 0, validation: { awaiting_triage: 0 } } })),
      }),
    );
    await settle();
    const link = getByRole("link", { name: A1_ARIA });
    // Focus ring: the shared brut-focus utility (paired with an ink band in the
    // scoped `.hero-settings-link:focus-visible` rule for 3:1 on cream).
    expect(link.className).toContain("brut-focus");
    // Hit target: jsdom applies no scoped CSS, so pin the 44px floor at source.
    expect(HOME_PAGE_SOURCE).toMatch(/\.hero-settings-link\s*\{[^}]*min-height:\s*44px/);
  });
});
