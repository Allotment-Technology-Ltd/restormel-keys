import { describe, expect, it } from "vitest";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import {
  integrationCatalogForFlags,
  integrationCatalogFootnoteLabels,
  integrationStackTemplatesForFlags,
  isIntegrationCatalogEntryVisible,
  isSuiteMarketingExpanded,
} from "./integration-catalog-for-flags";
import { INTEGRATION_CATALOG } from "@restormel/aaif";

describe("integration-catalog-for-flags", () => {
  it("MVP defaults hide gateway and CI catalog entries", () => {
    const catalog = integrationCatalogForFlags(MVP_MODULE_DEFAULTS);
    expect(catalog.some((e) => e.id === "openrouter")).toBe(false);
    expect(catalog.some((e) => e.id === "portkey")).toBe(false);
    expect(catalog.some((e) => e.id === "github")).toBe(false);
    expect(catalog.some((e) => e.id === "openai")).toBe(true);
    expect(catalog.some((e) => e.id === "mistral")).toBe(true);
    expect(catalog.some((e) => e.id === "together")).toBe(true);
    expect(catalog.some((e) => e.id === "voyage")).toBe(true);
    expect(catalog.some((e) => e.id === "neon")).toBe(true);
    expect(catalog.some((e) => e.id === "surreal")).toBe(true);
  });

  it("shows gateway entries when gatewayProviders on", () => {
    const flags = { ...MVP_MODULE_DEFAULTS, gatewayProviders: true };
    expect(integrationCatalogForFlags(flags).some((e) => e.id === "openrouter")).toBe(true);
  });

  it("filters stack templates for MVP", () => {
    const templates = integrationStackTemplatesForFlags(MVP_MODULE_DEFAULTS);
    expect(templates.map((t) => t.id)).toEqual(["sveltekit-neon-keys"]);
  });

  it("isIntegrationCatalogEntryVisible respects docs paths", () => {
    const openrouter = INTEGRATION_CATALOG.find((e) => e.id === "openrouter")!;
    expect(isIntegrationCatalogEntryVisible(openrouter, MVP_MODULE_DEFAULTS)).toBe(false);
  });

  it("isSuiteMarketingExpanded false at MVP defaults", () => {
    expect(isSuiteMarketingExpanded(MVP_MODULE_DEFAULTS)).toBe(false);
  });

  it("integrationCatalogFootnoteLabels lists visible catalog vendors in stack order", () => {
    const labels = integrationCatalogFootnoteLabels(integrationCatalogForFlags(MVP_MODULE_DEFAULTS));
    expect(labels).toContain("Neon");
    expect(labels).toContain("SurrealDB");
    expect(labels).toContain("OpenAI");
    expect(labels).not.toContain("Nuxt");
    expect(labels).not.toContain("LangChain");
    expect(labels.indexOf("Neon")).toBeLessThan(labels.indexOf("OpenAI"));
  });
});
