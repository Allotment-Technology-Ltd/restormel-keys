import type { PageServerLoad } from "./$types";
import { perfSpan } from "$lib/debug/server-perf";
import { listGraphTargetsForUi } from "$lib/server/connect/graph-target-service";
import { listDomainPacksForUi, getSelectedDomainPackId } from "$lib/server/connect/domain-pack-service";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import { loadSourceHealthSummary, type SourceHealthSummary } from "$lib/server/connect/source-health";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import { isSignedInSession } from "$lib/server/session-user";

const EMPTY_HEALTH: SourceHealthSummary = {
  cards: [],
  exceptions: [],
  totals: { indexed: 0, failed: 0, pending: 0, exceptions: 0 },
  lastSyncedAt: null,
};

export type SourcesDocumentRow = {
  id: string;
  name: string;
  source_kind: string;
  status: string;
  char_count: number;
  chunk_count: number;
};

/**
 * Streamed payload for the three Sources panels.
 *
 * Streaming audit (§3 ux-contracts navigation-pending-state):
 *
 *   AWAITED (blocks first paint — genuinely needed before the shell):
 *   - isSignedInSession()     — sync; determines signed-out guard
 *   - requireConnectWorkspace — workspace.id is required to fire the
 *                               parallel panel queries; BUT see below.
 *
 *   STREAMED (returned as Promises; shell paints before these resolve):
 *   - panelsPromise           — wraps the four parallel panel queries
 *                               (listGraphTargetsForUi, listDomainPacksForUi,
 *                               listSourceDocuments, getSelectedDomainPackId).
 *                               All four are independent after workspace resolves;
 *                               they are already in a Promise.all inside the
 *                               streamed wrapper so latency is min(max(four)).
 *
 *   RATIONALE: requireConnectWorkspace uses a 30 s in-process cache; on a warm
 *   request (any prior tab visit) it resolves in < 1 ms. On a cold start it hits
 *   the DB (≈ 5–30 ms). We await it because every panel query needs workspace.id
 *   and it is practically free after the layout's loadConnectLayoutWorkspace warm.
 *   The four panel queries (graph targets, packs, documents, selectedPackId) each
 *   hit Neon and may take 50–300 ms on a loaded instance — these are the primary
 *   sources of first-paint latency and are streamed so the header + section
 *   scaffolding renders immediately.
 */
export const load: PageServerLoad = async (event) => {
  if (!isSignedInSession(event.locals)) {
    return {
      signedIn: false,
      // Streamed panels — resolve immediately to empty for signed-out users.
      panels: Promise.resolve({
        graphs: [] as Awaited<ReturnType<typeof listGraphTargetsForUi>>,
        packs: [] as { id: string; title: string; slug: string }[],
        documents: [] as SourcesDocumentRow[],
        health: EMPTY_HEALTH,
        selectedPackId: null as string | null,
        loadFailed: false,
      }),
    };
  }

  // requireConnectWorkspace is practically free on warm requests (30 s cache).
  // We await it here because all panel queries need workspace.id; see audit above.
  let workspace: { id: string };
  try {
    workspace = await requireConnectWorkspace(event.locals, event.parent);
  } catch {
    return {
      signedIn: true,
      panels: Promise.resolve({
        graphs: [] as Awaited<ReturnType<typeof listGraphTargetsForUi>>,
        packs: [] as { id: string; title: string; slug: string }[],
        documents: [] as SourcesDocumentRow[],
        health: EMPTY_HEALTH,
        selectedPackId: null as string | null,
        loadFailed: true,
      }),
    };
  }

  event.depends("app:connect-graph-library");
  event.depends(`app:connect-graph-library:${workspace.id}`);
  event.depends(`app:connect-pipeline:${workspace.id}`);

  // Streamed: all four panel queries fire in parallel and resolve independently.
  // The page shell (header, section headings, "Ingest →" CTA) paints before these.
  const end = perfSpan("connect/library", "load");
  const panelsPromise = Promise.all([
    listGraphTargetsForUi(workspace.id),
    listDomainPacksForUi(workspace.id),
    listSourceDocuments(workspace.id),
    getSelectedDomainPackId(workspace.id),
    // Phase 3 Stage 3 — watched-source health + exceptions, aggregated from the same
    // documents/runs the pipeline already records (no new tables). Best-effort: a
    // health-aggregation failure degrades to EMPTY_HEALTH rather than failing the page.
    loadSourceHealthSummary(workspace.id).catch(() => EMPTY_HEALTH),
  ]).then(([graphs, packs, documents, selectedPackId, health]) => {
    end();
    return {
      graphs,
      packs: packs.map((p) => ({ id: p.id, title: p.title, slug: p.slug })),
      documents: documents.map((d): SourcesDocumentRow => ({
        id: d.id,
        name: d.name,
        source_kind: d.source_kind,
        status: d.status,
        char_count: d.char_count,
        chunk_count: d.chunk_count,
      })),
      health,
      selectedPackId,
      loadFailed: false,
    };
  }).catch((): {
    graphs: Awaited<ReturnType<typeof listGraphTargetsForUi>>;
    packs: { id: string; title: string; slug: string }[];
    documents: SourcesDocumentRow[];
    health: SourceHealthSummary;
    selectedPackId: string | null;
    loadFailed: boolean;
  } => {
    // R4-S3/X7: a DB failure here must NOT masquerade as "No documents yet". Flag
    // the failure so the page renders an error banner + retry, distinguishing a
    // genuine empty workspace from a load error.
    return {
      graphs: [],
      packs: [],
      documents: [],
      health: EMPTY_HEALTH,
      selectedPackId: null,
      loadFailed: true,
    };
  });

  return {
    signedIn: true,
    // Streamed — the panel sections resolve once the DB queries complete.
    panels: panelsPromise,
  };
};
