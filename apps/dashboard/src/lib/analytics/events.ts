/**
 * Restormel public-page analytics — typed event taxonomy.
 *
 * Single source of truth for every CUSTOM event name + its payload shape.
 * Page-owner agents import from here and call `track()` (see ./track.ts) so
 * event names and props stay consistent across the marketing + docs surface.
 *
 * Conventions
 * -----------
 * - Event names are lowercase snake_case verbs/nouns, stable forever once shipped
 *   (renaming an event breaks historical analysis in PostHog).
 * - Payloads are FLAT objects of primitives only — no nested objects, no arrays
 *   of objects (PostHog property filtering works best on flat scalars).
 * - NO PII. Never put email, name, free-text the user typed, IP, or any raw
 *   identifier in a payload. Capture buckets/booleans/enums instead.
 * - `$pageview`, `$pageleave`, and `$autocapture` are PostHog built-ins and are
 *   intentionally NOT modelled here; pageview enrichment lives in hooks.client.ts.
 */

/** Marketing route groups used for segmentation (kept coarse + PII-free). */
export type RouteGroup =
  | "home"
  | "marketing"
  | "pricing"
  | "founders"
  | "docs"
  | "integrations"
  | "graph"
  | "testing"
  | "connect"
  | "dashboard"
  | "auth"
  | "admin"
  | "legal"
  | "other";

/** Which marketing suite a CTA points at (matches the home intent doors). */
export type SuiteIntent = "run" | "embed";

/** First-run onboarding milestones (existing dashboard funnel). */
export type OnboardingStep = "mode_selected" | "stack_selected" | "complete";

/** Fake-door / coming-soon interest actions (existing Monitor demand signal). */
export type FeatureInterestAction =
  | "section_expand"
  | "item_click"
  | "direct_navigation"
  | "notify_feedback";

/**
 * Canonical event → payload map. Add new public-page events HERE, then the
 * `track()` helper and every call site become type-safe automatically.
 */
export interface AnalyticsEventMap {
  // --- Hero / primary CTAs -------------------------------------------------
  /** A hero / above-the-fold primary CTA was clicked. */
  hero_cta_click: {
    /** Coarse location of the hero, e.g. "home", "keys", "graph". */
    surface: string;
    /** Stable CTA identifier, e.g. "get_started", "book_demo". */
    cta: string;
    /** Optional A/B variant the visitor saw. */
    variant?: "control" | "test";
  };

  /** The signup CTA was clicked (pre-existing event — kept for continuity). */
  signup_clicked: {
    /** Where the click happened, e.g. "landing_variant_a". */
    surface?: string;
    variant?: "control" | "test";
  };

  /** Home IA intent door selected (Run vs Embed) — pre-existing event. */
  suite_intent_selected: {
    intent: SuiteIntent;
  };

  // --- Pricing -------------------------------------------------------------
  /** The pricing page (or an embedded pricing block) became visible. */
  pricing_viewed: {
    /** Where pricing was shown, e.g. "pricing_page", "home_inline". */
    surface: string;
    /** Optional plan/tier highlighted when viewed. */
    plan?: string;
  };

  // --- Docs ----------------------------------------------------------------
  /** A docs search was performed. Query text is NOT captured (PII risk). */
  docs_search: {
    /** Length bucket of the query, not the query itself. */
    query_length: "empty" | "short" | "medium" | "long";
    /** Number of results returned (0 = no results — useful for content gaps). */
    results_count: number;
  };

  /** A docs page passed an engagement threshold (e.g. scrolled + dwelled). */
  doc_page_engaged: {
    /** Stable docs slug/section, e.g. "quickstart", "reference/api". */
    section: string;
    /** Scroll depth milestone reached on this doc, if known. */
    depth?: ScrollDepthMilestone;
  };

  // --- Outbound ------------------------------------------------------------
  /** A link to an external (different-host) destination was clicked. */
  outbound_link_click: {
    /** Hostname of the destination only (no path/query — avoids leaking PII). */
    target_host: string;
    /** Route group the click originated from. */
    from_group: RouteGroup;
    /** rel="..." of the anchor, if any (e.g. "noopener"). */
    rel?: string;
  };

  // --- Founders funnel -----------------------------------------------------
  /** Visitor began interacting with the founders application form. */
  founders_apply_started: {
    /** Where the form lives, e.g. "founders_page". */
    surface: string;
  };

  /** Founders application was successfully submitted. NO form field values. */
  founders_apply_submitted: {
    surface: string;
    /** Count of suite modules selected — NOT which ones / not free text. */
    modules_selected?: number;
  };

  // --- Existing dashboard signals (kept for a single typed surface) --------
  /** Dashboard first-run onboarding milestone. */
  dashboard_onboarding_step: {
    step: OnboardingStep | string;
  };

  /** Coming-soon / fake-door interest signal (Monitor demand). */
  dashboard_feature_interest: {
    feature: "monitor";
    action: FeatureInterestAction;
    item?: string;
  };

  // --- Verified-answer falsifiability (Phase 3 north metric) ---------------
  /**
   * THE Phase 3 north metric: a user clicked a verified claim in the Prove /
   * Answer console through to its source span (evidence dossier) — the
   * falsifiability test actually performed. Only non-PII ids/enums are captured;
   * never the claim text, source title, or the user's question.
   */
  verified_claim_source_span_opened: {
    /** Opaque workspace id (non-PII scoping key), or "anon" when unavailable. */
    workspace_id: string;
    /** Opaque claim/unit id the user clicked through (links to its source span). */
    claim_id: string;
    /** Verification verdict on the clicked claim. */
    verification: ProvenanceVerification;
    /** Trust-score bucket (not the raw score) — coarse, PII-free. */
    trust_bucket: TrustBucket;
    /**
     * True when this is a first-run session (onboarding not yet completed) — the
     * metric specifically tracks the FIRST-RUN falsifiability click.
     */
    is_first_run: boolean;
    /** Where the click happened, e.g. "prove_console". */
    surface: string;
  };

  // --- Engagement (emitted by global handlers in hooks.client.ts) ----------
  /** A scroll-depth milestone was reached on the current page. */
  scroll_depth: {
    depth: ScrollDepthMilestone;
    /** Route group the scroll happened in. */
    group: RouteGroup;
  };
}

/** Trust-score bucket for verified-claim events (kept coarse + PII-free). */
export type TrustBucket = "high" | "medium" | "low" | "unscored";

/** Verdict on a verified claim (mirrors $lib/connect ProvenanceVerification). */
export type ProvenanceVerification = "supported" | "weak";

/** Scroll-depth milestones the global handler emits. */
export type ScrollDepthMilestone = 25 | 50 | 75 | 100;

/** Union of every valid event name. */
export type AnalyticsEventName = keyof AnalyticsEventMap;

/** Payload type for a given event name. */
export type AnalyticsEventProps<E extends AnalyticsEventName> = AnalyticsEventMap[E];

/**
 * Canonical, runtime-iterable list of every public-page event name. Exported so
 * page-owner agents (and tests / docs generators) can enumerate the taxonomy
 * without re-deriving it. Keep in sync with `AnalyticsEventMap` — the
 * satisfies-check below fails the build if a key is missing or extra.
 */
export const ANALYTICS_EVENTS = [
  "hero_cta_click",
  "signup_clicked",
  "suite_intent_selected",
  "pricing_viewed",
  "docs_search",
  "doc_page_engaged",
  "outbound_link_click",
  "founders_apply_started",
  "founders_apply_submitted",
  "dashboard_onboarding_step",
  "dashboard_feature_interest",
  "verified_claim_source_span_opened",
  "scroll_depth",
] as const satisfies readonly AnalyticsEventName[];

/**
 * Compile-time guarantee that ANALYTICS_EVENTS covers every key in the map
 * (no missing entries). If you add a key to AnalyticsEventMap but forget to add
 * it to ANALYTICS_EVENTS, this assignment errors.
 */
type _AssertAllEventsListed = AnalyticsEventName extends (typeof ANALYTICS_EVENTS)[number]
  ? true
  : ["Missing event in ANALYTICS_EVENTS", Exclude<AnalyticsEventName, (typeof ANALYTICS_EVENTS)[number]>];
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _assertAllEventsListed: _AssertAllEventsListed = true;
