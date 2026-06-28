// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import StateChip, { type StateChipState } from "./StateChip.svelte";

const ALL_STATES: StateChipState[] = [
  "idle",
  "running",
  "done",
  "weak",
  "unsupported",
  "error",
];

describe("StateChip", () => {
  it("renders every honest M0–M4 state with its state class + data-state", () => {
    for (const state of ALL_STATES) {
      const { getByTestId, unmount } = render(StateChip, { props: { state } });
      const chip = getByTestId("state-chip");
      expect(chip.getAttribute("data-state")).toBe(state);
      expect(chip.className).toContain(`state-${state}`);
      unmount();
    }
  });

  it("falls back to the capitalised state word when no label is given", () => {
    const { getByTestId } = render(StateChip, { props: { state: "unsupported" } });
    expect(getByTestId("state-chip").textContent).toContain("Unsupported");
  });

  it("renders a custom label and folds it into the accessible name", () => {
    const { getByTestId } = render(StateChip, {
      props: { state: "weak", label: "6 weak claims" },
    });
    const chip = getByTestId("state-chip");
    expect(chip.textContent).toContain("6 weak claims");
    expect(chip.getAttribute("aria-label")).toBe("Weak: 6 weak claims");
    // status role so assistive tech announces the honest state
    expect(chip.getAttribute("role")).toBe("status");
  });

  it("shows the running dot only for the running state", () => {
    const { getByTestId } = render(StateChip, { props: { state: "running" } });
    const dot = getByTestId("state-chip").querySelector(".state-chip-dot");
    expect(dot).not.toBeNull();
    expect(dot?.className).toContain("is-running");
  });

  it("omits the dot when dot=false", () => {
    const { getByTestId } = render(StateChip, {
      props: { state: "done", dot: false },
    });
    expect(getByTestId("state-chip").querySelector(".state-chip-dot")).toBeNull();
  });
});
