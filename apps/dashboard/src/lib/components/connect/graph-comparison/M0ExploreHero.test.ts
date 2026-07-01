// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import M0ExploreHero from "./M0ExploreHero.svelte";
import { MILESTONE_LABEL } from "$lib/connect/connect-journey";

const INGEST = "/keys/dashboard/sources/ingest";

describe("M0ExploreHero", () => {
  it("explore phase (demo): leads with the starter-graph aha + an M0 milestone cue", () => {
    const { getByText, getByTestId, getByRole } = render(M0ExploreHero, {
      props: { isDemo: true, hasAnswer: false, ingestHref: INGEST },
    });

    expect(getByText("Ask the starter graph")).toBeTruthy();
    // Where-am-I cue is single-sourced from the PR-F milestone vocabulary.
    expect(getByTestId("state-chip").textContent).toContain(`M0 · ${MILESTONE_LABEL.m0}`);
    // What-next cue: the M1 Build on-ramp.
    const cta = getByRole("link", { name: new RegExp(`Ingest your docs.*${MILESTONE_LABEL.m1}`) });
    expect(cta.getAttribute("href")).toBe(INGEST);
  });

  it("strengthens the ingest nudge once the first demo answer has streamed", () => {
    const { getByText, container } = render(M0ExploreHero, {
      props: { isDemo: true, hasAnswer: true, ingestHref: INGEST },
    });
    expect(getByText(/That answer came with citations/)).toBeTruthy();
    expect(container.querySelector(".m0-next-strong")).toBeTruthy();
  });

  it("collapses to 'ask your graph' after ingest (no demo), with no ingest CTA", () => {
    const { getByText, getByTestId, queryByRole } = render(M0ExploreHero, {
      props: { isDemo: false, hasAnswer: false, ingestHref: INGEST },
    });
    expect(getByText("Ask your graph")).toBeTruthy();
    // Milestone reads as done once the user is on their own graph.
    expect(getByTestId("state-chip").getAttribute("data-state")).toBe("done");
    expect(queryByRole("link", { name: /Ingest your docs/ })).toBeNull();
  });
});
