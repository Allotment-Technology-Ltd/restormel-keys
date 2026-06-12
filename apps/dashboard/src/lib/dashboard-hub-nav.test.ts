/**
 * R5: dashboard-hub-nav — tab strip integrity tests.
 *
 * Verifies that the R5 tab strips have the right count, correct hrefs,
 * and exactly one tab level (no nesting).
 */
import { describe, it, expect } from "vitest";
import {
  AGENTS_HUB_TABS,
  PROVE_HUB_TABS,
  ROUTES_HUB_TABS,
  TESTING_HUB_TABS,
} from "./dashboard-hub-nav";

describe("AGENTS_HUB_TABS", () => {
  it("has exactly two tabs", () => {
    expect(AGENTS_HUB_TABS).toHaveLength(2);
  });

  it("first tab is Wiring at /agents/wiring", () => {
    const wiring = AGENTS_HUB_TABS[0];
    expect(wiring.label).toBe("Wiring");
    expect(wiring.href).toMatch(/\/agents\/wiring$/);
    expect(wiring.exact).toBe(false);
  });

  it("second tab is Catalogs at /agents/catalogs", () => {
    const catalogs = AGENTS_HUB_TABS[1];
    expect(catalogs.label).toBe("Catalogs");
    expect(catalogs.href).toMatch(/\/agents\/catalogs$/);
    expect(catalogs.exact).toBe(false);
  });
});

describe("PROVE_HUB_TABS", () => {
  it("has exactly four tabs", () => {
    expect(PROVE_HUB_TABS).toHaveLength(4);
  });

  const expectedTabs = [
    { label: "Proof", suffix: "/prove/proof" },
    { label: "Traces", suffix: "/prove/traces" },
    { label: "Audit", suffix: "/prove/audit" },
    { label: "Share", suffix: "/prove/share" },
  ];

  for (const [i, expected] of expectedTabs.entries()) {
    it(`tab ${i} is ${expected.label} at ${expected.suffix}`, () => {
      const tab = PROVE_HUB_TABS[i];
      expect(tab.label).toBe(expected.label);
      expect(tab.href).toMatch(new RegExp(expected.suffix.replace("/", "\\/") + "$"));
    });
  }
});

describe("ROUTES_HUB_TABS", () => {
  it("has exactly two tabs", () => {
    expect(ROUTES_HUB_TABS).toHaveLength(2);
  });

  it("first tab is Rules (exact) at /routes", () => {
    const rules = ROUTES_HUB_TABS[0];
    expect(rules.label).toBe("Rules");
    expect(rules.href).toMatch(/\/routes$/);
    expect(rules.exact).toBe(true);
  });

  it("second tab is Ingestion at /routes/ingestion", () => {
    const ingestion = ROUTES_HUB_TABS[1];
    expect(ingestion.label).toBe("Ingestion");
    expect(ingestion.href).toMatch(/\/routes\/ingestion$/);
    expect(ingestion.exact).toBe(false);
  });
});

describe("TESTING_HUB_TABS (unchanged)", () => {
  it("still has two tabs", () => {
    expect(TESTING_HUB_TABS).toHaveLength(2);
  });
});

describe("Tab invariants", () => {
  const allStrips = [
    { name: "AGENTS", tabs: AGENTS_HUB_TABS },
    { name: "PROVE", tabs: PROVE_HUB_TABS },
    { name: "ROUTES", tabs: ROUTES_HUB_TABS },
  ];

  for (const { name, tabs } of allStrips) {
    it(`${name}: all tabs have non-empty labels and hrefs`, () => {
      for (const tab of tabs) {
        expect(tab.label.trim()).not.toBe("");
        expect(tab.href.trim()).not.toBe("");
      }
    });

    it(`${name}: no tab href contains another section's prefix (no cross-section nesting)`, () => {
      for (const tab of tabs) {
        // Ensure hrefs are within their own section
        const tabSection = tabs[0].href.split("/").slice(0, -1).join("/");
        expect(tab.href).toMatch(new RegExp(`^${tabSection.replace(/\//g, "\\/")}`));
      }
    });
  }
});
