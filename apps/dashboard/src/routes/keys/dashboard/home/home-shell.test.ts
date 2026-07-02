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

function hubPayload(journey: Partial<HubJourney> = {}) {
  return {
    journey: {
      stats: journey.stats ?? null,
      latestJob: journey.latestJob ?? null,
    },
  };
}

function scorecard(over: { trust_score?: number | null; units?: number } = {}) {
  if (over.trust_score === null) return null;
  return {
    trust_score: over.trust_score ?? 88,
    units: over.units ?? 1204,
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

    // Activity panel INSIDE the state with attributed rows.
    expect(getByRole("heading", { name: "Recent activity" })).toBeTruthy();
    await waitFor(() => expect(getByText(/support-agent asked · 9m ago/)).toBeTruthy());
    expect(getByText(/backend asked · 2h ago/)).toBeTruthy();
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
    const { getByRole } = render(HomePage, livePageProps({ livePulse: null }));
    await settle();
    expect(getByRole("img", { name: /connected — no requests served yet/i })).toBeTruthy();
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

describe("flag OFF — legacy masthead unchanged (smoke)", () => {
  it("renders the legacy operator description + pulse panel; no journey hero", async () => {
    pageData = { moduleFlags: { onboardingJourney: false }, journeySignals: null };
    const { getByText, queryByRole, getByRole } = render(HomePage, pageProps());
    await settle();
    expect(
      getByText("One screen for the daily loop — trust, review queue, last run, and live agent traffic."),
    ).toBeTruthy();
    // The pulse panel still renders OUTSIDE any journey state (legacy position).
    expect(getByRole("heading", { name: "Recent activity" })).toBeTruthy();
    // No journey hero.
    expect(queryByRole("heading", { name: "Your graph" })).toBeNull();
  });
});
