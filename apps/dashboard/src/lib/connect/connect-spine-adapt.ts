/**
 * Adapters from existing Connect data shapes → ConnectSpineSignals.
 *
 * Keeps the spine builder (connect-spine.ts) decoupled from the concrete
 * readiness / hub / graph types. Client-safe (pure). The point of this file is
 * REUSE: it maps the data each surface already loads onto the spine's signal
 * shape so no surface has to fetch anything new.
 */

import type {
  ConnectSpineSignals,
} from "$lib/connect/connect-spine";
import type { ConnectVerifiedReadiness } from "$lib/connect/verified-readiness";

/** Readiness ledger → the spine's ① Connect + ⑤ Go-live signal. */
export function readinessToSpineSignal(
  readiness: ConnectVerifiedReadiness | null,
): ConnectSpineSignals["readiness"] {
  if (!readiness) return null;
  const firstNonOk = readiness.rows.find((r) => r.status !== "ok") ?? null;
  return {
    status: readiness.status,
    ready: readiness.ready,
    total: readiness.total,
    firstGap: firstNonOk
      ? { label: firstNonOk.label, fixHref: firstNonOk.fixHref, fixLabel: firstNonOk.fixLabel }
      : null,
    models: readiness.models,
  };
}

/** Graph validation stats (units / embedded / validation) → the spine's ③ + ④ signal. */
export function graphStatsToSpineSignal(
  stats:
    | {
        units: number;
        embedded: number;
        validation: {
          ok: number;
          weak: number;
          unsupported: number;
          unvalidated: number;
          awaiting_triage?: number;
        };
      }
    | null
    | undefined,
): ConnectSpineSignals["graph"] {
  if (!stats) return null;
  return {
    units: stats.units,
    embedded: stats.embedded,
    validation: {
      ok: stats.validation.ok,
      weak: stats.validation.weak,
      unsupported: stats.validation.unsupported,
      unvalidated: stats.validation.unvalidated,
      awaiting_triage: stats.validation.awaiting_triage,
    },
  };
}
