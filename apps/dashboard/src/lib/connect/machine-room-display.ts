/**
 * W4.1 "Machine Room" — run-console showcase display logic (pure; unit-tested).
 *
 * The 10-minute first-run wait becomes the product demo (UX review §3.2). Every
 * value here is derived from the SSE-fed run state the console ALREADY holds — the
 * `job.stages[]` rows (`@restormel/connect-core` worker-stub shape, streamed by
 * `connectIngestJobRecordToApi` in the events endpoint) and `job.progress` — plus
 * the live `nowMs` clock. NOTHING here fetches or polls: the console keeps its
 * 2-mutation-fetch invariant (mobile read-only contract); these helpers only
 * project existing state into the heartbeat strip, the per-stage odometers, and the
 * single completion ledger.
 *
 * Kept out of the `.svelte` file so the odometer accumulation, the heartbeat tick
 * model, and the completion-ledger verdict are unit-testable without a DOM.
 */
import type { ConnectIngestStageProgress } from "@restormel/connect-core/ingest/worker-stub";
import { CONNECT_INGEST_PIPELINE_STAGES } from "@restormel/connect-core/ingest/job-record";
import { CONNECT_PIPELINE_STAGE_LABELS } from "@restormel/connect-core/ingest/pipeline-focus";
import type { ConnectIngestStage } from "@restormel/contracts/connect";
import {
  trustScoreDescriptor,
  unitsSupportedDescriptor,
} from "$lib/connect/ingest-quality-display";

// ── Heartbeat strip ─────────────────────────────────────────────────────────

/** Number of cells in the `▮▮▮▮▯…` tick-line. */
export const HEARTBEAT_CELLS = 5;

export type HeartbeatStrip = {
  /** The mono tick-line, e.g. "▮▮▮▮▯". Advances one filled cell per worker signal. */
  bar: string;
  /** Filled-cell count (0–HEARTBEAT_CELLS). */
  filled: number;
  /** "4s ago" / "2m ago" / "—" — the static reduced-motion fallback text. */
  signalAgeLabel: string;
  /** Raw age in ms since the last worker signal (null when unknowable). */
  signalAgeMs: number | null;
  /** True when the heartbeat has gone stale (amber strip). */
  stalled: boolean;
};

const CELL_FILLED = "▮";
const CELL_EMPTY = "▯";

/** Humanise a millisecond age into "Xs ago" / "Xm ago" / "Xh ago" (or "—"). */
export function formatSignalAge(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) return "—";
  if (ms < 0) return "just now";
  if (ms < 60_000) return `${Math.max(1, Math.round(ms / 1000))}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}

/**
 * Build the heartbeat tick-line model.
 *
 * `tick` is a monotonic counter the console bumps on every applied live frame
 * (snapshot/delta) — it advances the filled cell so the strip visibly "breathes"
 * with each worker signal. When the run has stalled, the strip is rendered full
 * (`▮▮▮▮▮`) and amber by the caller; the static text fallback ("last signal Xs
 * ago") always informs even with animation off.
 */
export function buildHeartbeatStrip(args: {
  /** Unix-ms of the last worker heartbeat (W1.4 durable-run signal). */
  workerHeartbeatAt: number | null | undefined;
  /** Fallback activity timestamp (ISO) when no heartbeat column exists (legacy rows). */
  updatedAtIso?: string | null;
  /** Live clock. */
  nowMs: number;
  /** Monotonic applied-frame counter. */
  tick: number;
  /** Whether the run has been judged stalled by the W1.4 model. */
  stalled: boolean;
}): HeartbeatStrip {
  let signalAgeMs: number | null = null;
  if (args.workerHeartbeatAt != null && Number.isFinite(args.workerHeartbeatAt)) {
    signalAgeMs = args.nowMs - args.workerHeartbeatAt;
  } else if (args.updatedAtIso) {
    const t = new Date(args.updatedAtIso).getTime();
    if (!Number.isNaN(t)) signalAgeMs = args.nowMs - t;
  }
  // Stalled → full bar (the worker has gone quiet; the strip "holds"). Otherwise
  // the live tick walks a single filled cell across the cells, so each frame moves it.
  const filled = args.stalled
    ? HEARTBEAT_CELLS
    : 1 + (((args.tick % HEARTBEAT_CELLS) + HEARTBEAT_CELLS) % HEARTBEAT_CELLS);
  const clamped = Math.max(0, Math.min(HEARTBEAT_CELLS, filled));
  return {
    bar: CELL_FILLED.repeat(clamped) + CELL_EMPTY.repeat(HEARTBEAT_CELLS - clamped),
    filled: clamped,
    signalAgeLabel: formatSignalAge(signalAgeMs),
    signalAgeMs,
    stalled: args.stalled,
  };
}

// ── Per-stage odometers ──────────────────────────────────────────────────────

export type StageOdometer = {
  stage: ConnectIngestStage;
  label: string;
  /** Live count for this stage (processed units), counting up as the stage runs. */
  count: number;
  /** Stage total when known (>1), else null — used for "N / M" honesty, never faked. */
  total: number | null;
  status: ConnectIngestStageProgress["status"];
  /** True while this stage is the running one (drives the pulse highlight). */
  running: boolean;
};

/**
 * Build the live per-stage odometer rows from the streamed stage progress.
 *
 * Counts are the real `progress.processed` values the worker reports per stage —
 * they accumulate as deltas arrive, so the numbers literally count up live. A
 * stage with no progress metrics yet shows count 0 (honest absence, not a guess).
 * Skipped stages are omitted (mirrors `buildConnectPipelineStageRows`).
 */
export function buildStageOdometers(
  stages: ConnectIngestStageProgress[] | null | undefined,
  currentStageKey: string | null | undefined,
): StageOdometer[] {
  if (!Array.isArray(stages) || stages.length === 0) return [];
  const cur = (currentStageKey ?? "").trim();
  const byStage = new Map(stages.map((s) => [s.stage, s]));
  const out: StageOdometer[] = [];
  for (const key of CONNECT_INGEST_PIPELINE_STAGES) {
    const row = byStage.get(key);
    if (!row || row.status === "skipped") continue;
    const processed = row.progress?.processed;
    const total = row.progress?.total;
    out.push({
      stage: key,
      label: CONNECT_PIPELINE_STAGE_LABELS[key],
      count: typeof processed === "number" && Number.isFinite(processed) ? Math.max(0, processed) : 0,
      total: typeof total === "number" && total > 1 ? total : null,
      status: row.status,
      running: row.status === "running" && cur === key,
    });
  }
  return out;
}

// ── Completion ledger (B-P1-1) ───────────────────────────────────────────────

export type CompletionLedgerTint = "red" | "yellow" | "green" | "muted";

export type CompletionLedger = {
  /** The headline trust numeral for the verdict cap ("—" when not reported). */
  trustScore: string;
  trustTint: CompletionLedgerTint;
  /** Plain verdict word for the cap ("Strong" / "Moderate" / "Needs attention"). */
  verdict: string;
  /** Supported-% sub-stat, formatted for display ("92" or "—" when not reported). */
  supportedPct: string;
  supportedTint: CompletionLedgerTint;
  /** Total units captured (display-only; "—" when not reported). */
  totalUnits: string;
  /** Whether the trust/supported numbers are this run's own audit (vs the standing scorecard). */
  isThisRunAudit: boolean;
};

/**
 * Build the single completion ledger that replaces the stacked success-banner +
 * scorecard + "what to do next" blocks (B-P1-1). The trust/supported numbers QUOTE
 * the same quality-report values the scorecard surfaced (W2.3 single-source rule) —
 * this helper only formats them into the verdict cap; it never re-derives a score.
 *
 * Thresholds (60/80 for trust, 50/80 for supported) and verdict words are NOT forked
 * here — they come from `trustScoreDescriptor` / `unitsSupportedDescriptor`
 * (`ingest-quality-display.ts`), the single source the scorecard already uses. This
 * helper only WRAPS them to add honest-absence handling: a null number renders "—"
 * with a muted tint (mirroring how trust shows absence), never a fabricated 0 + red.
 */
export function buildCompletionLedger(quality: {
  trustScore?: number | null;
  okPct?: number | null;
  totalUnits?: number | null;
}): CompletionLedger {
  const hasTrust = typeof quality.trustScore === "number" && Number.isFinite(quality.trustScore);
  const trust = hasTrust ? (quality.trustScore as number) : 0;
  // Trust tint + verdict word reuse the scorecard descriptor (no copied thresholds).
  const trustDesc = trustScoreDescriptor(hasTrust ? trust : null);

  const hasSupported = typeof quality.okPct === "number" && Number.isFinite(quality.okPct);
  const supported = hasSupported ? Math.max(0, Math.round(quality.okPct as number)) : 0;
  // Supported tint reuses the scorecard descriptor; absent → muted "—" (MINOR-3),
  // not a red 0 that would contradict the contract's honest-absence row.
  const supportedTint: CompletionLedgerTint = hasSupported
    ? unitsSupportedDescriptor(supported).tint
    : "muted";

  return {
    trustScore: hasTrust ? String(trust) : "—",
    trustTint: hasTrust ? trustDesc.tint : "muted",
    verdict: hasTrust ? trustDesc.label : "Recorded",
    supportedPct: hasSupported ? String(supported) : "—",
    supportedTint,
    totalUnits:
      typeof quality.totalUnits === "number" && Number.isFinite(quality.totalUnits)
        ? String(Math.max(0, quality.totalUnits))
        : "—",
    isThisRunAudit: true,
  };
}
