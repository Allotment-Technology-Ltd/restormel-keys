import { z } from "zod";

export const GraphEmbedBackfillRequestSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  embedding_route_id: z.string().uuid().optional(),
  domain_pack_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  scope: z.enum(["missing_only", "uniform_target"]).optional(),
});

export type GraphEmbedBackfillRequest = z.infer<typeof GraphEmbedBackfillRequestSchema>;

export function parseGraphEmbedBackfillRequest(body: unknown) {
  return GraphEmbedBackfillRequestSchema.safeParse(body);
}
