// @vitest-environment jsdom
/**
 * RES-113 PR-6b — the `/verify` page shell (plan §3.3; copy pack §3).
 *
 * Renders `verify/+page.svelte` (flag-ON only by construction — the server load
 * 404s flag-OFF) and asserts the `resolveM2SurfaceFromSpine` switch:
 *   • hidden  → dashed empty card + ONE CTA to Build; zero gate apparatus.
 *   • triage  → the queue-led hub with its single primary CTA.
 *   • ready   → confirmation block + Mark-ready CTA.
 *   • unresolved spine / hub failure → load-failure banner + recovery action.
 *   • signed out → sign-in panel.
 *
 * ux-contracts §3 states covered: empty / error / success. getByRole-first per
 * the accessibility skill.
 */
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";

vi.mock("$app/navigation", () => ({
  invalidateAll: vi.fn().mockResolvedValue(undefined),
}));

import VerifyPage from "./+page.svelte";

type Stats = { units: number; embedded?: number; validation: { awaiting_triage: number; ok?: number; weak?: number; unsupported?: number; unvalidated?: number; unsupported_untriaged?: number } };

function hubPayload(
  stats: Stats | null,
  spine: { stages: { id: string; state: string }[] } | null,
) {
  return {
    journey: {
      stats: stats
        ? {
            units: stats.units,
            embedded: stats.embedded ?? stats.units,
            validation: {
              ok: stats.validation.ok ?? 0,
              weak: stats.validation.weak ?? 0,
              unsupported: stats.validation.unsupported ?? 0,
              unvalidated: stats.validation.unvalidated ?? 0,
              awaiting_triage: stats.validation.awaiting_triage,
              unsupported_untriaged: stats.validation.unsupported_untriaged ?? 0,
            },
          }
        : null,
      latestJob: null,
    },
    readiness: null,
    spine,
  };
}

/** Minimal streamed scorecard — the fields `makeReadySignals` reads. */
function card(units = 1204, evidence?: { unbound: number; no_evidence: number }) {
  const unbound = evidence?.unbound ?? 0;
  const noEv = evidence?.no_evidence ?? 0;
  return {
    trust_score: 88,
    last_verified_at: "2026-06-27T10:00:00.000Z",
    units,
    embedding: { embedded: units },
    evidence: {
      bound: units - unbound - noEv,
      unbound,
      no_evidence: noEv,
      bound_pct: Math.round(((units - unbound - noEv) / Math.max(1, units)) * 100),
    },
    score_factors: [],
    verification_states: {},
  };
}

function props(over: Record<string, unknown> = {}) {
  return {
    data: {
      hubSignedIn: true,
      hub: Promise.resolve(null),
      scorecard: Promise.resolve(null),
      ...over,
      // Cast: the fixture carries only the fields the page reads.
    } as never,
  };
}

/** Resolve the {#await Promise.all([scorecard, hub])} swap. */
async function settle() {
  await tick();
  await new Promise((r) => setTimeout(r, 0));
  await tick();
}

describe("/verify · HIDDEN (copy pack §3.1)", () => {
  it("renders the dashed empty card with ONE CTA to Build and zero gate apparatus", async () => {
    const { getByRole, getByText, queryByTestId, queryByText, container } = render(
      VerifyPage,
      props({
        hub: Promise.resolve(
          hubPayload({ units: 0, validation: { awaiting_triage: 0 } }, null),
        ),
      }),
    );
    await settle();

    expect(getByRole("heading", { name: "Nothing to check yet" })).toBeTruthy();
    expect(
      getByText(
        "Once your graph — your documents, connected — is built, anything we couldn't fully match to your documents appears here for a quick review.",
      ),
    ).toBeTruthy();
    const cta = getByRole("link", { name: "Go to Build" });
    expect(cta.getAttribute("href")).toContain("/build");
    expect(cta.className).toContain("btn-primary");
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);

    // Zero M2 apparatus: no hub, no gates, no disclosure, no trust line.
    expect(queryByTestId("m2-verify-hub")).toBeNull();
    expect(queryByText("Show the full scorecard")).toBeNull();
    expect(queryByText(/Trust score/)).toBeNull();
  });
});

describe("/verify · TRIAGE (copy pack §3.2)", () => {
  it("renders the queue-led hub with the single primary CTA honouring the priority rule", async () => {
    const { getByRole, getByText, container } = render(
      VerifyPage,
      props({
        scorecard: Promise.resolve(card()),
        hub: Promise.resolve(
          hubPayload(
            { units: 1204, validation: { awaiting_triage: 6, ok: 1198 } },
            { stages: [{ id: "make_ready", state: "done" }, { id: "review", state: "current" }] },
          ),
        ),
      }),
    );
    await settle();

    expect(getByRole("heading", { name: "6 facts need your review" })).toBeTruthy();
    // The trust line quotes the streamed scorecard verbatim (copy pack §3.2).
    expect(
      getByText("Trust score 88 of 100 — how strongly your answers are backed by your documents."),
    ).toBeTruthy();
    expect(
      getByText("Sources and searchability checked automatically — nothing needed from you."),
    ).toBeTruthy();
    const cta = getByRole("link", { name: /review the first claim/i });
    expect(cta.className).toContain("btn-primary");
    expect(container.querySelectorAll(".btn-primary").length).toBe(1);
    expect(getByText("Show the full scorecard")).toBeTruthy();
  });
});

describe("/verify · READY (copy pack §3.3)", () => {
  const SPINE_CLEAR = {
    stages: [{ id: "make_ready", state: "done" }, { id: "review", state: "done" }],
  };

  it("renders the confirmation block with the interim Back-to-Home CTA (mark-ready strings deferred to PR-J)", async () => {
    const { getByRole, getByText, queryByText } = render(
      VerifyPage,
      props({
        scorecard: Promise.resolve(card()),
        hub: Promise.resolve(
          hubPayload({ units: 1204, validation: { awaiting_triage: 0, ok: 1204 } }, SPINE_CLEAR),
        ),
      }),
    );
    await settle();

    expect(getByRole("heading", { name: "Everything checks out" })).toBeTruthy();
    expect(
      getByText(
        "All 1,204 facts are matched to sources, searchable, and reviewed. Your graph is ready for real questions.",
      ),
    ).toBeTruthy();
    // No fabricated action (5-lens review, lens 5): until PR-J wires the real
    // recompute, the CTA is the honest "Back to Home" and the "records the
    // graph as reviewed" sub-line never renders.
    const cta = getByRole("link", { name: /back to home/i });
    expect(cta.getAttribute("href")).toContain("/home");
    expect(queryByText(/mark your graph ready/i)).toBeNull();
    expect(
      queryByText("This records the graph as reviewed and takes you back to Home."),
    ).toBeNull();
  });

  it("spine clear but units still need a link → TRIAGE with Sources leading, never 'matched to sources'", async () => {
    // 5-lens review (lens 2, CONFIRMED): the spine stages never check evidence
    // binding, so spine done/done with unbound units must NOT headline a
    // completion the disclosure's own scorecard contradicts.
    const { getByRole, queryByRole, getByTestId } = render(
      VerifyPage,
      props({
        scorecard: Promise.resolve(card(1204, { unbound: 12, no_evidence: 0 })),
        hub: Promise.resolve(
          hubPayload({ units: 1204, validation: { awaiting_triage: 0, ok: 1204 } }, SPINE_CLEAR),
        ),
      }),
    );
    await settle();

    expect(queryByRole("heading", { name: "Everything checks out" })).toBeNull();
    expect(getByRole("heading", { name: "12 facts need your review" })).toBeTruthy();
    expect(getByTestId("verify-lead-gate").getAttribute("data-gate")).toBe("sources");
    // The one CTA names AND opens the Sources fix surface (lens 3 + 5 fixes).
    const cta = getByRole("link", { name: /link facts to sources/i });
    expect(cta.getAttribute("href")).toContain("workspace=tools");
    expect(cta.getAttribute("href")).not.toContain("focus=sources");
  });

  it("scorecard unreadable on a BUILT graph → the load-failure state, never 'Building your graph' dressed over a failed read", async () => {
    // 5-lens review (lens 2, minor): card null with the hub loaded is a partial
    // read failure — name it (REC-ADR-016), don't render an indefinite
    // still-working line.
    const { getByText, queryByRole, getByRole } = render(
      VerifyPage,
      props({
        scorecard: Promise.resolve(null),
        hub: Promise.resolve(
          hubPayload({ units: 1204, validation: { awaiting_triage: 0, ok: 1204 } }, SPINE_CLEAR),
        ),
      }),
    );
    await settle();

    expect(getByText("Workspace unavailable")).toBeTruthy();
    expect(getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(queryByRole("heading", { name: "Building your graph" })).toBeNull();
    expect(queryByRole("heading", { name: "Everything checks out" })).toBeNull();
  });
});

describe("/verify · load failure (ux-contracts §3 floor)", () => {
  it("hub payload unavailable → banner + ONE recovery action", async () => {
    const { getByText, getByRole } = render(VerifyPage, props({ hub: Promise.resolve(null) }));
    await settle();
    expect(getByText("Workspace unavailable")).toBeTruthy();
    expect(
      getByText("Could not load your workspace. Your data is unaffected — this is a load failure."),
    ).toBeTruthy();
    expect(getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("unresolved spine on a built graph → the SAME load-failure state, never a fabricated ready", async () => {
    const { getByText, queryByRole } = render(
      VerifyPage,
      props({
        hub: Promise.resolve(hubPayload({ units: 1204, validation: { awaiting_triage: 0 } }, null)),
      }),
    );
    await settle();
    expect(getByText("Workspace unavailable")).toBeTruthy();
    expect(queryByRole("heading", { name: "Everything checks out" })).toBeNull();
  });

  it("a rejecting load → banner + recovery action (the {:catch} branch)", async () => {
    const rejecting = Promise.reject(new Error("boom"));
    rejecting.catch(() => {}); // avoid unhandled-rejection noise
    const { getByText, getByRole } = render(VerifyPage, props({ hub: rejecting }));
    await settle();
    expect(getByText("Workspace unavailable")).toBeTruthy();
    expect(getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});

describe("/verify · retry focus relocation (a11y skill 'no focus loss')", () => {
  // 5-lens review (lens 4, Major): `invalidateAll` swaps the whole {#await}
  // branch, destroying the focused "Try again" button — focus must land on the
  // REMOUNTED content on BOTH outcomes (home-shell.test.ts pins the same
  // contract for Home), never drop to <body>.
  it("a successful retry relocates focus to the remounted hub heading — never <body>", async () => {
    const { getByRole, rerender } = render(VerifyPage, props({ hub: Promise.resolve(null) }));
    await settle();

    getByRole("button", { name: "Try again" }).click();
    await settle();
    // invalidateAll (mocked) hands the page NEW promises — simulate the data swap.
    await rerender(
      props({
        scorecard: Promise.resolve(card()),
        hub: Promise.resolve(
          hubPayload(
            { units: 1204, validation: { awaiting_triage: 6, ok: 1198 } },
            { stages: [{ id: "make_ready", state: "done" }, { id: "review", state: "current" }] },
          ),
        ),
      }),
    );
    await settle();

    const heading = getByRole("heading", { name: "6 facts need your review" });
    expect(document.activeElement).toBe(heading);
  });

  it("a retry that lands on the empty state relocates focus to the empty-card heading", async () => {
    const { getByRole, rerender } = render(VerifyPage, props({ hub: Promise.resolve(null) }));
    await settle();

    getByRole("button", { name: "Try again" }).click();
    await settle();
    await rerender(
      props({
        hub: Promise.resolve(hubPayload({ units: 0, validation: { awaiting_triage: 0 } }, null)),
      }),
    );
    await settle();

    const heading = getByRole("heading", { name: "Nothing to check yet" });
    expect(document.activeElement).toBe(heading);
  });

  it("a retry that fails again relocates focus to the remounted error region", async () => {
    const { getByRole, rerender } = render(VerifyPage, props({ hub: Promise.resolve(null) }));
    await settle();

    getByRole("button", { name: "Try again" }).click();
    await settle();
    await rerender(props({ hub: Promise.resolve(null) }));
    await settle();

    expect(document.activeElement).not.toBe(document.body);
    expect((document.activeElement as HTMLElement).className).toContain("verify-error");
  });
});

describe("/verify · signed out", () => {
  it("offers the sign-in action instead of workspace content", async () => {
    const { getByRole } = render(VerifyPage, props({ hubSignedIn: false }));
    await settle();
    expect(getByRole("heading", { name: "Sign in to see your workspace" })).toBeTruthy();
    const cta = getByRole("link", { name: "Sign in" });
    expect(cta.getAttribute("href")).toContain("/login");
  });
});
