import posthog from "posthog-js";
import type { GraphModuleMode, ModuleFlags } from "$lib/module-flags-types";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import type { MonitorInterestItem } from "$lib/dashboard-monitor-interest";
import { track } from "$lib/analytics/track";

/**
 * Re-export the typed analytics surface so existing `$lib/posthog` imports keep
 * working while new public-page code can pull `track` / the event taxonomy from
 * one place. New events live in `$lib/analytics` — see events.ts.
 */
export { track } from "$lib/analytics/track";
export { ANALYTICS_EVENTS } from "$lib/analytics/events";
export type { AnalyticsEventName, AnalyticsEventMap } from "$lib/analytics/events";

/**
 * Returns the A/B test variant for the landing page.
 * Safe to call before PostHog loads — defaults to 'control'.
 */
export function getVariant(): "control" | "test" {
  try {
    const flag = posthog.getFeatureFlag?.("landing-variant");
    if (flag === "test") return "test";
    return "control";
  } catch {
    return "control";
  }
}

function graphFromClientFlag(value: string | boolean | undefined): GraphModuleMode {
  if (value === "preview" || value === "enabled") return value;
  return "disabled";
}

/** Build module flags from PostHog client SDK (marketing pages). Server layout data takes precedence in dashboard. */
export function getClientModuleFlagsFromPostHog(): ModuleFlags {
  try {
    return {
      connect: posthog.isFeatureEnabled?.("restormel-module-connect") ?? MVP_MODULE_DEFAULTS.connect,
      testing: posthog.isFeatureEnabled?.("restormel-module-testing") ?? false,
      graph: graphFromClientFlag(posthog.getFeatureFlag?.("restormel-module-graph") as string | boolean | undefined),
      gatewayProviders: posthog.isFeatureEnabled?.("restormel-module-gateway-providers") ?? false,
      guardrails: posthog.isFeatureEnabled?.("restormel-module-guardrails") ?? false,
      environments: posthog.isFeatureEnabled?.("restormel-module-environments") ?? false,
      modelPools: posthog.isFeatureEnabled?.("restormel-module-model-pools") ?? false,
      hostedRuntime: posthog.isFeatureEnabled?.("restormel-module-hosted-runtime") ?? false,
      catalogExternalSignals:
        posthog.isFeatureEnabled?.("restormel-module-catalog-external-signals") ?? false,
      // REC-ADR-008 dual-read: new key OR the legacy `…-neon-graph-store` key until the
      // EU PostHog flag is re-keyed (mirrors the server-side flagsFromPostHogPayload read).
      connectHostManagedGraphStore:
        posthog.isFeatureEnabled?.("restormel-module-connect-host-managed-graph-store") ??
        posthog.isFeatureEnabled?.("restormel-module-connect-neon-graph-store") ??
        false,
      monitor: posthog.isFeatureEnabled?.("restormel-module-monitor") ?? false,
      fromEnvOverride: false,
    };
  } catch {
    return { ...MVP_MODULE_DEFAULTS };
  }
}

/**
 * Track the signup CTA click.
 */
export function trackSignupClick() {
  track("signup_clicked", {});
}

/** Suite IA: home intent doors (Run vs Embed). */
export function trackSuiteIntent(intent: "run" | "embed") {
  track("suite_intent_selected", { intent });
}

/** Suite IA: dashboard first-run milestone for funnel analysis. */
export function trackDashboardOnboardingStep(step: string) {
  track("dashboard_onboarding_step", { step });
}

/** Fake-door / coming-soon interest (Monitor: Usage, Logs, Health). */
export type DashboardFeatureInterestAction =
  | "section_expand"
  | "item_click"
  | "direct_navigation"
  | "notify_feedback";

export function trackDashboardFeatureInterest(params: {
  feature: "monitor";
  action: DashboardFeatureInterestAction;
  item?: MonitorInterestItem | null;
}) {
  track("dashboard_feature_interest", {
    feature: params.feature,
    action: params.action,
    item: params.item ?? undefined,
  });
}
