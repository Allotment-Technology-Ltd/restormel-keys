/**
 * Baseline/diff semantics for `keys connect eval --baseline` (Stage 2.2 — Context Regression CI).
 * Pure functions — no I/O — so diffing, regression detection, and exit codes are unit-testable.
 *
 * Baselines are keyed by source-set fingerprint (goldenExtractionEvalFingerprint in
 * @restormel/connect-core): when the fingerprint changed, the corpus changed, so the
 * baseline is SUPERSEDED — regression checks are skipped, never reported as a regression.
 * Shapes are the versioned contracts in @restormel/contracts/connect-eval (no parallel shapes).
 */
import {
  CONNECT_EVAL_BASELINE_SCHEMA_VERSION,
  CONNECT_EVAL_DIFF_SCHEMA_VERSION,
  ConnectEvalBaselineSchema,
  ConnectEvalDiffSchema,
  type ConnectEvalBaseline,
  type ConnectEvalClaimRef,
  type ConnectEvalDiff,
  type ConnectEvalVerdict,
} from "@restormel/contracts/connect-eval";
import { EVAL_EXIT_PASS, EVAL_EXIT_QUALITY_FAIL } from "./connect-eval.js";

/**
 * Regression exit code — distinct from absolute-bar failure (packages/validate precedent:
 * 0 ok / 1 confirmed-fail / 2 config error / 3 secondary signal).
 */
export const EVAL_EXIT_REGRESSION = 3;

/**
 * Default allowed drop (points) for ok_pct and trust_score before flagging a regression.
 * G2 percentages are integer-rounded, so 1 point absorbs rounding jitter; override with --tolerance.
 */
export const DEFAULT_EVAL_TOLERANCE = 1;

export type ParseBaselineResult =
  | { ok: true; baseline: ConnectEvalBaseline }
  | { ok: false; error: string };

/** Build the committed-friendly baseline artifact (--save-baseline). */
export function buildBaseline(verdict: ConnectEvalVerdict, savedAt: string): ConnectEvalBaseline {
  return ConnectEvalBaselineSchema.parse({
    schema_version: CONNECT_EVAL_BASELINE_SCHEMA_VERSION,
    saved_at: savedAt,
    ...(verdict.fingerprint !== undefined ? { fingerprint: verdict.fingerprint } : {}),
    verdict,
  });
}

/** Parse a stored baseline document, with a readable error instead of a zod stack. */
export function parseBaseline(json: unknown): ParseBaselineResult {
  const parsed = ConnectEvalBaselineSchema.safeParse(json);
  if (parsed.success) return { ok: true, baseline: parsed.data };
  const issues = parsed.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return {
    ok: false,
    error: `Not a valid connect-eval baseline (expected --save-baseline output, schema ${CONNECT_EVAL_BASELINE_SCHEMA_VERSION}): ${issues}`,
  };
}

/**
 * Stable claim identity for new-unsupported-claim detection: the pipeline's claim id when
 * present, else normalized text + source ref. Identity, not count — re-ordered or re-counted
 * claims are not regressions; a claim that was not unsupported at baseline time is.
 */
export function claimIdentity(claim: ConnectEvalClaimRef): string {
  if (claim.id) return `id:${claim.id}`;
  const text = claim.text.replace(/\s+/g, " ").trim().toLowerCase();
  return `text:${text}|${claim.source_ref ?? ""}`;
}

/** Compare the current verdict to a stored baseline. Validated against the diff contract. */
export function computeEvalDiff(args: {
  baseline: ConnectEvalBaseline;
  current: ConnectEvalVerdict;
  comparedAt: string;
  /** Allowed drop (points) for ok_pct / trust_score. Defaults to DEFAULT_EVAL_TOLERANCE. */
  tolerance?: number;
}): ConnectEvalDiff {
  const tolerance = args.tolerance ?? DEFAULT_EVAL_TOLERANCE;
  const base = args.baseline.verdict;
  const cur = args.current;

  const baselineFingerprint = args.baseline.fingerprint ?? base.fingerprint;
  const currentFingerprint = cur.fingerprint;
  const fingerprintChanged = Boolean(
    baselineFingerprint && currentFingerprint && baselineFingerprint !== currentFingerprint,
  );

  const bothTrust = base.trust_score !== undefined && cur.trust_score !== undefined;
  const bothGaps = base.coverage_gaps !== undefined && cur.coverage_gaps !== undefined;
  const deltas = {
    ok_pct: cur.g2.ok_pct - base.g2.ok_pct,
    unsupported_pct: cur.g2.unsupported_pct - base.g2.unsupported_pct,
    ...(bothTrust ? { trust_score: cur.trust_score! - base.trust_score! } : {}),
    ...(bothGaps ? { coverage_gaps: cur.coverage_gaps! - base.coverage_gaps! } : {}),
  };

  const claimsCompared =
    !fingerprintChanged &&
    base.unsupported_claims !== undefined &&
    cur.unsupported_claims !== undefined;

  const regressions: string[] = [];
  let newUnsupportedClaims: ConnectEvalClaimRef[] = [];

  if (!fingerprintChanged) {
    if (deltas.ok_pct < -tolerance) {
      regressions.push(
        `ok_pct dropped ${base.g2.ok_pct}% → ${cur.g2.ok_pct}% (Δ ${deltas.ok_pct} beyond tolerance ${tolerance})`,
      );
    }
    if (deltas.trust_score !== undefined && deltas.trust_score < -tolerance) {
      regressions.push(
        `trust_score dropped ${base.trust_score} → ${cur.trust_score} (Δ ${deltas.trust_score} beyond tolerance ${tolerance})`,
      );
    }
    if (deltas.coverage_gaps !== undefined && deltas.coverage_gaps > 0) {
      regressions.push(
        `coverage_gaps increased ${base.coverage_gaps} → ${cur.coverage_gaps} (+${deltas.coverage_gaps} new)`,
      );
    }
    if (claimsCompared) {
      const baselineIdentities = new Set(base.unsupported_claims!.map(claimIdentity));
      newUnsupportedClaims = cur.unsupported_claims!.filter(
        (c) => !baselineIdentities.has(claimIdentity(c)),
      );
      for (const c of newUnsupportedClaims) {
        regressions.push(
          `new unsupported claim: "${c.text}"${c.source_ref ? ` (source: ${c.source_ref})` : ""}`,
        );
      }
    }
  }

  return ConnectEvalDiffSchema.parse({
    schema_version: CONNECT_EVAL_DIFF_SCHEMA_VERSION,
    compared_at: args.comparedAt,
    baseline_saved_at: args.baseline.saved_at,
    ...(baselineFingerprint !== undefined ? { baseline_fingerprint: baselineFingerprint } : {}),
    ...(currentFingerprint !== undefined ? { current_fingerprint: currentFingerprint } : {}),
    fingerprint_changed: fingerprintChanged,
    tolerance,
    deltas,
    claims_compared: claimsCompared,
    new_unsupported_claims: newUnsupportedClaims,
    regression: regressions.length > 0,
    regressions,
  });
}

/**
 * Verdict (+ optional diff) → process exit code. Absolute-bar failure (1) wins over
 * regression (3) — validate precedent: confirmed failure beats the secondary signal.
 */
export function exitCodeForEval(verdict: ConnectEvalVerdict, diff?: ConnectEvalDiff): number {
  if (!verdict.pass) return EVAL_EXIT_QUALITY_FAIL;
  if (diff?.regression) return EVAL_EXIT_REGRESSION;
  return EVAL_EXIT_PASS;
}
