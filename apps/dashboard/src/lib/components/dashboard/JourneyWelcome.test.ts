// @vitest-environment jsdom
/**
 * RES-113 PR-4 — the journey signed-out welcome (copy pack §5.5), extracted so
 * the canonical auth CTA is getByRole-testable (5-lens review, Lens 4 minor 2).
 * Pins the §5.5 strings VERBATIM and the CTA's canonical destination.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import JourneyWelcome from "./JourneyWelcome.svelte";
import { DASHBOARD_BASE } from "$lib/dashboard-base";

describe("JourneyWelcome — §5.5 signed-out layout (flag-ON)", () => {
  it("renders the heading, the §5.5 sentence, and the Sign in with GitHub CTA", () => {
    const { getByRole, getByText } = render(JourneyWelcome);
    expect(getByRole("heading", { level: 1, name: "Restormel Dashboard" })).toBeTruthy();
    // Copy pack §5.5, verbatim — one sentence, no tour copy.
    expect(getByText("Restormel turns your documents into answers you can check.")).toBeTruthy();
    // The canonical auth CTA (ux-contracts §2 CTA grammar) → the login route.
    const cta = getByRole("link", { name: "Sign in with GitHub" });
    expect(cta.getAttribute("href")).toBe(DASHBOARD_BASE + "/login");
  });

  it("carries NO tour copy — the stale Sources → Runs → Claims walkthrough is gone", () => {
    const { container, queryByRole } = render(JourneyWelcome);
    expect(container.textContent).not.toContain("Sources → Runs → Claims");
    expect(container.textContent).not.toContain("Foundation");
    expect(queryByRole("list")).toBeNull();
  });
});
