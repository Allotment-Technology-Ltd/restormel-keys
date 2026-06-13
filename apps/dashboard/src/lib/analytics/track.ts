/**
 * Typed `track()` helper — the ONE way public-page code should emit custom
 * PostHog events. Wraps `posthog.capture` so it is:
 *  - type-safe (event name + payload validated against AnalyticsEventMap),
 *  - SSR-safe (no-op when not in the browser),
 *  - crash-safe (never throws if PostHog hasn't loaded or is opted out).
 *
 * Consent: PostHog itself enforces opt-out (when the visitor has denied consent
 * we call `posthog.opt_out_capturing()` in hooks.client.ts, after which capture
 * is a no-op). `track()` therefore doesn't re-check consent — it stays a thin,
 * predictable wrapper. In cookieless ("unknown") mode events are still captured
 * but with memory-only persistence and no persistent identity.
 */
import posthog from "posthog-js";
import { browser } from "$app/environment";
import type { AnalyticsEventName, AnalyticsEventProps } from "./events";

/**
 * Emit a typed analytics event.
 *
 * @example track("hero_cta_click", { surface: "home", cta: "get_started" })
 */
export function track<E extends AnalyticsEventName>(
  event: E,
  // Props optional only when the event's payload has no required keys.
  ...args: RequiredKeys<AnalyticsEventProps<E>> extends never
    ? [props?: AnalyticsEventProps<E>]
    : [props: AnalyticsEventProps<E>]
): void {
  if (!browser) return;
  const [props] = args;
  try {
    posthog.capture?.(event, props as Record<string, unknown> | undefined);
  } catch {
    // PostHog not loaded / opted out — silently ignore.
  }
}

/** True if the type T has at least one required key. */
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];
