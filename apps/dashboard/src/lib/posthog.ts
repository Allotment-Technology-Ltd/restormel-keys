import posthog from "posthog-js";
import type { GraphModuleMode, ModuleFlags } from "$lib/module-flags-types";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import type { MonitorInterestItem } from "$lib/dashboard-monitor-interest";

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
      connectNeonGraphStore:
        posthog.isFeatureEnabled?.("restormel-module-connect-neon-graph-store") ?? false,
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
  try {
    posthog.capture?.("signup_clicked");
  } catch {
    // PostHog not loaded — silently ignore
  }
}

/** Suite IA: home intent doors (Run vs Embed). */
export function trackSuiteIntent(intent: "run" | "embed") {
  try {
    posthog.capture?.("suite_intent_selected", { intent });
  } catch {
    // PostHog not loaded — silently ignore
  }
}

/** Suite IA: dashboard first-run milestone for funnel analysis. */
export function trackDashboardOnboardingStep(step: string) {
  try {
    posthog.capture?.("dashboard_onboarding_step", { step });
  } catch {
    // PostHog not loaded — silently ignore
  }
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
  try {
    posthog.capture?.("dashboard_feature_interest", {
      feature: params.feature,
      action: params.action,
      item: params.item ?? undefined,
    });
  } catch {
    // PostHog not loaded — silently ignore
  }
}
