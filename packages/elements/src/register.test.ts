import { describe, it, expect, beforeEach } from "vitest";
import "./register.js";
import { defaultThemeCss } from "./theme-inline.js";
import type { RkKeyManagerElement } from "./rk-key-manager.js";
import type { RkModelSelectorElement } from "./rk-model-selector.js";
import type { RkCostEstimatorElement } from "./rk-cost-estimator.js";

describe("registration", () => {
  it("registers rk-key-manager", () => {
    expect(customElements.get("rk-key-manager")).toBeDefined();
  });

  it("registers rk-model-selector", () => {
    expect(customElements.get("rk-model-selector")).toBeDefined();
  });

  it("registers rk-cost-estimator", () => {
    expect(customElements.get("rk-cost-estimator")).toBeDefined();
  });
});

describe("rk-key-manager attribute/prop mapping", () => {
  let el: RkKeyManagerElement;

  beforeEach(() => {
    el = document.createElement("rk-key-manager") as RkKeyManagerElement;
  });

  it("maps user-id attribute to userId property", () => {
    el.setAttribute("user-id", "u-1");
    expect(el.userId).toBe("u-1");
  });

  it("accepts keys and userId via properties", () => {
    const keys = {
      config: { keys: [], routing: { defaultProvider: "openai" } },
      router: { resolve: async () => ({}), resolveWithKeys: async () => ({}) },
      entitlements: { check: () => ({ allowed: true }) },
      wallet: {},
      resolve: async () => ({ provider: "openai", source: "byok" }),
      estimateCost: () => null,
      trackCost: () => {},
      getAllModelIds: () => [],
    };
    el.keys = keys as any;
    el.userId = "u1";
    expect(el.keys).toBe(keys);
    expect(el.userId).toBe("u1");
  });

  it("has observedAttributes user-id", () => {
    expect((customElements.get("rk-key-manager") as any).observedAttributes).toContain("user-id");
  });
});

describe("rk-cost-estimator attribute/prop mapping", () => {
  let el: RkCostEstimatorElement;

  beforeEach(() => {
    el = document.createElement("rk-cost-estimator") as RkCostEstimatorElement;
  });

  it("maps budget and estimated-cost attributes after connect", () => {
    el.setAttribute("budget", "100");
    el.setAttribute("estimated-cost", "50");
    expect(el.getAttribute("budget")).toBe("100");
    expect(el.getAttribute("estimated-cost")).toBe("50");
    el.budget = 100;
    el.estimatedCost = 50;
    expect(el.budget).toBe(100);
    expect(el.estimatedCost).toBe(50);
  });

  it("has observedAttributes budget and estimated-cost", () => {
    const C = customElements.get("rk-cost-estimator") as any;
    expect(C.observedAttributes).toContain("budget");
    expect(C.observedAttributes).toContain("estimated-cost");
  });
});

describe("custom event dispatch", () => {
  it("rk-cost-estimator dispatches rk-cost-updated when cost is set (no connect)", async () => {
    const el = document.createElement("rk-cost-estimator") as RkCostEstimatorElement;
    const p = new Promise<CustomEvent>((resolve) => {
      el.addEventListener("rk-cost-updated", (e: Event) => resolve(e as CustomEvent), { once: true });
    });
    el.cost = { modelId: "gpt-4o" };
    const e = await p;
    expect(e.detail.cost).toEqual({ modelId: "gpt-4o" });
  });
});

describe("shadow DOM and host CSS custom property", () => {
  it("defaultThemeCss includes :host and --rk-* for host override", () => {
    expect(defaultThemeCss).toContain(":host");
    expect(defaultThemeCss).toMatch(/--rk-(bg|text|accent)/);
  });

  it("element has no shadow root before connect", () => {
    const el = document.createElement("rk-key-manager") as RkKeyManagerElement;
    expect(el.shadowRoot).toBeNull();
  });
});
