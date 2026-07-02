/**
 * RES-113 · verification-engine economics — PR-8 derivation (placement spec §3.3 /
 * §5 item 9; copy pack §2.8; REC-ADR-016).
 *
 * Pure TS. Exactly TWO render surfaces consume this module (copy pack §2.8):
 * rows on the Metrics page (`/analytics`) and ONE summary line inside the run
 * console's existing "Show details" disclosure. Both render only behind the
 * `m1PlugPoints` flag (spec §5: Build-cluster work) — flag OFF, the default path
 * stays byte-for-byte identical. Never a cost figure on Home, on a Build panel,
 * or on any journey surface (pinned by verification-economics.reachability.test.ts);
 * no tier or cache vocabulary anywhere in output (pinned below); weekly-CI-gate
 * views stay internal.
 *
 * Honest absence (§0 — load-bearing here): a measurement the run or corpus didn't
 * record renders its row or segment ABSENT — never `0`, never `—`. Every count is
 * a real counted unit; the populations are independent and are never summed into
 * a single total (REC-ADR-016).
 *
 * The measurement source is the merged cascade economics module
 * (`packages/connect-core/src/cascade/economics.ts`): `economicsFromReport` maps
 * one per-corpus `EconomicsReport` to the neutral persisted shape below. Nothing
 * in production records these yet — until the cascade wires into ingest, every
 * surface honestly renders nothing (state earns pixels).
 */
import type { EconomicsReport } from "@restormel/connect-core/cascade";
import { journeyStageName } from "$lib/connect/stage-vocabulary";

/**
 * Neutral persisted per-corpus economics measurements. Every measurement field is
 * OPTIONAL: absent means "not recorded" and renders nothing (a recorded 0 is a
 * real counted unit and does render). No vendor shapes, no tier/cache fields —
 * these are the five §2.8 populations only.
 */
export type RunVerificationEconomics = {
  /** Document-set name this partition was measured on (never the word "corpus" on screen). */
  corpus?: string;
  /** How many facts were checked against the documents they came from. */
  facts_checked?: number;
  /** Results carried over from an earlier build instead of being checked again. */
  reused_from_earlier_builds?: number;
  /** Facts the quick check couldn't settle, passed to a stronger check. */
  sent_for_closer_look?: number;
  /** Facts waiting for the user's verdict in Verify. */
  awaiting_review?: number;
  /** Authoritative spend in USD; absent when no authoritative usage was seen. */
  spend_usd?: number;
};

/**
 * Metrics section heading — reuses the §0 stage-table on-screen name for the
 * validate stage ("Checking against sources"), a reference, not a new string
 * (registered as such in copy pack §2.8).
 */
export const VERIFICATION_ECONOMICS_SECTION_HEADING = journeyStageName("validating");

/** Copy pack §2.8 — Metrics row labels + first-contact glosses, VERBATIM. */
export const VERIFICATION_ECONOMICS_ROW_COPY = {
  facts_checked: {
    label: "Facts checked",
    gloss: "How many facts were checked against the documents they came from.",
  },
  reused_from_earlier_builds: {
    label: "Re-used from earlier builds",
    gloss: "Results carried over from an earlier build instead of being checked again.",
  },
  sent_for_closer_look: {
    label: "Sent for a closer look",
    gloss: "Facts the quick check couldn't settle, passed to a stronger check.",
  },
  awaiting_review: {
    label: "Awaiting review",
    gloss: "Facts waiting for your verdict in Verify.",
  },
  spend_usd: {
    label: "Spend",
    gloss: "What the checks cost to run, across providers.",
  },
} as const;

export type VerificationEconomicsRowKey = keyof typeof VERIFICATION_ECONOMICS_ROW_COPY;

/** Render order for the §2.8 Metrics rows (the pack's table order). */
const ROW_ORDER: readonly VerificationEconomicsRowKey[] = [
  "facts_checked",
  "reused_from_earlier_builds",
  "sent_for_closer_look",
  "awaiting_review",
  "spend_usd",
];

export type VerificationEconomicsRow = {
  key: VerificationEconomicsRowKey;
  /** Copy pack §2.8 row label, verbatim. */
  label: string;
  /** Copy pack §2.8 first-contact gloss (hover/aria on the row), verbatim. */
  gloss: string;
  /** Formatted counted value ("1,204") or spend ("$1.42"). */
  value: string;
};

/** A non-negative finite recorded count, or undefined (absent — not recorded). */
function recordedCount(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return undefined;
  return Math.round(raw);
}

/** A non-negative finite recorded USD amount, or undefined (absent). */
function recordedUsd(raw: unknown): number | undefined {
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0) return undefined;
  return raw;
}

/**
 * Spend formatting: dollars at 2dp; sub-cent authoritative spend keeps 4dp so a
 * real small measurement is never rounded into a fabricated "$0.00".
 */
export function formatSpendUsd(usd: number): string {
  const clamped = Number.isFinite(usd) && usd > 0 ? usd : 0;
  const dp = clamped > 0 && clamped < 0.01 ? 4 : 2;
  return "$" + clamped.toFixed(dp);
}

/**
 * Defensive parse of a persisted `verification_economics` value (JSONB-shaped,
 * per-field typeof narrowing — the connect-core `parseJsonLoose` idiom). Entries
 * with no recorded measurement are dropped (no recorded economics ⇒ nothing).
 */
export function parseRunVerificationEconomics(raw: unknown): RunVerificationEconomics[] {
  const list = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? [raw] : [];
  const out: RunVerificationEconomics[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const entry: RunVerificationEconomics = {
      ...(typeof rec.corpus === "string" && rec.corpus.trim()
        ? { corpus: rec.corpus.trim() }
        : {}),
    };
    const facts = recordedCount(rec.facts_checked);
    const reused = recordedCount(rec.reused_from_earlier_builds);
    const closer = recordedCount(rec.sent_for_closer_look);
    const awaiting = recordedCount(rec.awaiting_review);
    const spend = recordedUsd(rec.spend_usd);
    if (facts !== undefined) entry.facts_checked = facts;
    if (reused !== undefined) entry.reused_from_earlier_builds = reused;
    if (closer !== undefined) entry.sent_for_closer_look = closer;
    if (awaiting !== undefined) entry.awaiting_review = awaiting;
    if (spend !== undefined) entry.spend_usd = spend;
    if (hasAnyMeasurement(entry)) out.push(entry);
  }
  return out;
}

export function hasAnyMeasurement(m: RunVerificationEconomics): boolean {
  return (
    m.facts_checked !== undefined ||
    m.reused_from_earlier_builds !== undefined ||
    m.sent_for_closer_look !== undefined ||
    m.awaiting_review !== undefined ||
    m.spend_usd !== undefined
  );
}

/**
 * Map one per-corpus cascade `EconomicsReport` (connect-core cascade/economics.ts)
 * to the neutral measurement shape. Counts are recovered from each Estimate's own
 * (value, n) pair — value is k/n, so `round(value·n)` is the original counted k.
 * A report over zero claims recorded nothing → null (honest absence, never zeros).
 * Spend is present only when at least one claim carried an authoritative cost.
 */
export function economicsFromReport(report: EconomicsReport): RunVerificationEconomics | null {
  if (!Number.isFinite(report.claims) || report.claims <= 0) return null;
  const countOf = (est: { value: number; n: number }): number =>
    Math.round(est.value * est.n);
  const entry: RunVerificationEconomics = {
    corpus: report.corpus,
    facts_checked: report.claims,
    reused_from_earlier_builds: countOf(report.cacheHitRate),
    sent_for_closer_look: countOf(report.escalationRate),
    awaiting_review: countOf(report.abstentionRate),
  };
  if (report.claimsWithAuthoritativeCost > 0) {
    entry.spend_usd = report.costPerVerifiedClaim.value * report.claimsWithAuthoritativeCost;
  }
  return entry;
}

/**
 * Aggregate measurements per corpus (independent populations; each field sums
 * only across entries that RECORDED it — absent fields stay absent, never 0).
 */
export function aggregateEconomicsByCorpus(
  entries: readonly RunVerificationEconomics[],
): RunVerificationEconomics[] {
  const byCorpus = new Map<string, RunVerificationEconomics>();
  for (const entry of entries) {
    if (!hasAnyMeasurement(entry)) continue;
    const key = entry.corpus ?? "";
    const agg = byCorpus.get(key) ?? (entry.corpus ? { corpus: entry.corpus } : {});
    addField(agg, entry, "facts_checked");
    addField(agg, entry, "reused_from_earlier_builds");
    addField(agg, entry, "sent_for_closer_look");
    addField(agg, entry, "awaiting_review");
    addField(agg, entry, "spend_usd");
    byCorpus.set(key, agg);
  }
  return [...byCorpus.values()];
}

function addField(
  agg: RunVerificationEconomics,
  entry: RunVerificationEconomics,
  key: Exclude<keyof RunVerificationEconomics, "corpus">,
): void {
  const v = entry[key];
  if (v === undefined) return;
  agg[key] = (agg[key] ?? 0) + v;
}

/**
 * Metrics rows for one per-corpus measurement set. A row exists ONLY for a
 * recorded measurement (absent-not-zero, §2.8); no measurements ⇒ no rows ⇒ the
 * section renders nothing (state earns pixels).
 */
export function resolveVerificationEconomicsRows(
  m: RunVerificationEconomics,
): VerificationEconomicsRow[] {
  const rows: VerificationEconomicsRow[] = [];
  for (const key of ROW_ORDER) {
    const raw = m[key];
    if (raw === undefined) continue;
    rows.push({
      key,
      label: VERIFICATION_ECONOMICS_ROW_COPY[key].label,
      gloss: VERIFICATION_ECONOMICS_ROW_COPY[key].gloss,
      value: key === "spend_usd" ? formatSpendUsd(raw) : raw.toLocaleString(),
    });
  }
  return rows;
}

/**
 * The ONE per-run summary line for the run console's "Show details" disclosure
 * (copy pack §2.8, verbatim template + segment singulars):
 *   "Checked {n} facts · {m} re-used from earlier builds · {k} sent for a closer
 *    look · {j} awaiting your review · {spend} spent."
 * Each segment renders independently on the honest-absence rule; a run with no
 * recorded economics renders no line at all (null).
 */
export function buildRunEconomicsSummary(
  entries: readonly RunVerificationEconomics[] | RunVerificationEconomics | null | undefined,
): string | null {
  const list = entries == null ? [] : Array.isArray(entries) ? entries : [entries];
  const merged = aggregateAll(list);
  const segments: string[] = [];
  if (merged.facts_checked !== undefined) {
    segments.push(
      merged.facts_checked === 1
        ? "Checked 1 fact"
        : `Checked ${merged.facts_checked.toLocaleString()} facts`,
    );
  }
  if (merged.reused_from_earlier_builds !== undefined) {
    segments.push(
      merged.reused_from_earlier_builds === 1
        ? "1 re-used from an earlier build"
        : `${merged.reused_from_earlier_builds.toLocaleString()} re-used from earlier builds`,
    );
  }
  if (merged.sent_for_closer_look !== undefined) {
    segments.push(
      merged.sent_for_closer_look === 1
        ? "1 sent for a closer look"
        : `${merged.sent_for_closer_look.toLocaleString()} sent for a closer look`,
    );
  }
  if (merged.awaiting_review !== undefined) {
    segments.push(
      merged.awaiting_review === 1
        ? "1 awaiting your review"
        : `${merged.awaiting_review.toLocaleString()} awaiting your review`,
    );
  }
  if (merged.spend_usd !== undefined) {
    segments.push(`${formatSpendUsd(merged.spend_usd)} spent`);
  }
  if (segments.length === 0) return null;
  return segments.join(" · ") + ".";
}

/** Merge every entry (a run's per-corpus partitions) into one absent-preserving set. */
function aggregateAll(list: readonly RunVerificationEconomics[]): RunVerificationEconomics {
  const merged: RunVerificationEconomics = {};
  for (const entry of list) {
    addField(merged, entry, "facts_checked");
    addField(merged, entry, "reused_from_earlier_builds");
    addField(merged, entry, "sent_for_closer_look");
    addField(merged, entry, "awaiting_review");
    addField(merged, entry, "spend_usd");
  }
  return merged;
}
