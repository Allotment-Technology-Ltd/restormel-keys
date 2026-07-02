/**
 * Shared stage vocabulary — the copy pack's ONE table for pipeline-stage names
 * (docs/design/res113-copy-pack.md §0 "Shared stage vocabulary"), used by the
 * Home run line (PR-3) and the Build tracker (PR-5) so the two surfaces can
 * never drift apart.
 *
 * Flag-ON (`onboardingJourney`) surfaces only. The flag-OFF run console keeps
 * its own `M1_FRIENDLY_STAGE_LABELS` map untouched (byte-identity invariant);
 * a later PR may fold the two once the copy pack governs both paths.
 *
 * Honesty rule (copy pack §0, REC-ADR-016): unknown or internal stages fall
 * back to "Getting ready" — engineering stage names NEVER leak to the screen.
 */

/**
 * Copy-pack stage names, keyed by the REAL `PIPELINE_STAGES` keys the engine
 * emits (`pipeline-config.ts`). `remediating` / `storing` are deliberately
 * unmapped — the pack's table has no row for them, so they render the
 * "Getting ready" fallback rather than leaking internal vocabulary.
 */
const JOURNEY_STAGE_NAMES: Record<string, string> = {
  extracting: "Reading your documents",
  relating: "Connecting the facts",
  grouping: "Organising topics",
  embedding: "Making it searchable",
  validating: "Checking against sources",
};

/**
 * One-line stage descriptions (copy pack §0 — Build tracker only; exported now
 * so PR-5 consumes the same table rather than re-authoring it).
 */
const JOURNEY_STAGE_DESCRIPTIONS: Record<string, string> = {
  extracting: "Pulling the facts out of each page.",
  relating: "Linking facts that belong together.",
  grouping: "Grouping related facts so answers stay focused.",
  embedding: "Preparing everything so questions find the right facts fast.",
  validating: "Making sure each fact matches the document it came from.",
};

/** The copy-pack fallback row — any unmapped/unknown/absent stage. */
export const JOURNEY_STAGE_FALLBACK_NAME = "Getting ready";
export const JOURNEY_STAGE_FALLBACK_DESCRIPTION = "Setting things up.";

/** Copy-pack on-screen name for a real pipeline stage key ("Getting ready" when unmapped). */
export function journeyStageName(stage: string | null | undefined): string {
  if (!stage) return JOURNEY_STAGE_FALLBACK_NAME;
  return JOURNEY_STAGE_NAMES[stage] ?? JOURNEY_STAGE_FALLBACK_NAME;
}

/** Copy-pack one-line description for a real pipeline stage key (Build tracker, PR-5). */
export function journeyStageDescription(stage: string | null | undefined): string {
  if (!stage) return JOURNEY_STAGE_FALLBACK_DESCRIPTION;
  return JOURNEY_STAGE_DESCRIPTIONS[stage] ?? JOURNEY_STAGE_FALLBACK_DESCRIPTION;
}
