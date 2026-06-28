// @vitest-environment jsdom
/**
 * RES-113 PR-C — flag-gated friendly M1 stepper.
 *
 * Proves the reskin is additive: with `friendly` OFF (the default) the literal
 * Provider→Sources→Domain→Review strip is byte-for-byte the live behaviour; with
 * it ON the friendly four-rung Sources·Configure·Running·Done ladder renders, and
 * rung state is derived from the same real signals.
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/svelte";
import PipelineWizardStepper from "./PipelineWizardStepper.svelte";

describe("PipelineWizardStepper — flag OFF (live, unchanged)", () => {
  it("renders the literal wizard steps and NONE of the friendly rungs", () => {
    const { container } = render(PipelineWizardStepper, {
      props: { currentStep: "sources", onNavigate: vi.fn(), completedIds: [], navigable: true },
    });
    const text = container.textContent ?? "";
    expect(text).toContain("Provider key");
    expect(text).toContain("Review & launch");
    // Friendly-only rung labels must not appear with the flag off.
    expect(container.querySelector(".wizard-stepper--friendly")).toBeNull();
    expect(text).not.toContain("Configure");
    expect(text).not.toContain("Running");
  });
});

describe("PipelineWizardStepper — friendly M1 ladder", () => {
  it("renders the four friendly rungs and drops the literal step labels", () => {
    const { container } = render(PipelineWizardStepper, {
      props: { currentStep: "sources", onNavigate: vi.fn(), completedIds: [], friendly: true },
    });
    expect(container.querySelector(".wizard-stepper--friendly")).not.toBeNull();
    const labels = [...container.querySelectorAll(".wizard-step-label")].map((n) => n.textContent);
    expect(labels).toEqual(["Sources", "Configure", "Running", "Done"]);
  });

  it("marks the current step's rung active (provider folds into Configure)", () => {
    const { container } = render(PipelineWizardStepper, {
      props: { currentStep: "provider", onNavigate: vi.fn(), completedIds: [], friendly: true },
    });
    const active = container.querySelector(".wizard-step-active .wizard-step-label")?.textContent;
    expect(active).toBe("Configure");
  });

  it("derives completed rungs from real completion, not position (active wins over completed)", () => {
    // Back on the Sources rung, but a domain pack + provider key are already in
    // place → Configure reads as completed even though we are upstream of it.
    const { container } = render(PipelineWizardStepper, {
      props: {
        currentStep: "sources",
        onNavigate: vi.fn(),
        completedIds: ["domain", "provider"],
        friendly: true,
      },
    });
    const active = container.querySelector(".wizard-step-active .wizard-step-label")?.textContent;
    expect(active).toBe("Sources");
    const completed = [...container.querySelectorAll(".wizard-step-completed .wizard-step-label")].map(
      (n) => n.textContent,
    );
    expect(completed).toContain("Configure");
    // Running/Done are never complete inside the wizard.
    expect(completed).not.toContain("Running");
    expect(completed).not.toContain("Done");
  });
});
