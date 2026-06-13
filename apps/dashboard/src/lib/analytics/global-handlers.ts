/**
 * Global, app-wide analytics handlers wired ONCE from hooks.client.ts.
 *
 * These run for every page without per-page code:
 *  1. Enriched pageview props — register `route_group` + `signed_in` as event
 *     properties so each `$pageview` (and every other event) carries coarse,
 *     PII-free context for segmentation.
 *  2. Outbound-link capture — a single delegated click listener that fires
 *     `outbound_link_click` whenever an anchor to a different host is clicked.
 *  3. Scroll-depth milestones — emits `scroll_depth` at 25/50/75/100% once per
 *     page (reset on SPA navigation).
 *
 * Design notes
 * ------------
 * - Delegated listeners (one per concern) keep this O(1) regardless of DOM size.
 * - SSR-safe: `setupAnalyticsHandlers` is a no-op outside the browser.
 * - PII-safe: only hostnames, route groups, booleans, and milestone ints are
 *   ever sent — never full URLs, query strings, or anything the user typed.
 * - `signed_in` is derived from a caller-supplied getter so this module stays
 *   decoupled from the auth/page store.
 */
import posthog from "posthog-js";
import { track } from "./track";
import { routeGroupForPath } from "./route-group";
import type { ScrollDepthMilestone } from "./events";

const SCROLL_MILESTONES: readonly ScrollDepthMilestone[] = [25, 50, 75, 100];

export interface AnalyticsHandlerOptions {
  /** Returns whether the current visitor is signed in (read lazily per event). */
  isSignedIn: () => boolean;
}

/** Track which scroll milestones we've already fired for the current page. */
let firedMilestones = new Set<ScrollDepthMilestone>();
let currentPath = "";

/** Register/refresh always-on event properties for the current page. */
function registerPageProps(isSignedIn: () => boolean): void {
  try {
    posthog.register?.({
      route_group: routeGroupForPath(window.location.pathname),
      signed_in: Boolean(isSignedIn()),
    });
  } catch {
    // PostHog not loaded yet — will be set on the next navigation.
  }
}

/** Compute the current scroll depth as a 0–100 percentage. */
function currentScrollPercent(): number {
  const doc = document.documentElement;
  const scrollTop = window.scrollY || doc.scrollTop || 0;
  const viewport = window.innerHeight || doc.clientHeight || 0;
  const full = Math.max(doc.scrollHeight, document.body?.scrollHeight ?? 0);
  const scrollable = full - viewport;
  if (scrollable <= 0) return 100; // Short page: treat as fully seen.
  return Math.min(100, Math.round(((scrollTop + viewport) / full) * 100));
}

function emitScrollMilestones(): void {
  const percent = currentScrollPercent();
  const group = routeGroupForPath(window.location.pathname);
  for (const milestone of SCROLL_MILESTONES) {
    if (percent >= milestone && !firedMilestones.has(milestone)) {
      firedMilestones.add(milestone);
      track("scroll_depth", { depth: milestone, group });
    }
  }
}

/** Reset scroll tracking when the SPA navigates to a new path. */
export function resetForNavigation(isSignedIn: () => boolean): void {
  if (typeof window === "undefined") return;
  if (window.location.pathname === currentPath) return;
  currentPath = window.location.pathname;
  firedMilestones = new Set();
  registerPageProps(isSignedIn);
  // A new page might already be short enough to be "fully seen".
  emitScrollMilestones();
}

function nearestAnchor(target: EventTarget | null): HTMLAnchorElement | null {
  let el = target as HTMLElement | null;
  while (el && el !== document.body) {
    if (el instanceof HTMLAnchorElement) return el;
    el = el.parentElement;
  }
  return null;
}

function handleOutboundClick(event: MouseEvent): void {
  const anchor = nearestAnchor(event.target);
  if (!anchor) return;
  const href = anchor.getAttribute("href");
  if (!href) return;

  // Ignore in-page anchors, mailto:, tel:, javascript:, etc.
  if (/^(#|mailto:|tel:|javascript:|sms:)/i.test(href)) return;

  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // Only external (different-host) links count as outbound.
  if (url.host === window.location.host) return;

  track("outbound_link_click", {
    target_host: url.host, // hostname only — never path/query (PII risk).
    from_group: routeGroupForPath(window.location.pathname),
    rel: anchor.rel || undefined,
  });
}

/**
 * Wire all global analytics handlers. Idempotent enough to call once at boot.
 * Returns a teardown function (mainly for tests / HMR cleanliness).
 */
export function setupAnalyticsHandlers(options: AnalyticsHandlerOptions): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }
  const { isSignedIn } = options;

  currentPath = window.location.pathname;
  firedMilestones = new Set();
  registerPageProps(isSignedIn);

  // Outbound links: delegated, capture phase so we still record even if a
  // handler stops propagation later.
  const onClick = (e: MouseEvent) => handleOutboundClick(e);
  document.addEventListener("click", onClick, { capture: true });

  // Scroll depth: passive + rAF-throttled to avoid layout thrash.
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      emitScrollMilestones();
      ticking = false;
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });

  // Evaluate once in case the initial page is already short / pre-scrolled.
  emitScrollMilestones();

  return () => {
    document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
    window.removeEventListener("scroll", onScroll);
  };
}
