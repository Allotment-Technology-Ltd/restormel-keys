/**
 * Create a domain pack from an introspected SurrealDB schema (with optional overrides).
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import { saveDomainPack, setSelectedDomainPackId } from "$lib/server/connect/domain-pack-service";
import {
  introspectSurrealGraphSchema,
  mergeSurrealSchemaImport,
} from "$lib/server/connect/surreal-schema-introspect";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const ImportSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*$/)
    .optional(),
  mapping: z
    .object({
      source_table: z.string().min(1).max(60).optional(),
      passage_table: z.string().min(1).max(60).optional(),
      unit_table: z.string().min(1).max(60).optional(),
      group_table: z.string().min(1).max(60).optional(),
      part_of_edge: z.string().min(1).max(60).optional(),
      relation_edges: z.array(z.string().min(1).max(60)).max(100).optional(),
    })
    .optional(),
  select_after_save: z.boolean().optional(),
});

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

  const parsed = ImportSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }

  const introspection = await introspectSurrealGraphSchema(ctx.workspaceId);
  if (!introspection.ok) {
    const status =
      introspection.error === "no_surreal_target" || introspection.error === "target_not_ready"
        ? 409
        : 502;
    return json(introspection, { status });
  }

  const upsert = mergeSurrealSchemaImport({
    introspection,
    title: parsed.data.title,
    slug: parsed.data.slug,
    mapping: parsed.data.mapping,
  });

  try {
    const pack = await saveDomainPack(ctx.workspaceId, upsert);
    if (parsed.data.select_after_save !== false) {
      await setSelectedDomainPackId(ctx.workspaceId, pack.id);
    }
    return json({ pack, suggested: introspection.suggested }, { status: 201 });
  } catch (e) {
    return json(
      {
        error: "save_failed",
        message: e instanceof Error ? e.message : "Could not save imported domain pack.",
      },
      { status: 500 },
    );
  }
};
