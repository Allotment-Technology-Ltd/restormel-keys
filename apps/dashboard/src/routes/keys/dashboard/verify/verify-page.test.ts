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
function card(units = 1204) {
  return {
    trust_score: 88,
    last_verified_at: "2026-06-27T10:00:00.000Z",
    units,
    embedding: { embedded: units },
    evidence: { bound: units, unbound: 0, no_evidence: 0, bound_pct: 100 },
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
  it("renders the confirmation block with the Mark-ready CTA back to Home", async () => {
    const { getByRole, getByText } = render(
      VerifyPage,
      props({
        hub: Promise.resolve(
          hubPayload(
            { units: 1204, validation: { awaiting_triage: 0, ok: 1204 } },
            { stages: [{ id: "make_ready", state: "done" }, { id: "review", state: "done" }] },
          ),
        ),
      }),
    );
    await settle();

    expect(getByRole("heading", { name: "Everything checks out" })).toBeTruthy();
    const cta = getByRole("link", { name: /mark your graph ready/i });
    expect(cta.getAttribute("href")).toContain("/home");
    expect(
      getByText("This records the graph as reviewed and takes you back to Home."),
    ).toBeTruthy();
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

describe("/verify · signed out", () => {
  it("offers the sign-in action instead of workspace content", async () => {
    const { getByRole } = render(VerifyPage, props({ hubSignedIn: false }));
    await settle();
    expect(getByRole("heading", { name: "Sign in to see your workspace" })).toBeTruthy();
    const cta = getByRole("link", { name: "Sign in" });
    expect(cta.getAttribute("href")).toContain("/login");
  });
});
