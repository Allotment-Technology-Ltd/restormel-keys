/**
 * Phase 3 Stage 0 — first-run demo bootstrap.
 *
 * POST: idempotently (1) seed the demo knowledge graph into the Postgres spine and
 * (2) auto-provision default chat + embedding ingest routes from any connected
 * provider key — so a brand-new user can reach a verified answer with no wizard.
 * GET: report the active seed's suggested first-run questions (incl. a deliberate
 * abstention) + whether the demo graph is already present.
 *
 * Session-scoped to the caller's workspace; never logs secrets or PII.
 */
import { json } from "@sveltejs/kit";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import {
  seedDemoGraph,
  demoGraphSuggestedQuestions,
  workspaceHasDemoGraph,
  activeDemoGraphSeedId,
} from "$lib/server/connect/demo-graph/seed-demo-graph";
import { autoProvisionDefaultRoutes } from "$lib/server/connect/auto-provision-default-routes";
import type { RequestHandler } from "./$types";

export const POST: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  try {
    const seed = await seedDemoGraph(ctx.workspaceId);
    // Auto-provision is best-effort: a missing provider key or project must not
    // fail the seed (the demo graph is the make-or-break, routes are the unblock).
    const routes = await autoProvisionDefaultRoutes({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
      actorType: "demo_bootstrap",
    }).catch(() => ({ provisioned: false as const, reason: "no_provider_key" as const }));

    return json(
      {
        seed,
        routes,
        suggestedQuestions: demoGraphSuggestedQuestions(),
      },
      { status: seed.already_seeded ? 200 : 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not seed the demo graph.";
    return json({ error: "demo_graph_seed_failed", message }, { status: 500 });
  }
};

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const seeded = await workspaceHasDemoGraph(ctx.workspaceId).catch(() => false);
  return json({
    seedId: activeDemoGraphSeedId(),
    seeded,
    suggestedQuestions: demoGraphSuggestedQuestions(),
  });
};
