/**
 * Shared durable-run stall threshold (Stage 1.6 durable-runs).
 *
 * The interval after which a *running* ingest job whose worker heartbeat has not
 * advanced is considered stalled. ONE source of truth so the run console
 * (`ConnectIngestRunConsole` — `STALL_NOTICE_MS`) and the topbar live-run chip
 * (`live-run-chip` — `CHIP_STALL_NOTICE_MS`) cannot drift apart on what "stalled"
 * means. The graph-repair panel uses the same 90s convention.
 *
 * Dedup filed in PR #285 (W4.4 brutalist sweep): the two consumers previously each
 * declared their own `90_000` literal.
 */
export const STALL_NOTICE_MS = 90_000;
