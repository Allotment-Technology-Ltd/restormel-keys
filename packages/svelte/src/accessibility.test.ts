/**
 * Accessibility audit: axe-core at WCAG 2 AA. Zero violations for each component.
 * Keyboard: tab, Enter/Space, Escape covered in components; this file asserts axe.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/svelte";
import KeyManager from "./KeyManager.svelte";
import ModelSelector from "./ModelSelector.svelte";
import CostEstimator from "./CostEstimator.svelte";
import { createKeys } from "@restormel/keys";
import { openaiProvider, anthropicProvider } from "@restormel/keys";

// axe-core run in jsdom: some rules (e.g. color-contrast) are unreliable without layout.
// We run WCAG 2 AA tag and filter to rules that are meaningful in jsdom.
const AXE_RUN_OPTIONS: import("axe-core").RunOptions = {
  runOnly: ["wcag2a", "wcag2aa"],
  rules: {
    "color-contrast": { enabled: false },
    "color-contrast-enhanced": { enabled: false },
    "link-in-text-block": { enabled: false },
    "avoid-inline-spacing": { enabled: false },
    "target-size": { enabled: false },
    "focus-order-semantics": { enabled: false },
  },
};

async function runAxe(container: HTMLElement): Promise<import("axe-core").AxeResults> {
  const axe = await import("axe-core");
  return axe.run(container, AXE_RUN_OPTIONS);
}

const providers = [openaiProvider, anthropicProvider];

describe("Accessibility (axe-core AA)", () => {
  it("KeyManager has zero axe violations", async () => {
    const keys = createKeys(
      { keys: [], routing: { defaultProvider: "openai" } },
      { providers }
    );
    const { container } = render(KeyManager, {
      props: { keys, userId: "u1", providers },
    });
    const result = await runAxe(container);
    expect(result.violations, JSON.stringify(result.violations, null, 2)).toHaveLength(0);
  });

  it("ModelSelector has zero axe violations", async () => {
    const keys = createKeys(
      { keys: [], routing: { defaultProvider: "openai" } },
      { providers }
    );
    const { container } = render(ModelSelector, {
      props: { keys, providers },
    });
    const result = await runAxe(container);
    expect(result.violations, JSON.stringify(result.violations, null, 2)).toHaveLength(0);
  });

  it("CostEstimator has zero axe violations", async () => {
    const { container } = render(CostEstimator, {
      props: {
        cost: {
          modelId: "gpt-4o",
          providerId: "openai",
          inputPerMillion: 2.5,
          outputPerMillion: 10,
          unit: "USD",
        },
        budget: 100,
        estimatedCost: 50,
      },
    });
    const result = await runAxe(container);
    expect(result.violations, JSON.stringify(result.violations, null, 2)).toHaveLength(0);
  });
});
