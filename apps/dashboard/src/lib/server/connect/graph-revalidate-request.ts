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
});

export type GraphRevalidateRequest = z.infer<typeof GraphRevalidateRequestSchema>;

export function parseGraphRevalidateRequest(body: unknown) {
  return GraphRevalidateRequestSchema.safeParse(body);
}
