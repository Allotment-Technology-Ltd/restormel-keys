/**
 * POST /connect/v1/retrieve — Knowledge Retrieve (Phase 6).
 *
 * Uses the workspace's configured Bring-Your-Own graph store when present;
 * otherwise falls back to an empty store and returns honest degraded metadata.
 */
import {
  CONNECT_API_CONTRACT_VERSION,
  ConnectRetrieveRequestSchema,
  type ConnectRetrieveResponse,
} from "@restormel/contracts/connect";
import {
  buildContextBlock,
  retrieveContext,
  type GraphStore,
  type GraphRagDeps,
} from "@restormel/graphrag-core";
import { authorizeKnowledgeWorkspaceRequest } from "./auth.js";
import { buildWorkspaceGraphStore } from "$lib/server/connect/surreal-graph-store";

const emptyGraphStore: GraphStore = {
  async query<T>(_sql: string, _vars?: Record<string, unknown>): Promise<T> {
    return [] as T;
  },
  isDatabaseUnavailable() {
    return false;
  },
};

const stubEmbedder = {
  async embedQuery(_text: string): Promise<number[]> {
    return [];
  },
};

export type ConnectRetrieveHandlerOutcome =
  | { ok: true; status: 200; body: ConnectRetrieveResponse; requestId: string }
  | { ok: false; status: number; body: Record<string, unknown> };

export async function handleKnowledgeRetrieve(args: {
  locals: App.Locals;
  body: unknown;
  requestId: string;
}): Promise<ConnectRetrieveHandlerOutcome> {
  const parsed = ConnectRetrieveRequestSchema.safeParse(args.body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "invalid_request",
        message: parsed.error.issues.map((i) => i.message).join("; "),
      },
    };
  }

  const auth = await authorizeKnowledgeWorkspaceRequest({
    locals: args.locals,
    workspaceId: parsed.data.workspace_id,
    projectId: parsed.data.project_id,
  });
  if ("error" in auth && "status" in auth) {
    return { ok: false, status: auth.status, body: { error: auth.error, message: auth.message } };
  }

  let store: GraphStore = emptyGraphStore;
  try {
    const workspaceStore = await buildWorkspaceGraphStore(auth.workspaceId);
    if (workspaceStore) store = workspaceStore;
  } catch {
    store = emptyGraphStore;
  }

  const graphRagDeps: GraphRagDeps = {
    store,
    embedder: stubEmbedder,
    resolveOriginBucket: () => "other",
  };

  const retrieval = await retrieveContext(parsed.data.query, graphRagDeps, {
    maxClaims: parsed.data.max_claims,
    domain: parsed.data.domain_hint as import("@restormel/contracts/domains").PhilosophicalDomain | undefined,
  });

  const contextBlock = buildContextBlock(retrieval);
  const degraded = retrieval.degraded || retrieval.claims.length === 0;

  const response: ConnectRetrieveResponse = {
    contract_version: CONNECT_API_CONTRACT_VERSION,
    request_id: args.requestId,
    context_block: contextBlock,
    metadata: {
      claims_retrieved: retrieval.claims.length,
      arguments_retrieved: retrieval.arguments.length,
      retrieval_degraded: degraded,
      retrieval_degraded_reason: degraded
        ? (retrieval.degraded_reason ??
          "No graph index is attached to this workspace on hosted Knowledge yet. Connect a graph store or ingest corpus data (Phase 5b+).")
        : undefined,
    },
  };

  return { ok: true, status: 200, body: response, requestId: args.requestId };
}
