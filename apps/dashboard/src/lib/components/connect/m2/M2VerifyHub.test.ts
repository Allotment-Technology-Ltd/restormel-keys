// @vitest-environment jsdom
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

function props(over: Partial<MakeReadySignals> = {}) {
  return { signals: signals(over), scorecard: Promise.resolve(null), readiness: null };
}

describe("M2VerifyHub", () => {
  it("renders the three make-ready gates and the trust meter", () => {
    const { getByTestId } = render(M2VerifyHub, { props: props() });
    expect(getByTestId("m2-verify-hub")).toBeTruthy();
    expect(getByTestId("mr-gate-sources")).toBeTruthy();
    expect(getByTestId("mr-gate-embed")).toBeTruthy();
    expect(getByTestId("mr-gate-validate")).toBeTruthy();
    expect(getByTestId("mr-meter").textContent).toContain("88");
  });

  it("ENABLES Mark ready when every claim is triaged even though weak + unsupported are non-zero (accept-guard)", () => {
    const { getByTestId, queryByTestId } = render(M2VerifyHub, { props: props() });
    // 35 weak + 12 unsupported but all triaged → ready.
    expect(getByTestId("mr-mark-ready")).toBeTruthy();
    expect(queryByTestId("mr-mark-ready-disabled")).toBeNull();
  });

  it("DISABLES Mark ready with a verbatim reason while claims await a verdict", () => {
    const { getByTestId, queryByTestId } = render(M2VerifyHub, {
      props: props({ validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 } }),
    });
    expect(queryByTestId("mr-mark-ready")).toBeNull();
    expect(getByTestId("mr-mark-ready-disabled")).toBeTruthy();
    expect(getByTestId("m2-verify-hub").textContent).toContain("47 claims still need a verdict");
  });

  it("shows a deferred recompute STATE (no climbing number) while triage is outstanding", () => {
    const { getByTestId } = render(M2VerifyHub, {
      props: props({ validation: { ok: 1157, weak: 0, unsupported: 0, unvalidated: 0, awaitingTriage: 47, unsupportedUntriaged: 12 } }),
    });
    const meter = getByTestId("mr-meter");
    expect(meter.textContent).toContain("Recompute pending");
    expect(meter.textContent).toContain("88"); // quoted, never tweened
  });

  it("uses plain honest tally labels (Supported / Weak / Unsupported)", () => {
    const { getByTestId } = render(M2VerifyHub, { props: props() });
    const triage = getByTestId("mr-triage").textContent ?? "";
    expect(triage).toContain("Supported");
    expect(triage).toContain("Weak");
    expect(triage).toContain("Unsupported");
  });
});
