/**
 * Public-page analytics foundation (PostHog EU).
 *
 * Page-owner agents should import from this barrel:
 *   import { track, ANALYTICS_EVENTS } from "$lib/analytics";
 *
 * Wiring (global handlers, consent gating, enriched pageviews) lives in
 * hooks.client.ts and is set up once at boot — pages only need `track()`.
 */
export { track } from "./track";
export {
  ANALYTICS_EVENTS,
  type AnalyticsEventName,
  type AnalyticsEventMap,
  type AnalyticsEventProps,
  type RouteGroup,
  type ScrollDepthMilestone,
  type SuiteIntent,
} from "./events";
export { routeGroupForPath } from "./route-group";
export {
  getConsentState,
  hasAnalyticsConsent,
  setConsentState,
  CONSENT_COOKIE,
  type ConsentState,
} from "./consent";
export {
  setupAnalyticsHandlers,
  resetForNavigation,
  type AnalyticsHandlerOptions,
} from "./global-handlers";
