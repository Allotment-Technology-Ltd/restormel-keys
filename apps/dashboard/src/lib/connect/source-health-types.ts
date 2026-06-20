/**
 * Phase 3 Stage 3 — client-safe types for the watched-sources health surface.
 *
 * Kept out of `$lib/server/connect/source-health.ts` (which imports server-only Neon
 * readers) so client components can `import type` these without dragging server code
 * into the browser bundle. The server module re-exports these as its public shape.
 */

/** Health roll-up for one source kind (upload / url / connector). */
export type SourceHealthCard = {
  kind: string;
  /** Parsed, ingest-ready documents. */
  indexed: number;
  /** Documents that failed to fetch or parse — feed the exceptions queue. */
  failed: number;
  /** Documents fetched but not yet parsed. */
  pending: number;
  /** ISO timestamp of the most recent document for this kind, or null when none. */
  lastSyncedAt: string | null;
  /** Derived rollup status for the card chrome. */
  status: "healthy" | "attention" | "syncing" | "empty";
};

/** One row in the exceptions queue — a failure that needs a human. */
export type SourceException =
  | {
      type: "document";
      id: string;
      title: string;
      kind: string;
      /** Operator-facing error the pipeline stored; never a secret. */
      error: string;
      at: string;
    }
  | {
      type: "run";
      id: string;
      title: string;
      /** Operator-facing error the pipeline stored; never a secret. */
      error: string;
      at: string;
    };

export type SourceHealthSummary = {
  cards: SourceHealthCard[];
  exceptions: SourceException[];
  totals: {
    indexed: number;
    failed: number;
    pending: number;
    exceptions: number;
  };
  /** Most recent sync across all kinds (ISO) or null. */
  lastSyncedAt: string | null;
};
