/**
 * M3 Store — non-destructive store-move BFF (RES-113 PR-K, REC-ADR-017 / REC-ADR-021).
 *
 * Two read-then-decide actions, both behind BOTH flags (additive — when either is
 * off this route 404s and nothing in the current product changes):
 *   - { action: "overview", engine } — read-only node-count PROBE of the target
 *     store + the offered non-destructive options + a plan preview per option.
 *   - { action: "decide", engine, option } — record the chosen non-destructive
 *     option (audit only). The actual cross-store copy / read re-point is
 *     ENV-PENDING — this endpoint NEVER copies, overwrites, or migrates data.
 *
 * Flags: connectHostManagedGraphStore (#288 — the managed origin tier) AND
 * onboardingJourney (the RES-113 cut). Both must be on (REC-ADR-021 §4: one cut).
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { MVP_MODULE_DEFAULTS } from "$lib/module-flags-types";
import { isModuleEnabled } from "$lib/server/module-flags";
import {
  decideWorkspaceStoreMove,
  describeStoreEngine,
  getStoreMoveOverview,
} from "$lib/server/connect/connect-store-move-service";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const EngineSchema = z.enum(["postgres", "surreal", "neo4j"]);
const OptionSchema = z.enum(["use_existing", "add_alongside", "keep_separate"]);

const BodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("overview"),
    engine: EngineSchema,
    graph_target_id: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("decide"),
    engine: EngineSchema,
    option: OptionSchema,
    graph_target_id: z.string().uuid().optional(),
  }),
]);

export const POST: RequestHandler = async ({ locals, request }) => {
  // Gate: both flags must be on (one big flagged cut — REC-ADR-021 §4). When off,
  // the route 404s so current behaviour is unchanged (additive).
  const flags = locals.moduleFlags ?? MVP_MODULE_DEFAULTS;
  if (
    !isModuleEnabled(flags, "connectHostManagedGraphStore") ||
    !isModuleEnabled(flags, "onboardingJourney")
  ) {
    return json(
      {
        error: "module_disabled",
        modules: ["connectHostManagedGraphStore", "onboardingJourney"],
        message: "The M3 store-move flow is not enabled.",
      },
      { status: 404 },
    );
  }

  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const body = parsed.data;

  if (body.action === "overview") {
    const overview = await getStoreMoveOverview(ctx.workspaceId, body.engine, {
      graphTargetId: body.graph_target_id,
    });
    return json({
      engine: body.engine,
      engine_label: describeStoreEngine(body.engine),
      ...overview,
    });
  }

  // action === "decide"
  const result = await decideWorkspaceStoreMove(ctx.workspaceId, body.engine, body.option, {
    graphTargetId: body.graph_target_id,
  });
  if (!result.ok) {
    return json({ error: result.error, message: result.message }, { status: result.status });
  }
  return json({
    engine: body.engine,
    engine_label: describeStoreEngine(body.engine),
    probe: result.probe,
    plan: result.plan,
    decision_id: result.decisionId,
    audit_persisted: result.auditPersisted,
    // Honesty: the binding is recorded but the move itself has not been executed.
    execution_env_pending:
      result.plan.envPending.copyExecution || result.plan.envPending.repointVerification,
  });
};
