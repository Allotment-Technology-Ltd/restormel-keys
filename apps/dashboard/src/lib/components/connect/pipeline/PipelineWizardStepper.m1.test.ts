// @vitest-environment jsdom
/**
 * RES-113 PR-5 — the PR-C `friendly` four-rung ladder is DELETED (plan §3.2:
 * the flag-ON Build path renders one state-derived panel with a plain
 * non-interactive eyebrow — no stepper at all). This stepper now mounts only on
 * the flag-OFF path; these tests pin the literal strip and prove no friendly
 * rung markup survives.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import PipelineWizardStepper from "./PipelineWizardStepper.svelte";

describe("PipelineWizardStepper — flag-OFF literal strip (live, unchanged)", () => {
  it("renders the literal wizard steps and NONE of the retired friendly rungs", () => {
    const { container } = render(PipelineWizardStepper, {
      props: { currentStep: "sources", onNavigate: vi.fn(), completedIds: [], navigable: true },
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Provider key");
    expect(text).toContain("Review & launch");
    // The PR-C friendly ladder is gone for good — not merely hidden.
    expect(container.querySelector(".wizard-stepper--friendly")).toBeNull();
    expect(text).not.toContain("Configure");
    expect(text).not.toContain("Running");
  });

  it("marks the active step with aria-current and keeps completed ✓ from real signals", () => {
    const { container } = render(PipelineWizardStepper, {
      props: {
        currentStep: "sources",
        onNavigate: vi.fn(),
        completedIds: ["provider"],
        navigable: true,
      },
    });
    const active = container.querySelector('[aria-current="step"]');
    expect(active?.textContent).toContain("Sources");
    const completed = [...container.querySelectorAll(".wizard-step-completed .wizard-step-label")].map(
      (n) => n.textContent,
    );
    expect(completed).toEqual(["Provider key"]);
  });

  it("RES-122: connectors are bundled INSIDE the step li they lead into (no orphan li)", () => {
    const { container } = render(PipelineWizardStepper, {
      props: { currentStep: "provider", onNavigate: vi.fn(), completedIds: [], navigable: true },
    });
    // Every list item is a step; connectors are spans inside them, never li siblings.
    const items = [...container.querySelectorAll(".wizard-steps > li")];
    expect(items).toHaveLength(4);
    for (const li of items) {
      expect(li.classList.contains("wizard-step")).toBe(true);
    }
    expect(container.querySelectorAll("li.wizard-connector")).toHaveLength(0);
    expect(container.querySelectorAll(".wizard-step > span.wizard-connector")).toHaveLength(3);
  });
});
