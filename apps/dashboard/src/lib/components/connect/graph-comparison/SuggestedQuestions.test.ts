// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import SuggestedQuestions from "./SuggestedQuestions.svelte";
import type { SuggestedQuestion } from "$lib/connect/graph-comparison-types";

const QS: SuggestedQuestion[] = [
  { id: "q1", question: "Which plans include SSO?", type: "A", seedNodeIds: [] },
];

describe("SuggestedQuestions", () => {
  it("default (flag OFF): keeps the shipped label + empty-state copy", () => {
    const { getByText } = render(SuggestedQuestions, {
      props: { questions: [], failed: true, onSelect: vi.fn() },
    });
    expect(getByText("SUGGESTED QUESTIONS")).toBeTruthy();
    expect(getByText(/Type a question your sources would know/)).toBeTruthy();
  });

  it("onboarding (flag ON): reskins the label + empty-state copy, chips still selectable", () => {
    const onSelect = vi.fn();
    const { getByText, queryByText } = render(SuggestedQuestions, {
      props: { questions: QS, onSelect, onboarding: true },
    });
    expect(getByText("OR TRY ONE OF THESE")).toBeTruthy();
    expect(queryByText("SUGGESTED QUESTIONS")).toBeNull();
    const chip = getByText("Which plans include SSO?");
    chip.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith(QS[0]);
  });
});
