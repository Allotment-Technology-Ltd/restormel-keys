/**
 * Session-scoped multi-database graph store config (Build 2A).
 * Persists the workspace's selected adapter (Neo4j today) to workspaces.graph_store_config.
 * Secret is write-only and encrypted at rest; never echoed back.
 */
import { json } from "@sveltejs/kit";
import { z } from "zod";
import {
  getWorkspaceGraphStoreConfigForUi,
  saveWorkspaceGraphStoreConfig,
  testSavedGraphStoreConfig,
} from "$lib/server/connect/graph-store-config";
import {
  isKnowledgeSessionFailure,
  resolveKnowledgeSessionContext,
} from "$lib/server/connect/session-context";
import type { RequestHandler } from "./$types";

const UpsertSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("neo4j"),
    connection_string: z.string().min(1).max(2000),
    database: z.string().min(1).max(120).optional(),
    username: z.string().min(1).max(120).optional(),
    secret: z.string().min(1).max(4000).optional(),
  }),
  z.object({
    type: z.literal("weaviate"),
    endpoint: z.string().min(1).max(2000),
    collection_prefix: z.string().max(120).optional(),
    secret: z.string().min(1).max(4000).optional(),
  }),
]);

export const GET: RequestHandler = async ({ locals }) => {
  const ctx = await resolveKnowledgeSessionContext(locals);
  if (isKnowledgeSessionFailure(ctx)) {
    return json({ error: ctx.error, message: ctx.message }, { status: ctx.status });
  }
  const config = await getWorkspaceGraphStoreConfigForUi(ctx.workspaceId);
  return json({ config });
};

export const PUT: RequestHandler = async ({ locals, request }) => {
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
  const parsed = UpsertSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      { error: "invalid_request", message: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 },
    );
  }
  const result = await saveWorkspaceGraphStoreConfig(
    ctx.workspaceId,
    parsed.data.type === "neo4j"
      ? {
          type: "neo4j",
          connectionString: parsed.data.connection_string,
          database: parsed.data.database,
          username: parsed.data.username,
          password: parsed.data.secret,
        }
      : {
          type: "weaviate",
          endpoint: parsed.data.endpoint,
          collectionPrefix: parsed.data.collection_prefix,
          password: parsed.data.secret,
        },
  );
  if (!result.ok) {
    return json({ error: result.error, message: result.message }, { status: result.status });
  }
  // Verify connectivity against the saved config and report it back.
  const test = await testSavedGraphStoreConfig(ctx.workspaceId);
  const config = await getWorkspaceGraphStoreConfigForUi(ctx.workspaceId);
  return json({ config, test });
};
