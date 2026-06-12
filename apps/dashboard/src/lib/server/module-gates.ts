/**
 * Module route gating and suite IA filtering (marketing + dashboard).
 */
import type { SuiteModuleId } from "$lib/suite/suite-modules";
import type { ModuleFlags } from "$lib/module-flags-types";
import { filterSuiteModulesForFlags } from "$lib/suite/filter-suite-modules";
import { isGraphFullyEnabled, isGraphPreview, isModuleEnabled } from "$lib/server/module-flags";

export { filterSuiteModulesForFlags };

export function graphModuleBadge(flags: ModuleFlags): "Preview" | null {
  return isGraphPreview(flags) && !isGraphFullyEnabled(flags) ? "Preview" : null;
}

/** Path prefixes blocked when module is disabled (marketing + docs). */
export function moduleDisabledRedirectPath(pathname: string, flags: ModuleFlags): string | null {
  if (pathname === "/testing" || pathname.startsWith("/testing/")) {
    if (!flags.testing) return "/keys?module-disabled=testing";
  }
  if (pathname === "/graph" || pathname.startsWith("/graph/")) {
    if (flags.graph === "disabled") return "/keys?module-disabled=graph";
  }
  if (pathname === "/connect" || pathname.startsWith("/connect/")) {
    if (!flags.connect) return "/keys?module-disabled=connect";
  }
  if (pathname.startsWith("/keys/dashboard/testing")) {
    if (!flags.testing) return "/keys/dashboard?module-disabled=testing";
  }
  if (pathname.startsWith("/keys/dashboard/copy-for-ci")) {
    if (!flags.testing) return "/keys/dashboard?module-disabled=testing";
  }
  // R2: the Connect hub dissolved into top-level work sections (redesign §2.2);
  // legacy /keys/dashboard/connect/* still 308s through these prefixes.
  const connectDashboardPrefixes = [
    "/keys/dashboard/connect",
    "/keys/dashboard/sources",
    "/keys/dashboard/runs",
    "/keys/dashboard/claims",
    "/keys/dashboard/prove",
    "/keys/dashboard/agents",
  ];
  if (connectDashboardPrefixes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (!flags.connect) return "/keys/dashboard?module-disabled=connect";
  }
  if (pathname.startsWith("/connect/v1/")) {
    if (!flags.connect) return "/keys?module-disabled=connect";
  }
  if (pathname.startsWith("/v1/testing/")) {
    if (!flags.testing) return "/keys?module-disabled=testing";
  }
  if (pathname.startsWith("/graph/v1/")) {
    if (flags.graph === "disabled") return "/keys?module-disabled=graph";
  }
  if (
    pathname.startsWith("/keys/docs/guides/openrouter") ||
    pathname.startsWith("/keys/docs/guides/portkey") ||
    pathname.startsWith("/keys/docs/guides/vercel-ai-gateway")
  ) {
    if (!flags.gatewayProviders) return "/keys/docs/guides/provider-access-modes?module-disabled=gateway_providers";
  }
  if (pathname.startsWith("/keys/docs/guides/keys-testing-onboarding")) {
    if (!flags.testing) return "/keys/docs?module-disabled=testing";
  }
  if (pathname === "/keys/docs/walkthrough/migration-paths") {
    if (!flags.gatewayProviders) {
      return "/keys/docs/guides/provider-access-modes?module-disabled=gateway_providers";
    }
  }
  if (pathname === "/keys/docs/walkthrough/staging-and-ci-setup") {
    if (!flags.testing) return "/keys/docs?module-disabled=testing";
  }
  if (pathname.startsWith("/keys/docs/journeys/platform-ops")) {
    if (!flags.testing) return "/keys/docs?module-disabled=testing";
  }
  return null;
}

export function suiteModuleIdEnabled(flags: ModuleFlags, id: SuiteModuleId): boolean {
  if (id === "keys") return true;
  if (id === "connect") return flags.connect;
  if (id === "testing") return flags.testing;
  if (id === "graph") return isModuleEnabled(flags, "graph");
  return true;
}

/** Gateway provider types blocked when gateway_providers module is off. */
export const GATEWAY_PROVIDER_TYPES = new Set([
  "openrouter",
  "portkey",
  "vercel_ai_gateway",
  "vercel",
]);

export const DIRECT_PROVIDER_TYPES = new Set(["openai", "anthropic", "google", "vertex"]);

export function isGatewayProviderType(providerType: string, flags: ModuleFlags): boolean {
  if (flags.gatewayProviders) return false;
  return GATEWAY_PROVIDER_TYPES.has(providerType.toLowerCase());
}
