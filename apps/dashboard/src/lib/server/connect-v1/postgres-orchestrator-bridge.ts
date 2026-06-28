/**
 * Postgres-spine retrieval bridge (REC-ADR-008, Stage-1).
 *
 * The Connect graph orchestrator (`executeConnectGraphOp`) builds a SurrealQL `GraphStore`
 * and runs the beam-traversal engine. A host-managed Postgres target has no SurrealQL store,
 * so before Stage-1 it fell through to `emptyGraphStore` and a Postgres-defaulted workspace
 * "ingested fine but retrieved empty" — the opposite of the zero-setup happy path.
 *
 * This bridge closes that gap WITHOUT a SurrealQL→Postgres translation layer and WITHOUT
 * pgvector (founder decision: ship on the existing retrieval path). It delegates to
 * `retrieveFromPostgresSpine` — the already-shipped, store-native lexical-seed + 1-hop
 * traversal over `knowledge_graph_{units,relations,sources}` that returns the SAME
 * `RetrievalResult` contract with the SAME `VerificationPolicy` filter and the SAME
 * evidence-bound verdict mapping — then hands the result to the orchestrator's
 * `assembleResult`, so curation, token-budgeting, the context block, and the audit trace
 * are byte-identical to the Surreal path. That identity is what the G4 parity gate proves.
 *
 * `find_paths` is a graph-native operation with no relational-spine equivalent; the caller
 * keeps the empty-store behaviour for it (documented out-of-scope for the starter tier).
 */
import type {
  OrchestratorResult,
  OrchestratorTrace,
  RetrievalOrchestrator,
  VerificationPolicy,
} from "@restormel/graphrag-core";
import type { GraphSpineReaders } from "$lib/server/graph-comparison/postgres-graph-retrieve";

export type PostgresSpineRetrieveParams = {
  workspaceId: string;
  query: string;
  maxClaims?: number;
  seedClaimIds?: string[];
  verificationPolicy?: VerificationPolicy;
};

/**
 * Produce an {@link OrchestratorResult} for a host-managed Postgres target by running the
 * spine retrieval and assembling through the orchestrator (identical curation + trace).
 */
export async function retrievePostgresSpineViaOrchestrator(args: {
  orchestrator: RetrievalOrchestrator;
  operation: Extract<
    OrchestratorTrace["operation"],
    "retrieve_context" | "expand_context" | "find_relevant_subgraph"
  >;
  params: PostgresSpineRetrieveParams;
  maxTokens?: number;
  /** Injectable spine readers (tests pass an in-memory set); defaults to the live DB readers. */
  readers?: GraphSpineReaders;
}): Promise<OrchestratorResult> {
  // Dynamic import: keeps the spine retrieval (and its `$lib/server/neon` spine-reader
  // imports) OUT of the orchestrator's static module graph, so the Surreal/empty retrieval
  // path never loads it and neon mocks in unrelated tests need not stub the spine readers.
  const { retrieveFromPostgresSpine } = await import(
    "$lib/server/graph-comparison/postgres-graph-retrieve"
  );
  const { result } = await retrieveFromPostgresSpine(
    {
      workspaceId: args.params.workspaceId,
      query: args.params.query,
      ...(args.params.maxClaims !== undefined ? { maxClaims: args.params.maxClaims } : {}),
      ...(args.params.seedClaimIds ? { seedClaimIds: args.params.seedClaimIds } : {}),
      ...(args.params.verificationPolicy
        ? { verificationPolicy: args.params.verificationPolicy }
        : {}),
    },
    args.readers,
  );
  return args.orchestrator.assembleResult(args.operation, result, args.maxTokens);
}
