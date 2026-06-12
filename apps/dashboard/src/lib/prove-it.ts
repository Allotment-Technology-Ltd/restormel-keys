/**
 * W4.3 — "Prove it" as a global gesture.
 *
 * The brand habit (UX review §3.5 / north-star §2.4): ANY number or badge that
 * asserts trust is a link to its evidence. This module is the single source of
 * truth for that gesture's *destinations* — every prove-it link builds its href
 * here, so each mounted gesture lands on real evidence (rubric X4: no dead ends).
 *
 * No second trust formula (hard rule 1): these are URL builders, not score
 * computations. They quote the W2.1 explorer URL contract (`?unit=` / `?filter=`,
 * with optional `?as_of=` from W2.5) and the canonical section hrefs from
 * `nav-config.ts`. The numbers themselves still come from the scorecard / dossier
 * services — this module only routes the *click* to the receipt behind them.
 *
 * Shared affordance: `PROVE_LINK_CLASS` is the grep-able class the neo-brutalist
 * dotted-underline + ↗ treatment hangs off (defined globally in
 * `lib/styles/brutalist-utilities.css`). The companion `ProveLink.svelte`
 * component renders it; raw `<a>` tags that already carry a prove-it destination
 * may add the class directly. The `prove-it.test.ts` lint asserts the class is
 * present wherever the scorecard service's numbers render.
 */
import { CLAIMS_HREF, RUNS_HREF } from "$lib/nav-config";

/**
 * The grep-able shared class for prove-it links. Distinct from nav links: dotted
 * underline + a trailing ↗ glyph, mono-weighted. One string, one place — change
 * the affordance once and every gesture follows.
 */
export const PROVE_LINK_CLASS = "prove-it";

/**
 * The W2.1 explorer filter the scorecard / verification surfaces deep-link into.
 * Mirrors the params `ConnectGraphExplorer` actually parses
 * (`parseExplorerUrlState`): the queue scope plus the W2.2 verification states.
 * Kept as a union so callers can't invent a dead param — every member here MUST
 * survive `parseExplorerUrlState` (the round-trip guard in `prove-it.test.ts`).
 *
 * NOT included: per-idea evidence-coverage slices. The Evidence-bound and
 * Embedding-coverage scorecard tiles are STORE-LEVEL aggregates — the explorer's
 * unit rows carry no per-unit embedding field, and "unbound" conflates three
 * honestly-distinct populations (pre-EBV / bound-failed / tracked-unbound) the
 * W2.2 facet machinery deliberately refuses to bucket. Rather than ship dead
 * `?filter=unbound` / `?filter=missing_embed` tokens that `parseExplorerUrlState`
 * silently drops to the default queue, those tiles render LINK-LESS (the
 * `vector_index` precedent — honest absence). A real coverage facet (per-unit
 * binding + embedding fields on the units API + an explorer facet + a server
 * breakdown) is the follow-up: see docs/ux-contracts.md §3 coverage-facet TODO.
 */
export type ProveFilter =
  | "review"
  | "supported"
  | "inferred"
  | "unverified"
  | "contradicted"
  | "excluded";

/**
 * Build a deep link into the Claims explorer filtered to one verification slice.
 * The destination behind a scorecard factor row, a state chip, or a metric cell.
 *
 * `asOf` (optional) threads the W2.5 as-of time-travel param so a prove-it click
 * from an as-of view lands on the same point in time (read-only tier respected —
 * as-of is a read feature).
 */
export function proveClaimsFilterHref(filter: ProveFilter, asOf?: string | null): string {
  const params = new URLSearchParams({ filter });
  if (asOf) params.set("as_of", asOf);
  return `${CLAIMS_HREF}?${params.toString()}`;
}

/**
 * Build a deep link into a single claim's Evidence Dossier (W2.2 URL contract:
 * `?unit=<id>`). The destination behind a proof-drawer claim, an MCP-answer
 * verified-claim row, or any badge that names one claim.
 */
export function proveDossierHref(unitId: string, asOf?: string | null): string {
  const params = new URLSearchParams({ unit: unitId });
  if (asOf) params.set("as_of", asOf);
  return `${CLAIMS_HREF}?${params.toString()}`;
}

/**
 * Build a deep link to the producing run for a verdict / regression. When the
 * verdict carries its source run we land on that run's detail; otherwise we
 * honestly degrade to the filtered review queue (the diffed claims) rather than
 * a dead link — the UX review's "REGRESSION → the diffed claims" rule, with the
 * Stage-2.2 degrade path the roadmap names.
 */
export function proveRunVerdictHref(
  sourceRunId: string | null | undefined,
  opts?: { from?: string },
): string {
  if (sourceRunId) {
    const params = new URLSearchParams();
    if (opts?.from) params.set("from", opts.from);
    const qs = params.toString();
    return `${RUNS_HREF}/${sourceRunId}${qs ? `?${qs}` : ""}`;
  }
  // Degrade: no run identity on the verdict payload → the review queue.
  return proveClaimsFilterHref("review");
}
