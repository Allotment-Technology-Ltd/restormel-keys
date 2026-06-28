/**
 * One-click connect: use this workspace's host-managed Postgres database as the graph
 * spine (REC-ADR-008 — self-hosted EU Postgres, the EU-sovereign default tier). Reuses
 * the dashboard's configured server-side DATABASE_URL — zero credentials, custody stays
 * Restormel-side. Renamed from `/graph-target/neon` (which now 308-redirects here).
 */
import { json } from "@sveltejs/kit";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import {
  connectHostManagedGraphTarget,
  testGraphTargetConnection,
} from "$lib/server/connect/graph-target-service";
import { isModuleEnabled } from "$lib/server/module-flags";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals }) => {
  const flags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (!isModuleEnabled(flags, "connectHostManagedGraphStore")) {
    return json(
      {
        error: "module_disabled",
        module: "connectHostManagedGraphStore",
        message:
          "The host-managed Postgres graph store is disabled. Connect your own SurrealDB instance instead.",
      },
      { status: 404 },
    );
  }

  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const target = await connectHostManagedGraphTarget(ctx.workspaceId);
  const test = await testGraphTargetConnection(ctx.workspaceId);
  return json({ target, test });
};
