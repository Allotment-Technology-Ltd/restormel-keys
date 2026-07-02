/**
 * RES-113 · deployment presets — apply a whole-bundle preset (PR-3).
 *
 * PUT { preset }: rewrites a saved graph's `pipeline_slots` to the chosen
 * deployment preset and records `pipeline_preset`, persisted through the existing
 * `updateConnectGraphTargetBundle` settings shallow-merge (a settings key, not a
 * schema column — placement spec §3.1, decision A). This is the SINGLE writable
 * preset surface: `/routes/ingestion` extends the shipped "Reset to recommended"
 * bulk action into the four-way choice, one mechanism not two.
 *
 * Guarantees:
 *  - Flag-gated: 404 unless the `m1PlugPoints` module flag is ON (flag-OFF is
 *    byte-identical, API surface included).
 *  - Only a known preset id is accepted (`PIPELINE_PRESETS`); anything else is a
 *    400. BLOCKED/AMBIGUOUS components are unreachable — the preset bundles draw
 *    only from the CLEARED slot catalog (REC-GOV-022 §(e)).
 *  - "Fully managed (recommended)" writes an EMPTY slot map (a real default
 *    bundle), exactly as the shipped reset leaves it — `pipeline_slots` is cleared.
 */
import { json } from "@sveltejs/kit";
import {
  PIPELINE_PRESETS,
  isPipelinePresetId,
  presetSlotAssignments,
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
  const preset = (body as { preset?: unknown })?.preset;
  if (!isPipelinePresetId(preset)) {
    return json(
      { error: "invalid_preset", message: "Expected a known deployment preset." },
      { status: 400 },
    );
  }

  const target = await getConnectGraphTargetById({ id: params.id, workspaceId: ctx.workspaceId });
  if (!target) {
    return json({ error: "not_found", message: "Graph not found." }, { status: 404 });
  }

  const nextSlots = presetSlotAssignments(preset);
  await updateConnectGraphTargetBundle({
    graphTargetId: target.id,
    workspaceId: ctx.workspaceId,
    settingsPatch: {
      // "Fully managed (recommended)" ⇒ empty map ⇒ clear (a real default bundle).
      pipeline_slots: Object.keys(nextSlots).length > 0 ? nextSlots : null,
      pipeline_preset: preset,
    },
  });

  return json({
    ok: true,
    preset,
    preset_name: PIPELINE_PRESETS[preset].name,
    pipeline_slots: nextSlots,
  });
};
