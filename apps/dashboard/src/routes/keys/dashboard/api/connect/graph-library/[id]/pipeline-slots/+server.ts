/**
 * RES-113 · verification-engine plug-points — persist a slot choice (PR-2).
 *
 * PUT { slot, option_id }: sets one plug-point slot on a saved graph's bundle,
 * persisted through the existing `updateConnectGraphTargetBundle` settings
 * shallow-merge (a settings key, not a schema column — placement spec §3.1).
 *
 * Guarantees:
 *  - Flag-gated: 404 unless the `m1PlugPoints` module flag is ON (flag-OFF is
 *    byte-identical, API surface included).
 *  - Only OFFERED options are accepted: the candidate must appear in the PR-1
 *    derivation's offered list for that slot under the graph's CURRENT bundle —
 *    so an excluded (cross-family, REC-ADR-023 invariant 1) or unknown id is a
 *    400, and BLOCKED/AMBIGUOUS components are unreachable by construction
 *    (they are absent from the CLEARED catalog, REC-GOV-022).
 *  - Choosing the recommended default REMOVES the key (a fully-default map is
 *    removed entirely), so "default bundle" stays a real absent state.
 */
import { json } from "@sveltejs/kit";
import {
  isPipelineSlotId,
  parsePipelineSlotAssignments,
  recommendedSlotOptionId,
  resolveM1PipelineSlots,
  type PipelineSlotId,
} from "$lib/connect/pipeline-config";
import { getConnectGraphTargetById, updateConnectGraphTargetBundle } from "$lib/server/neon";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

export const PUT: RequestHandler = async ({ locals, request, params }) => {
  // Reveal predicate for the whole cluster: the m1PlugPoints flag (default OFF).
  if (locals.moduleFlags?.m1PlugPoints !== true) {
    return json({ error: "not_found", message: "Not found." }, { status: 404 });
  }
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
  const slot = (body as { slot?: unknown })?.slot;
  const optionId = (body as { option_id?: unknown })?.option_id;
  if (!isPipelineSlotId(slot) || typeof optionId !== "string" || !optionId) {
    return json(
      { error: "invalid_request", message: "Expected { slot, option_id }." },
      { status: 400 },
    );
  }

  const target = await getConnectGraphTargetById({ id: params.id, workspaceId: ctx.workspaceId });
  if (!target) {
    return json({ error: "not_found", message: "Graph not found." }, { status: 404 });
  }

  const current = parsePipelineSlotAssignments(target.settings.pipeline_slots);
  // Accept only what the derivation OFFERS for this slot under the current
  // bundle — the same list the renderer showed (decision B: what is absent from
  // the menu is absent from the write path too).
  const row = resolveM1PipelineSlots({ pipeline_slots: current }).find((r) => r.slot === slot);
  if (!row || !row.options.some((o) => o.id === optionId)) {
    return json(
      { error: "invalid_option", message: "That option isn't offered for this stage." },
      { status: 400 },
    );
  }

  const next: Partial<Record<PipelineSlotId, string>> = { ...current };
  if (optionId === recommendedSlotOptionId(slot)) delete next[slot];
  else next[slot] = optionId;

  await updateConnectGraphTargetBundle({
    graphTargetId: target.id,
    workspaceId: ctx.workspaceId,
    settingsPatch: { pipeline_slots: Object.keys(next).length > 0 ? next : null },
  });

  return json({ ok: true, pipeline_slots: next });
};
