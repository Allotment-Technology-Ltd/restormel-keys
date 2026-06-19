/**
 * Readiness runs collection — list existing runs and create a new cohort pass.
 * Creating a run resolves the next N unlinked ideas and stamps them as the run's
 * cohort; the run is then driven through link → embed → validate by the wizard.
 */
import { json } from "@sveltejs/kit";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import { listReadinessRunsForWorkspace } from "$lib/server/connect/readiness-runs";
import { createReadinessRun } from "$lib/server/connect/readiness-runs-service";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const runs = await listReadinessRunsForWorkspace({ workspaceId: ctx.workspaceId });
  return json({ runs });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_json", message: "Request body must be JSON." }, { status: 400 });
  }

  const rec = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const sizeRaw = typeof rec.size_target === "number" ? rec.size_target : Number(rec.size_target);
  const sizeTarget = Number.isFinite(sizeRaw) && sizeRaw > 0 ? Math.floor(sizeRaw) : 0;
  if (sizeTarget <= 0) {
    return json(
      { error: "invalid_request", message: "size_target must be a positive number." },
      { status: 400 },
    );
  }
  const domainPackId =
    typeof rec.domain_pack_id === "string" && rec.domain_pack_id.trim()
      ? rec.domain_pack_id.trim()
      : null;
  const label = typeof rec.label === "string" ? rec.label : undefined;

  let run;
  try {
    run = await createReadinessRun({
      workspaceId: ctx.workspaceId,
      sizeTarget,
      domainPackId,
      label,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not build the cohort.";
    return json({ error: "cohort_resolution_failed", message }, { status: 502 });
  }

  if ((run.sizeActual ?? 0) === 0) {
    // The graph has no unchecked ideas left, so there is nothing to put in a
    // cohort. The run still exists (created above) but is an empty draft — the
    // client surfaces a friendly "fully validated" state and does NOT activate
    // it. `reason` lets the client render that state distinctly from an error.
    return json(
      {
        run,
        reason: "empty_cohort",
        warning:
          "Your graph is fully validated — there are no unchecked ideas to put in a run. Re-import sources or add content, then start a new run.",
      },
      { status: 201 },
    );
  }
  return json({ run }, { status: 201 });
};
