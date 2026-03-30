import posthog from "posthog-js";

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
