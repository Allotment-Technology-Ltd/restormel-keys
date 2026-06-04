/**
 * One-click connect: use this workspace's existing Neon database as the graph
 * spine. Reuses the dashboard's configured DATABASE_URL — zero credentials.
 */
import { json } from "@sveltejs/kit";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import {
  connectDashboardNeonTarget,
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
  if (!isModuleEnabled(flags, "connectNeonGraphStore")) {
    return json(
      {
        error: "module_disabled",
        module: "connectNeonGraphStore",
        message:
          "The host-managed Neon graph store is disabled. Connect your own SurrealDB instance instead.",
      },
      { status: 404 },
    );
  }

  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const target = await connectDashboardNeonTarget(ctx.workspaceId);
  const test = await testGraphTargetConnection(ctx.workspaceId);
  return json({ target, test });
};
