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

export const GraphRevalidateRequestSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  validation_route_id: z.string().uuid().optional(),
  remediation_route_id: z.string().uuid().optional(),
  domain_pack_id: z.string().uuid().optional(),
  scope: GraphRevalidateScopeSchema.default("unchecked"),
  mode: GraphRevalidateModeSchema.default("validate"),
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
