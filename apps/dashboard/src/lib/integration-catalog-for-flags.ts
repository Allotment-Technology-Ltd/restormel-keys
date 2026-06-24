/**
 * Filter integration catalog + stack wizard presets for Keys MVP module flags.
 */
import type { IntegrationCatalogEntry } from "@restormel/dispatch";
import { INTEGRATION_CATALOG, INTEGRATION_STACK_TEMPLATES, STACK_LAYER_ORDER } from "@restormel/dispatch";
import type { ModuleFlags } from "$lib/module-flags-types";

const GATEWAY_CATALOG_IDS = new Set(["openrouter", "portkey", "zuplo", "vercel"]);
const TESTING_CATALOG_IDS = new Set(["github"]);

const GATEWAY_TEMPLATE_IDS = new Set(["next-vercel-ai-keys", "openrouter-portkey-keys"]);
const TESTING_TEMPLATE_IDS = new Set(["github-actions-testing"]);

export function isIntegrationCatalogEntryVisible(
  entry: IntegrationCatalogEntry,
  flags: ModuleFlags,
): boolean {
  if (!flags.gatewayProviders) {
    if (entry.category === "gateway") return false;
    if (GATEWAY_CATALOG_IDS.has(entry.id)) return false;
    if (
      entry.docsPath.startsWith("/keys/docs/guides/openrouter") ||
      entry.docsPath.startsWith("/keys/docs/guides/portkey") ||
      entry.docsPath.startsWith("/keys/docs/guides/vercel-ai-gateway")
    ) {
      return false;
    }
  }
  if (!flags.testing) {
    if (entry.category === "ci") return false;
    if (TESTING_CATALOG_IDS.has(entry.id)) return false;
    if (entry.docsPath.startsWith("/testing/")) return false;
  }
  return true;
}

export function integrationCatalogForFlags(flags: ModuleFlags): IntegrationCatalogEntry[] {
  return INTEGRATION_CATALOG.filter((e) => isIntegrationCatalogEntryVisible(e, flags));
}

/** Mono footnote labels for marketing rails — ordered data → models → gateways → ship. */
export function integrationCatalogFootnoteLabels(entries: IntegrationCatalogEntry[]): string {
  const layerRank = new Map(STACK_LAYER_ORDER.map((layer, index) => [layer, index]));
  const sorted = [...entries].sort((a, b) => {
    const layerDiff = (layerRank.get(a.stackLayer) ?? 99) - (layerRank.get(b.stackLayer) ?? 99);
    return layerDiff !== 0 ? layerDiff : a.label.localeCompare(b.label);
  });
  return sorted.map((entry) => entry.label).join(" · ");
}

export function integrationStackTemplatesForFlags(flags: ModuleFlags) {
  return INTEGRATION_STACK_TEMPLATES.filter((t) => {
    if (!flags.gatewayProviders && GATEWAY_TEMPLATE_IDS.has(t.id)) return false;
    if (!flags.testing && TESTING_TEMPLATE_IDS.has(t.id)) return false;
    return true;
  });
}

/** Marketing copy: full suite vs Keys + Connect MVP. */
export function isSuiteMarketingExpanded(flags: ModuleFlags): boolean {
  return flags.testing || flags.graph !== "disabled";
}
