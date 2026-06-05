/**
 * Persist and mirror Connect graph review signals (Phase 6).
 */
import type { ConnectDomainPack } from "@restormel/contracts/connect";
import { resolvePackArchetype } from "@restormel/connect-core";
import { hasHumanReviewNote } from "$lib/connect/validation-status";
import {
  classifyNoteTheme,
  deriveActionType,
  deriveVerdictDelta,
  redactReviewNote,
} from "$lib/server/connect/review-signal-redact";
import {
  captureServerPostHogEvent,
  workspacePostHogDistinctId,
} from "$lib/server/posthog-capture";
import { insertKnowledgeReviewSignal } from "$lib/server/neon";

export type ReviewSignalInput = {
  workspaceId: string;
  unitId: string;
  aiStatus: string | null;
  aiFlagReason: string | null;
  humanStatus: string;
  humanNote: string | null;
  removed?: boolean;
  pack?: ConnectDomainPack | null;
  unitType?: string | null;
  sourceKind?: string | null;
  ingestJobId?: string | null;
  timeSinceIngestCompleteMs?: number | null;
  telemetryEnabled?: boolean;
};

export function extractAiFlagReason(validationNote: string | null | undefined): string | null {
  const note = validationNote?.trim() ?? "";
  if (!note || hasHumanReviewNote(note)) return null;
  return redactReviewNote(note);
}

export async function recordReviewSignal(input: ReviewSignalInput): Promise<void> {
  if (input.telemetryEnabled === false) return;

  const aiFlagReason = redactReviewNote(input.aiFlagReason);
  const humanNote = redactReviewNote(input.humanNote);
  const pack = input.pack;
  const verdictDelta = deriveVerdictDelta(input.aiStatus, input.humanStatus, input.removed);
  const actionType = deriveActionType(input.aiStatus, input.humanStatus, input.removed);

  const signal = {
    workspaceId: input.workspaceId,
    unitId: input.unitId,
    aiStatus: input.aiStatus,
    aiFlagReason,
    humanStatus: input.humanStatus,
    humanNote,
    aiFlagTheme: classifyNoteTheme(aiFlagReason),
    humanNoteTheme: classifyNoteTheme(humanNote),
    verdictDelta,
    actionType,
    domainPackId: pack?.id ?? null,
    packArchetype: pack ? resolvePackArchetype(pack) : null,
    packSlug: pack?.slug ?? null,
    qualityPreset: pack?.quality_preset ?? null,
    schemaMode: pack?.ontology.schema_mode ?? null,
    unitType: input.unitType ?? null,
    sourceKind: input.sourceKind ?? null,
    ingestJobId: input.ingestJobId ?? null,
    timeSinceIngestCompleteMs: input.timeSinceIngestCompleteMs ?? null,
  };

  await insertKnowledgeReviewSignal(signal);

  await captureServerPostHogEvent(workspacePostHogDistinctId(input.workspaceId), "connect_review_completed", {
    ai_status: signal.aiStatus,
    human_status: signal.humanStatus,
    verdict_delta: signal.verdictDelta,
    action_type: signal.actionType,
    ai_flag_reason: signal.aiFlagReason,
    human_note: signal.humanNote,
    ai_flag_theme: signal.aiFlagTheme,
    human_note_theme: signal.humanNoteTheme,
    pack_archetype: signal.packArchetype,
    quality_preset: signal.qualityPreset,
    schema_mode: signal.schemaMode,
    unit_type: signal.unitType,
    ingest_job_id: signal.ingestJobId,
    time_since_ingest_complete_ms: signal.timeSinceIngestCompleteMs,
  });
}
