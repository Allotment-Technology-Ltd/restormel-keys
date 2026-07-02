import type { PageServerLoad } from "./$types";
import { perfSpan } from "$lib/debug/server-perf";
import { listGraphTargetsForUi } from "$lib/server/connect/graph-target-service";
import { listDomainPacksForUi } from "$lib/server/connect/domain-pack-service";
import { requireConnectWorkspace } from "$lib/server/connect/workspace-cache";
import { isSignedInSession } from "$lib/server/session-user";

/**
 * The standing "graph home" (spec §2/§6 — Decision A Option 2). Mirrors the two
 * graph-relevant panels of `sources/+page.server.ts` (graph targets + domain packs)
 * with the SAME signed-out guard, the SAME `requireConnectWorkspace` try/catch →
 * `loadFailed`, and the SAME `app:connect-graph-library` dependency — but nothing
 * more. This route is standing: no module-flag branch, no `m1PlugPoints`. The full
 * connect / switch / edit / delete CRUD lives inside `ConnectGraphLibrary`, so the
 * capability is present in EVERY state (signed-out shows the notice; empty, loaded,
 * and loadFailed all mount the library).
 */
export const load: PageServerLoad = async (event) => {
  if (!isSignedInSession(event.locals)) {
    return {
      signedIn: false,
      panels: Promise.resolve({
        graphs: [] as Awaited<ReturnType<typeof listGraphTargetsForUi>>,
        packs: [] as { id: string; title: string; slug: string }[],
        loadFailed: false,
      }),
    };
  }

  // requireConnectWorkspace is practically free on warm requests (30 s cache); we
  // await it because both panel queries need workspace.id.
  let workspace: { id: string };
  try {
    workspace = await requireConnectWorkspace(event.locals, event.parent);
  } catch {
    return {
      signedIn: true,
      panels: Promise.resolve({
        graphs: [] as Awaited<ReturnType<typeof listGraphTargetsForUi>>,
        packs: [] as { id: string; title: string; slug: string }[],
        loadFailed: true,
      }),
    };
  }

  event.depends("app:connect-graph-library");
  event.depends(`app:connect-graph-library:${workspace.id}`);

  const end = perfSpan("connect/graphs", "load");
  const panelsPromise = Promise.all([
    listGraphTargetsForUi(workspace.id),
    listDomainPacksForUi(workspace.id),
  ])
    .then(([graphs, packs]) => {
      end();
      return {
        graphs,
        packs: packs.map((p) => ({ id: p.id, title: p.title, slug: p.slug })),
        loadFailed: false,
      };
    })
    .catch((): {
      graphs: Awaited<ReturnType<typeof listGraphTargetsForUi>>;
      packs: { id: string; title: string; slug: string }[];
      loadFailed: boolean;
    } => {
      // A DB failure must not masquerade as an empty library — flag it so the page
      // can distinguish "load error" from "no graphs yet".
      return { graphs: [], packs: [], loadFailed: true };
    });

  return {
    signedIn: true,
    panels: panelsPromise,
  };
};
