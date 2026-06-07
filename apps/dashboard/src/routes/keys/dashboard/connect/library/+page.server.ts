import type { PageServerLoad } from "./$types";
import { perfSpan } from "$lib/debug/server-perf";
import { listGraphTargetsForUi } from "$lib/server/connect/graph-target-service";
import { listDomainPacksForUi } from "$lib/server/connect/domain-pack-service";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";

export const load: PageServerLoad = async (event) => {
  if (!event.locals.user || event.locals.user.authType !== "session") {
    return { graphs: [], packs: [], signedIn: false };
  }
  try {
    const end = perfSpan("connect/library", "load");
    const workspace = await requireConnectWorkspace(event.locals, event.parent);
    event.depends("app:connect-graph-library");
    event.depends(`app:connect-graph-library:${workspace.id}`);
    const [graphs, packs] = await Promise.all([
      listGraphTargetsForUi(workspace.id),
      listDomainPacksForUi(workspace.id),
    ]);
    end();
    return {
      graphs,
      packs: packs.map((p) => ({ id: p.id, title: p.title, slug: p.slug })),
      signedIn: true,
    };
  } catch {
    return { graphs: [], packs: [], signedIn: true };
  }
};
