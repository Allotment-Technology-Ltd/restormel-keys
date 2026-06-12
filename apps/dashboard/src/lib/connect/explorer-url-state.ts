/**
 * Graph-explorer URL-state contract (W2.1).
 *
 * Extracted from ConnectGraphExplorer.svelte so it can be unit-tested independently
 * of the 4 877-line Svelte monolith.
 *
 * ### URL params
 * | param    | values                                                       | notes                                                  |
 * |----------|--------------------------------------------------------------|--------------------------------------------------------|
 * | `filter` | `review` · `all` · `ok` · `weak` · `unsupported` · `unknown`| queue scope / verdict narrow                           |
 * |          | `unverified` · `contradicted` · `abstained` · `supported`   | EBV verification-state — reserved in W2.1, live in W2.2|
 * |          | `inferred` · `excluded`                                      | EBV states added in W2.2 (every Evidence facet is shareable) |
 * | `unit`   | opaque claim id (string)                                     | select + scroll to a specific claim; opens detail panel|
 *
 * ### Back/forward safety
 * Both params are written via `replaceState` on every change so the URL is always
 * shareable and browser navigation restores the exact view.
 */

export type QueueScope = "review" | "all";

export type VerdictFilter = "ok" | "weak" | "unsupported" | "unknown";

/**
 * EBV verification-state filter values — reserved in W2.1 so inbound links are
 * future-safe; the Evidence facet that acts on them shipped in W2.2.
 * `abstained` is an inbound alias: abstentions land in the `unverified` review state
 * (claims ledger row 10), so the facet maps it there. `inferred` / `excluded` were
 * added in W2.2 so every facet chip round-trips through the URL.
 */
export type VerificationStateFilter =
  | "unverified"
  | "contradicted"
  | "abstained"
  | "supported"
  | "inferred"
  | "excluded";

/** Every value the `filter` param may carry. */
export type ExplorerFilterParam = QueueScope | VerdictFilter | VerificationStateFilter;

const QUEUE_SCOPE_VALUES: ReadonlySet<string> = new Set<QueueScope>(["review", "all"]);
const VERDICT_FILTER_VALUES: ReadonlySet<string> = new Set<VerdictFilter>([
  "ok",
  "weak",
  "unsupported",
  "unknown",
]);
const VERIFICATION_STATE_VALUES: ReadonlySet<string> = new Set<VerificationStateFilter>([
  "unverified",
  "contradicted",
  "abstained",
  "supported",
  "inferred",
  "excluded",
]);

function isQueueScope(v: string): v is QueueScope {
  return QUEUE_SCOPE_VALUES.has(v);
}
function isVerdictFilter(v: string): v is VerdictFilter {
  return VERDICT_FILTER_VALUES.has(v);
}
/** True for EBV verification-state values (reserved, active in W2.2). */
export function isVerificationStateFilter(v: string): v is VerificationStateFilter {
  return VERIFICATION_STATE_VALUES.has(v);
}

export type ExplorerUrlState = {
  /** Queue scope: "review" = awaiting-triage quarantine; "all" = every unit. */
  queueScope: QueueScope;
  /** Optional verdict narrow on top of scope; null = no filter. */
  verdictFilter: VerdictFilter | null;
  /**
   * EBV verification-state filter (W2.2).
   * Parsed and stored now so arriving links are honoured; the Evidence facet
   * renders it in W2.2.
   */
  verificationStateFilter: VerificationStateFilter | null;
  /** If set, select + scroll to this claim id and open its detail panel. */
  selectedUnitId: string | null;
};

/**
 * Parse `?filter` and `?unit` from a URLSearchParams into the typed explorer state.
 *
 * The `filter` param is intentionally multi-purpose:
 * - A QueueScope value (`review` / `all`) sets the scope and clears the verdict narrow.
 * - A VerdictFilter value (`ok` / `weak` / …) sets the verdict and widens scope to "all".
 * - A VerificationStateFilter value (`unverified` / …) is stored for W2.2; the queue
 *   scope stays at its default ("review").
 *
 * Unknown / missing values fall back to the defaults silently.
 */
export function parseExplorerUrlState(params: URLSearchParams): ExplorerUrlState {
  const filterRaw = params.get("filter")?.trim() ?? "";
  const unitRaw = params.get("unit")?.trim() ?? "";

  let queueScope: QueueScope = "review";
  let verdictFilter: VerdictFilter | null = null;
  let verificationStateFilter: VerificationStateFilter | null = null;

  if (filterRaw) {
    if (isQueueScope(filterRaw)) {
      queueScope = filterRaw;
    } else if (isVerdictFilter(filterRaw)) {
      // Verdict narrow implies "all" scope (ok cannot appear in quarantine).
      queueScope = filterRaw === "ok" ? "all" : "review";
      verdictFilter = filterRaw;
    } else if (isVerificationStateFilter(filterRaw)) {
      // Evidence facet (W2.2): verification states span the whole graph, not just
      // the quarantine, so an inbound state link widens scope to "all".
      verificationStateFilter = filterRaw;
      queueScope = "all";
    }
    // Unknown values are silently ignored (defaults apply).
  }

  const selectedUnitId = unitRaw || null;

  return { queueScope, verdictFilter, verificationStateFilter, selectedUnitId };
}

/**
 * Serialise the current explorer state back to search-param key/value pairs.
 *
 * Rules:
 * - `filter` is omitted when scope is "review" AND no verdict/verification filter is active
 *   (that is the default; removing it keeps URLs clean for the common case).
 * - `unit` is omitted when null.
 * - verificationStateFilter writes `filter` only when no verdictFilter is set.
 */
export function buildExplorerSearchParams(state: ExplorerUrlState): URLSearchParams {
  const p = new URLSearchParams();

  if (state.verdictFilter) {
    p.set("filter", state.verdictFilter);
  } else if (state.verificationStateFilter) {
    p.set("filter", state.verificationStateFilter);
  } else if (state.queueScope !== "review") {
    p.set("filter", state.queueScope);
  }
  // "review" with no verdict/verification filter = default → no param (clean URL).

  if (state.selectedUnitId) {
    p.set("unit", state.selectedUnitId);
  }

  return p;
}

/**
 * Build a full URL string by merging updated explorer state into an existing URL,
 * preserving all other params (e.g. `workspace`, `focus`).
 *
 * @param baseUrl  The current URL (typically `$page.url`).
 * @param state    New explorer state to write.
 */
export function buildExplorerUrl(baseUrl: URL, state: ExplorerUrlState): string {
  const next = new URL(baseUrl.href);
  const explorerParams = buildExplorerSearchParams(state);

  // Remove the params we own.
  next.searchParams.delete("filter");
  next.searchParams.delete("unit");

  // Write back.
  if (explorerParams.has("filter")) next.searchParams.set("filter", explorerParams.get("filter")!);
  if (explorerParams.has("unit")) next.searchParams.set("unit", explorerParams.get("unit")!);

  return next.pathname + (next.searchParams.toString() ? "?" + next.searchParams.toString() : "");
}
