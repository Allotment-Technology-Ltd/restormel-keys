import { z } from "zod";
/**
 * Dashboard-side parse for graph revalidate POST bodies.
 *
 * Duplicates ConnectGraphRevalidateRequestSchema so SSR dev picks up scope
 * changes when this file reloads. Vite ignores packages dist watch events, so a
 * long-lived dev server can keep a stale contracts enum in memory.
 */
export const GraphRevalidateScopeSchema = z.enum([
  "all",
  "unchecked",
  "linked",
  "flagged",
  "quarantine",
  "unsupported",
]);

export const GraphRevalidateModeSchema = z.enum(["validate", "validate_and_remediate"]);

/**
 * How verdicts are produced:
 * - "ai": check each idea against its resolved source text with the LLM (default).
 * - "trust_provenance": accept graph-native ideas (those already linked to a source)
 *   as supported WITHOUT any LLM call — for pre-existing/curated graphs where the
 *   provenance is trusted and re-validation would just burn tokens.
 */
export const GraphValidationModeSchema = z.enum(["ai", "trust_provenance"]);

export const GraphRevalidateRequestSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  validation_route_id: z.string().uuid().optional(),
  remediation_route_id: z.string().uuid().optional(),
  domain_pack_id: z.string().uuid().optional(),
  scope: GraphRevalidateScopeSchema.default("unchecked"),
  mode: GraphRevalidateModeSchema.default("validate"),
  validation_mode: GraphValidationModeSchema.default("ai"),
  project_id: z.string().uuid().optional(),
  /** Cap on units processed per run (bounded batches for a large backlog). */
  max_units: z.number().int().min(1).max(100_000).optional(),
  /** Auto-enqueue the next batch until the scope is clear (overnight / background). */
  continue_in_background: z.boolean().optional(),
  /** Readiness-run cohort id — process only this run's stamped units. */
  cohort_run_id: z.string().optional(),
});

export type GraphRevalidateRequest = z.infer<typeof GraphRevalidateRequestSchema>;

export function parseGraphRevalidateRequest(body: unknown) {
  return GraphRevalidateRequestSchema.safeParse(body);
}
