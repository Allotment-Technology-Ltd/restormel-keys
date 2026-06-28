// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import FirstRunStrip from "./FirstRunStrip.svelte";

const QUESTIONS: { type: "answerable" | "abstention"; question: string }[] = [
  { type: "answerable", question: "What is our data retention policy?" },
  { type: "abstention", question: "What is the airspeed velocity of a swallow?" },
];

const baseProps = () => ({
  questions: QUESTIONS,
  onRun: vi.fn(),
  onDismiss: vi.fn(),
});

describe("FirstRunStrip", () => {
  it("default (flag OFF): keeps the shipped plain ANSWERS/ABSTAINS chip flags, no StateChip", () => {
    const { container, getByText } = render(FirstRunStrip, { props: baseProps() });
    expect(getByText("START HERE — TRY A QUESTION")).toBeTruthy();
    // Shipped flags are plain spans, not the StateChip primitive.
    expect(container.querySelector(".chip-flag-answer")?.textContent).toBe("ANSWERS");
    expect(container.querySelector('[data-testid="state-chip"]')).toBeNull();
  });

  it("onboarding (flag ON): wears the M0 reskin with honest StateChip cues per chip", () => {
    const { container, getByText, queryByText } = render(FirstRunStrip, {
      props: { ...baseProps(), onboarding: true },
    });
    expect(getByText("TRY A QUESTION — CITATIONS ARE THE POINT")).toBeTruthy();
    expect(queryByText("START HERE — TRY A QUESTION")).toBeNull();

    const chips = container.querySelectorAll('[data-testid="state-chip"]');
    expect(chips.length).toBe(QUESTIONS.length);
    const states = [...chips].map((c) => c.getAttribute("data-state"));
    expect(states).toContain("done"); // answerable
    expect(states).toContain("unsupported"); // abstention
    // The old plain flags are gone in onboarding mode.
    expect(container.querySelector(".chip-flag")).toBeNull();
  });
});
