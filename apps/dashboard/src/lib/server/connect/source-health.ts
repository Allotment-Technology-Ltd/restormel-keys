/**
 * Phase 3 Stage 3 — Sources as watched background sources.
 *
 * Aggregates a workspace's already-persisted source documents and ingest runs into
 * (1) per-source-kind HEALTH CARDS (docs indexed · failed · last-synced · status)
 * and (2) an EXCEPTIONS QUEUE — only the things that actually need a human: failed
 * source documents (parse/fetch errors) and failed ingest runs.
 *
 * It is a pure read + aggregation over the existing data layer
 * (`listConnectSourceDocumentsForWorkspace`, `listConnectIngestJobsForWorkspace`) —
 * NO new tables, NO new SQL, NO reinvented job queue. The watched-source model is a
 * presentation of state the pipeline already records; the queue is the real `runs`
 * and the real source documents, filtered to the failures.
 *
 * Never includes document full text, secrets, or PII — only counts, kinds, statuses,
 * timestamps, and the operator-facing error string the pipeline already stored.
 */
import { listConnectSourceDocumentsForWorkspace } from "$lib/server/neon";
import { listConnectIngestJobsForWorkspace } from "$lib/server/connect-ingest-jobs";
import type {
  SourceHealthCard,
  SourceException,
  SourceHealthSummary,
} from "$lib/connect/source-health-types";

// Public shape re-exported from the client-safe types module so callers can import
// it from either side without pulling server-only Neon code into the client bundle.
export type { SourceHealthCard, SourceException, SourceHealthSummary };

function cardStatus(card: {
  indexed: number;
  failed: number;
  pending: number;
}): SourceHealthCard["status"] {
  if (card.failed > 0) return "attention";
  if (card.pending > 0) return "syncing";
  if (card.indexed > 0) return "healthy";
  return "empty";
}

function maxIso(a: string | null, b: string): string {
  if (!a) return b;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/**
 * Build the watched-sources health summary for a workspace from data the pipeline
 * already persists. Pure aggregation — safe to call on every Sources page load.
 *
 * @param exceptionLimit caps the exceptions queue (most-recent first) so a workspace
 *   with thousands of historical failures never returns an unbounded payload.
 */
export async function loadSourceHealthSummary(
  workspaceId: string,
  opts: { exceptionLimit?: number } = {},
): Promise<SourceHealthSummary> {
  const exceptionLimit = Math.min(Math.max(opts.exceptionLimit ?? 50, 1), 200);

  const [documents, runs] = await Promise.all([
    listConnectSourceDocumentsForWorkspace(workspaceId),
    // Recent runs only — the queue surfaces current failures, not the full history
    // (the Runs page owns the full, paginated ledger).
    listConnectIngestJobsForWorkspace({ workspaceId, limit: 50 }),
  ]);

  // ── Health cards: aggregate documents by source kind ──────────────────────
  const byKind = new Map<
    string,
    { indexed: number; failed: number; pending: number; lastSyncedAt: string | null }
  >();
  for (const doc of documents) {
    const kind = doc.sourceKind || "upload";
    const entry =
      byKind.get(kind) ?? { indexed: 0, failed: 0, pending: 0, lastSyncedAt: null };
    if (doc.status === "parsed") entry.indexed += 1;
    else if (doc.status === "failed") entry.failed += 1;
    else entry.pending += 1;
    entry.lastSyncedAt = maxIso(entry.lastSyncedAt, new Date(doc.createdAt).toISOString());
    byKind.set(kind, entry);
  }

  const cards: SourceHealthCard[] = [...byKind.entries()]
    .map(([kind, e]) => ({
      kind,
      indexed: e.indexed,
      failed: e.failed,
      pending: e.pending,
      lastSyncedAt: e.lastSyncedAt,
      status: cardStatus(e),
    }))
    // Cards that need attention float to the top, then by most-recent activity.
    .sort((a, b) => {
      if (a.status === "attention" && b.status !== "attention") return -1;
      if (b.status === "attention" && a.status !== "attention") return 1;
      const at = a.lastSyncedAt ? new Date(a.lastSyncedAt).getTime() : 0;
      const bt = b.lastSyncedAt ? new Date(b.lastSyncedAt).getTime() : 0;
      return bt - at;
    });

  // ── Exceptions queue: failed documents + failed runs, newest first ────────
  const docExceptions: SourceException[] = documents
    .filter((d) => d.status === "failed")
    .map((d) => ({
      type: "document" as const,
      id: d.id,
      title: d.name,
      kind: d.sourceKind || "upload",
      error: (d.error ?? "Document failed to process.").slice(0, 400),
      at: new Date(d.createdAt).toISOString(),
    }));

  const runExceptions: SourceException[] = runs
    .filter((r) => r.status === "failed")
    .map((r) => ({
      type: "run" as const,
      id: r.id,
      title: r.label ?? "Untitled run",
      error: (r.error ?? "Run failed.").slice(0, 400),
      at: new Date(r.updatedAt).toISOString(),
    }));

  const exceptions = [...docExceptions, ...runExceptions]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, exceptionLimit);

  const totals = {
    indexed: cards.reduce((n, c) => n + c.indexed, 0),
    failed: cards.reduce((n, c) => n + c.failed, 0),
    pending: cards.reduce((n, c) => n + c.pending, 0),
    exceptions: docExceptions.length + runExceptions.length,
  };

  const lastSyncedAt = cards.reduce<string | null>(
    (acc, c) => (c.lastSyncedAt ? maxIso(acc, c.lastSyncedAt) : acc),
    null,
  );

  return { cards, exceptions, totals, lastSyncedAt };
}
