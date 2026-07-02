// @vitest-environment jsdom
/**
 * RES-113 PR-6 — the queue-led M2 Verify hub (copy pack §3.2/§3.3).
 *
 * ux-contracts §3 states covered: success (triage / ready) + the quiet
 * still-working sub-state. getByRole-first per the accessibility skill; the
 * component only ever mounts for `resolveM2Surface` ∈ {triage, ready} — the
 * hidden state renders zero pixels upstream and is covered by the page tests.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import M2VerifyHub from "./M2VerifyHub.svelte";
import type { MakeReadySignals } from "$lib/connect/make-ready-hub";

function signals(over: Partial<MakeReadySignals> = {}): MakeReadySignals {
  return {
    trustScore: 88,
    lastVerifiedAt: "2026-06-27T10:00:00.000Z",
    units: 1204,
    embedded: 1204,
    evidence: { bound: 1204, unbound: 0, noEvidence: 0, boundPct: 100 },
    validation: { ok: 1157, weak: 35, unsupported: 12, unvalidated: 0, awaitingTriage: 0, unsupportedUntriaged: 0 },
    ...over,
  };
}

function props(surface: "triage" | "ready", over: Partial<MakeReadySignals> = {}) {
  return { surface, signals: signals(over), scorecard: Promise.resolve(null), readiness: null };
}

describe("M2VerifyHub — triage (copy pack §3.2)", () => {
  const flagged = (): Partial<MakeReadySignals> => ({
    validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 },
  });

  it("leads with the honest headline count, the claim definition, and ONE primary CTA", () => {
    const { getByRole, getByText } = render(M2VerifyHub, { props: props("triage", flagged()) });
    expect(getByRole("heading", { name: "47 facts need your review" })).toBeTruthy();
    expect(
      getByText(/Each one is a claim — a fact we found in your documents/),
    ).toBeTruthy();
    const cta = getByRole("link", { name: /review the first claim/i });
    expect(cta.getAttribute("href")).toContain("filter=review");
  });

  it("uses the singular headline for one flagged fact", () => {
    const { getByRole } = render(
      M2VerifyHub,
      { props: props("triage", { validation: { ok: 0, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 1, unsupportedUntriaged: 0 } }) },
    );
    expect(getByRole("heading", { name: "1 fact needs your review" })).toBeTruthy();
  });

  it("collapses auto-cleared gates to ONE combined receipt line (no checklist)", () => {
    const { getByText, queryByText } = render(M2VerifyHub, { props: props("triage", flagged()) });
    expect(
      getByText("Sources and searchability checked automatically — nothing needed from you."),
    ).toBeTruthy();
    // The old three-gate checklist chrome is gone: no per-gate chips/dots.
    expect(queryByText("Done · auto")).toBeNull();
    expect(queryByText("Needs review")).toBeNull();
  });

  it("expands ONLY the lead gate (priority rule: pipeline order) with the lead-in when 2+ gates need you", () => {
    const { getByRole, getByText, getByTestId, queryByRole } = render(M2VerifyHub, {
      props: props("triage", {
        evidence: { bound: 1040, unbound: 164, noEvidence: 0, boundPct: 86 },
        validation: { ok: 0, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 },
      }),
    });
    // Lead-in names the earliest gate in pipeline order (Sources) and says why.
    expect(
      getByText("Start with Sources — each check depends on the one before it, so this one comes first."),
    ).toBeTruthy();
    // Exactly one expanded gate — the lead.
    expect(getByRole("heading", { name: "SOURCES" })).toBeTruthy();
    expect(queryByRole("heading", { name: "REVIEW" })).toBeNull();
    expect(getByTestId("verify-lead-gate").getAttribute("data-gate")).toBe("sources");
    // The headline counts ALL work needing the user (164 links + 47 verdicts).
    expect(getByRole("heading", { name: "211 facts need your review" })).toBeTruthy();
    // The single CTA opens the lead gate's fix surface.
    const cta = getByRole("link", { name: /review the first claim/i });
    expect(cta.getAttribute("href")).toContain("focus=sources");
  });

  it("quotes the trust score as a line (never recomputed, absent when null)", () => {
    const { getByText, unmount } = render(M2VerifyHub, { props: props("triage", flagged()) });
    expect(
      getByText("Trust score 88 of 100 — how strongly your answers are backed by your documents."),
    ).toBeTruthy();
    unmount();
    const { queryByText: q2 } = render(M2VerifyHub, {
      props: props("triage", { ...flagged(), trustScore: null }),
    });
    // Absent — never a placeholder "—" (copy pack §0). (The exact-line query
    // avoids the scorecard component's own visually-hidden heading.)
    expect(q2(/Trust score \d+ of 100/)).toBeNull();
    expect(q2("—")).toBeNull();
  });

  it("renders a QUIET still-working state (no yellow primary, honest stage line) when nothing needs the user", () => {
    const { getByRole, getByText, queryByRole } = render(M2VerifyHub, {
      props: props("triage", { embedded: 800, units: 1204 }),
    });
    expect(getByRole("heading", { name: "Building your graph" })).toBeTruthy();
    // Copy-pack stage grammar with real counts — never "vectorised".
    expect(getByText("Making it searchable — 800 of 1,204 facts.")).toBeTruthy();
    expect(queryByRole("link", { name: /review the first claim/i })).toBeNull();
    expect(queryByRole("heading", { name: /0 facts need your review/i })).toBeNull();
  });

  it("puts the full scorecard + K4 ledger behind ONE closed-by-default disclosure", () => {
    const { getByTestId, getByText } = render(M2VerifyHub, { props: props("triage", flagged()) });
    const details = getByTestId("verify-disclosure") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(getByText("Show the full scorecard")).toBeTruthy();
  });
});

describe("M2VerifyHub — ready (copy pack §3.3)", () => {
  it("renders the confirmation block with the honest unit count and the Mark-ready CTA", () => {
    const { getByRole, getByText } = render(M2VerifyHub, { props: props("ready") });
    expect(getByRole("heading", { name: "Everything checks out" })).toBeTruthy();
    expect(
      getByText(
        "All 1,204 facts are matched to sources, searchable, and reviewed. Your graph is ready for real questions.",
      ),
    ).toBeTruthy();
    const cta = getByRole("link", { name: /mark your graph ready/i });
    expect(cta.getAttribute("href")).toContain("/home");
    expect(
      getByText("This records the graph as reviewed and takes you back to Home."),
    ).toBeTruthy();
  });

  it("uses the singular body for a one-fact graph", () => {
    const { getByText } = render(M2VerifyHub, { props: props("ready", { units: 1, embedded: 1 }) });
    expect(
      getByText(
        "All 1 fact is matched to sources, searchable, and reviewed. Your graph is ready for real questions.",
      ),
    ).toBeTruthy();
  });

  it("keeps the scorecard disclosure closed by default in ready too", () => {
    const { getByTestId } = render(M2VerifyHub, { props: props("ready") });
    expect((getByTestId("verify-disclosure") as HTMLDetailsElement).open).toBe(false);
  });
});
