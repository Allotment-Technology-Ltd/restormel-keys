import type { PageServerLoad } from "./$types";
import { perfSpan } from "$lib/debug/server-perf";
import { listGraphTargetsForUi } from "$lib/server/connect/graph-target-service";
import { listDomainPacksForUi, getSelectedDomainPackId } from "$lib/server/connect/domain-pack-service";
import { listSourceDocuments } from "$lib/server/connect/source-documents";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";

export type SourcesDocumentRow = {
  id: string;
  name: string;
  source_kind: string;
  status: string;
  char_count: number;
  chunk_count: number;
};

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return {
      graphs: [],
      packs: [],
      documents: [] as SourcesDocumentRow[],
      selectedPackId: null as string | null,
      signedIn: false,
      loadFailed: false,
    };
  }
  try {
    const end = perfSpan("connect/library", "load");
    const workspace = await requireConnectWorkspace(event.locals, event.parent);
    event.depends("app:connect-graph-library");
    event.depends(`app:connect-graph-library:${workspace.id}`);
    event.depends(`app:connect-pipeline:${workspace.id}`);
    const [graphs, packs, documents, selectedPackId] = await Promise.all([
      listGraphTargetsForUi(workspace.id),
      listDomainPacksForUi(workspace.id),
      listSourceDocuments(workspace.id),
      getSelectedDomainPackId(workspace.id),
    ]);
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
      selectedPackId,
      signedIn: true,
      loadFailed: false,
    };
  } catch {
    // R4-S3/X7: a DB failure here must NOT masquerade as "No documents yet". Flag
    // the failure so the page renders an error banner + retry, distinguishing a
    // genuine empty workspace from a load error.
    return {
      graphs: [],
      packs: [],
      documents: [] as SourcesDocumentRow[],
      selectedPackId: null as string | null,
      signedIn: true,
      loadFailed: true,
    };
  }
};
