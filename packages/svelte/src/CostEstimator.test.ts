import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/svelte";
import CostEstimator from "./CostEstimator.svelte";
import { expectElementHasClasses } from "./testing/assert-dom";

describe("CostEstimator", () => {
  it("renders empty state when cost is null", () => {
    render(CostEstimator, { props: { cost: null } });
    expect(screen.getByText(/no cost data/i)).toBeTruthy();
  });

  it("renders cost breakdown with model and provider", () => {
    render(CostEstimator, {
      props: {
        cost: {
          modelId: "gpt-4o",
          providerId: "openai",
          inputPerMillion: 2.5,
          outputPerMillion: 10,
          unit: "USD",
        },
      },
    });
    expect(screen.getByText("gpt-4o")).toBeTruthy();
    expect(screen.getByText("openai")).toBeTruthy();
    expect(screen.getByText(/Input.*per 1M/i)).toBeTruthy();
    expect(screen.getByText(/Output.*per 1M/i)).toBeTruthy();
  });

  it("shows Within budget badge when estimatedCost <= 80% of budget", () => {
    render(CostEstimator, {
      props: {
        cost: { modelId: "gpt-4o", inputPerMillion: 1, outputPerMillion: 2 },
        budget: 100,
        estimatedCost: 50,
      },
    });
    expect(screen.getByText("Within budget")).toBeTruthy();
  });

  it("shows Near budget badge when estimatedCost between 80% and 100% of budget", () => {
    render(CostEstimator, {
      props: {
        cost: { modelId: "gpt-4o" },
        budget: 100,
        estimatedCost: 90,
      },
    });
    expect(screen.getByText("Near budget")).toBeTruthy();
  });

  it("shows Over budget badge when estimatedCost > budget", () => {
    render(CostEstimator, {
      props: {
        cost: { modelId: "gpt-4o" },
        budget: 100,
        estimatedCost: 150,
      },
    });
    expect(screen.getByText("Over budget")).toBeTruthy();
  });

  it("uses rk-dark and theme container for custom property respect", () => {
    render(CostEstimator, {
      props: { cost: { modelId: "m1" } },
    });
    const el = document.querySelector(".rk-cost-estimator");
    expectElementHasClasses(el, "rk-dark");
  });
});
