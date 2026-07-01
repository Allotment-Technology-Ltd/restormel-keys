/**
 * Restormel Connect — public REST API contracts (Phase 0 draft).
 * Canonical programme: docs/architecture/SUITE-ARCHITECTURE-MIGRATION.md
 * OpenAPI mirror: docs/api/openapi-suite-v1-draft.yaml
 */
import { z } from 'zod';
import { VerificationRequestSchema } from './verification.js';
import { DomainPackVerificationRulesSchema } from './verification-rules.js';
import { VerifiedClaimEnvelopeSchema, VerifiedClaimSummarySchema } from './verified-claim.js';

/** Epoch for Connect REST request/response envelopes (independent of Zod schema version). */
export const CONNECT_API_CONTRACT_VERSION = '2026-06-01' as const;

export const ConnectApiContractVersionSchema = z.literal(CONNECT_API_CONTRACT_VERSION);

/** Keys workspace scope for all Connect graph data (see suite migration §10). */
export const ConnectWorkspaceContextSchema = z.object({
  workspace_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  environment_id: z.string().uuid().optional()
});

export type ConnectWorkspaceContext = z.infer<typeof ConnectWorkspaceContextSchema>;

/** Canonical ingest pipeline stages (SOPHIA-compatible resume keys). */
export const ConnectIngestStageSchema = z.enum([
  'extracting',
  'relating',
  'grouping',
  'embedding',
  'validating',
  'remediating',
  'storing'
]);

export type ConnectIngestStage = z.infer<typeof ConnectIngestStageSchema>;

export const ConnectIngestJobStatusSchema = z.enum([
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
]);

export type ConnectIngestJobStatus = z.infer<typeof ConnectIngestJobStatusSchema>;

// ─── Verify (Connect Verify sub-product) ───────────────────────────────────

export const ConnectVerifyRequestSchema = ConnectWorkspaceContextSchema.extend({
  contract_version: ConnectApiContractVersionSchema.optional(),
  verify: VerificationRequestSchema
});

export type ConnectVerifyRequest = z.infer<typeof ConnectVerifyRequestSchema>;

export const ConnectVerifyResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  request_id: z.string().min(1),
  result: z.record(z.string(), z.unknown()).describe('VerificationResult-shaped payload; see @restormel/contracts/verification')
});

export type ConnectVerifyResponse = z.infer<typeof ConnectVerifyResponseSchema>;

// ─── Retrieve (Connect Retrieve sub-product) ─────────────────────────────

export const ConnectRetrieveDepthSchema = z.enum(['quick', 'standard', 'deep']);

export type ConnectRetrieveDepth = z.infer<typeof ConnectRetrieveDepthSchema>;

export const ConnectRetrieveRequestSchema = ConnectWorkspaceContextSchema.extend({
  contract_version: ConnectApiContractVersionSchema.optional(),
  query: z.string().min(1),
  depth: ConnectRetrieveDepthSchema.optional(),
  domain_hint: z.string().min(1).optional(),
  max_claims: z.number().int().positive().max(500).optional(),
  require_verified: z.boolean().optional(),
  /** When set, traversal seeds from this claim id (`get_context_for` / explorer copy). */
  seed_claim_id: z.string().min(1).optional(),
  /**
   * As-of retrieval (Stage 3.3): return only claim versions valid at this ISO 8601
   * instant (`valid_from ≤ as_of < valid_to`). Claims whose chain holds an older
   * version valid at the instant are served AS that version. Stores without claim
   * version chains (BYO Surreal before Stage 3.2b) degrade explicitly — see
   * `metadata.temporal.degraded_reason` — never silently pretend.
   */
  as_of: z.string().datetime({ offset: true }).optional(),
  /**
   * Audit view (Stage 3.3): also return superseded claim versions with their recorded
   * states and validity windows, instead of current-only. Explicit opt-in.
   */
  include_superseded: z.boolean().optional()
});

export type ConnectRetrieveRequest = z.infer<typeof ConnectRetrieveRequestSchema>;

export const ConnectRetrievedClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  claim_type: z.string(),
  domain: z.string(),
  source_title: z.string(),
  confidence: z.number()
});

export const ConnectRetrievedRelationSchema = z.object({
  from_index: z.number().int().nonnegative(),
  to_index: z.number().int().nonnegative(),
  relation_type: z.string()
});

export const ConnectRetrievedArgumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  tradition: z.string().nullable(),
  summary: z.string(),
  conclusion_text: z.string().nullable().optional(),
  key_premises: z.array(z.string()).optional()
});

export const ConnectRetrieveGraphSchema = z.object({
  claims: z.array(ConnectRetrievedClaimSchema),
  relations: z.array(ConnectRetrievedRelationSchema),
  arguments: z.array(ConnectRetrievedArgumentSchema),
  seed_claim_ids: z.array(z.string())
});

export type ConnectRetrieveGraph = z.infer<typeof ConnectRetrieveGraphSchema>;

export const ConnectContextPackStatsSchema = z.object({
  token_budget: z.number(),
  estimated_tokens: z.number(),
  truncated: z.boolean(),
  claim_count: z.number(),
  relation_count: z.number(),
  argument_count: z.number()
});

export const ConnectContextPackPassSchema = z.object({
  block: z.string(),
  stats: ConnectContextPackStatsSchema
});

export const ConnectContextPackSchema = z.object({
  analysis: ConnectContextPackPassSchema,
  critique: ConnectContextPackPassSchema,
  synthesis: ConnectContextPackPassSchema
});

export type ConnectContextPack = z.infer<typeof ConnectContextPackSchema>;

/**
 * Temporal-filtering report (Stage 3.3) — present on responses whenever the request set
 * `as_of` and/or `include_superseded`. Degradation is always explicit: a store that
 * cannot answer temporally says so via `applied: false` + `degraded_reason`; it never
 * silently serves current data as if it were as-of data.
 */
export const ConnectTemporalMetadataSchema = z.object({
  /** The instant applied (echo of the request), or null when only auditing supersession. */
  as_of: z.string().nullable(),
  /** True only when version chains were consulted and the projection actually ran. */
  applied: z.boolean(),
  include_superseded: z.boolean(),
  /**
   * Why temporal filtering could not run (set iff `applied` is false):
   * - surreal_version_chains_unavailable — BYO Surreal stores carry no claim-version
   *   chains until the Stage 3.2b user opt-in; as_of cannot be honoured there yet.
   * - graph_target_not_configured — no graph store, so no version data to consult.
   * - version_lookup_failed — the version store errored; honest unknown.
   */
  degraded_reason: z
    .enum([
      'surreal_version_chains_unavailable',
      'graph_target_not_configured',
      'version_lookup_failed'
    ])
    .optional(),
  /** Claims dropped because no version in their chain was valid at `as_of`. */
  excluded_claims: z.number().int().nonnegative().optional(),
  /** Claims served as the (older) chain version that was valid at `as_of`. */
  substituted_claims: z.number().int().nonnegative().optional(),
  /** Superseded versions returned by the audit flag (include_superseded). */
  superseded_claims_returned: z.number().int().nonnegative().optional(),
  /**
   * Claims with no version rows (pre-versioning/legacy units). They are KEPT in the
   * response and counted here — temporal validity unknown is flagged, never filtered
   * silently and never presumed valid.
   */
  unversioned_claims: z.number().int().nonnegative().optional()
});
export type ConnectTemporalMetadata = z.infer<typeof ConnectTemporalMetadataSchema>;

/**
 * EBV read-time freshness report (docs/decisions/evidence-bound-verification.md §2). When
 * a `require_verified` retrieval runs, a fresh deterministic Layer-1 pass is re-run over
 * each served `supported`/`inferred` claim against its CURRENT source version; a claim
 * whose source content hash changed, whose quote moved off its offsets, or whose source
 * text could not be resolved is DEMOTED to `unverified` and never served as verified. This
 * block reports that recompute — the served truth at query time, not a stored snapshot.
 *
 * Additive: present only when the recheck actually ran (require_verified + the enforcement
 * cut is on). Absent ⇒ no read-time recheck was performed (verification states are the
 * stored ingest-time values).
 */
export const ConnectReadTimeRecheckMetadataSchema = z.object({
  /** True only when a fresh Layer-1 pass was attempted for at least one served claim. */
  applied: z.boolean(),
  /** Claims a fresh Layer-1 pass was attempted for. */
  rechecked: z.number().int().nonnegative(),
  /** Rechecked claims that passed and kept their stored support state. */
  fresh: z.number().int().nonnegative(),
  /** Claims demoted to `unverified` because their verification had rotted. */
  demoted: z.number().int().nonnegative(),
  /** Demotion reason → count (stale_source | span_lost | offsets_out_of_range | source_unavailable | no_bound_span). */
  demoted_by_reason: z.record(z.string(), z.number().int().nonnegative()).optional(),
  /**
   * True when a demotion occurred but the rendered `context_block` predates the recheck
   * (it may still contain a since-demoted claim). Purging demoted claims from the rendered
   * context is the orchestrator's pre-assembly job — see the read-time-recheck-retrieval
   * module. The structured `verified_claims` + `verification_summary` are always corrected.
   */
  context_block_stale: z.boolean().optional()
});
export type ConnectReadTimeRecheckMetadata = z.infer<typeof ConnectReadTimeRecheckMetadataSchema>;

export const ConnectRetrieveResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  request_id: z.string().min(1),
  /** Provenance trace id; fetch the full audit trace at GET /connect/v1/traces/{trace_id}. */
  trace_id: z.string().optional(),
  context_block: z.string(),
  context_pack: ConnectContextPackSchema.optional(),
  graph: ConnectRetrieveGraphSchema.optional(),
  /**
   * Verified-claim envelope per returned unit (matched by `claim.id`, not position) —
   * verification state, bound evidence spans, judge attribution, citation, and the
   * provenance trace link. See ./verified-claim.ts and the EBV ADR. Unverified or
   * excluded units are flagged by `state`, never silently blended.
   */
  verified_claims: z.array(VerifiedClaimEnvelopeSchema).optional(),
  metadata: z.object({
    claims_retrieved: z.number().int().nonnegative(),
    arguments_retrieved: z.number().int().nonnegative(),
    /** Per-state counts over `verified_claims` (quick non-supported gate). */
    verification_summary: VerifiedClaimSummarySchema.optional(),
    /** EBV read-time freshness recompute; present only when require_verified recheck ran. */
    read_time_recheck: ConnectReadTimeRecheckMetadataSchema.optional(),
    /** Temporal-filtering report; present when the request asked for as-of/audit data. */
    temporal: ConnectTemporalMetadataSchema.optional(),
    retrieval_degraded: z.boolean().optional(),
    retrieval_degraded_reason: z.string().optional(),
    retrieval_degraded_code: z
      .enum([
        'graph_target_not_configured',
        'graph_target_not_surreal',
        'graph_target_unreachable',
        'embedding_unavailable',
        'no_claims',
        'seed_claim_not_found',
        'graph_store_error'
      ])
      .optional(),
    detected_domain: z.string().optional(),
    domain_confidence: z.enum(['high', 'medium', 'low']).optional()
  })
});

export type ConnectRetrieveResponse = z.infer<typeof ConnectRetrieveResponseSchema>;

// ─── Memory (Stage 3.4 — agent observation write path) ─────────────────────

/**
 * Max observations per POST /connect/v1/memory request. Tuned to ONE span-scoped
 * entailment judge batch (ENTAILMENT_BATCH_SIZE = 10 in @restormel/connect-core) so a
 * memory write is always a small, bounded validation pass — never a bulk-ingest channel.
 */
export const CONNECT_MEMORY_MAX_OBSERVATIONS = 10;

/**
 * What "evidence" means for an agent observation (EBV rules apply unchanged):
 * the agent quotes the exact text it saw (`quote`), optionally with the surrounding
 * passage (`context`) and a reference to where it saw it (`source_ref`). The quote is
 * bound deterministically (EBV Layer 1) against the submitted evidence corpus — which
 * is stored verbatim as the observation source version, so the span stays re-checkable —
 * and the entailment judge (Layer 2) then decides whether the quote entails the
 * observation. The evidence is AGENT-ATTESTED: provenance records that it arrived via
 * the memory write path, not a Restormel-crawled source. An observation with no
 * evidence at all can never be "supported" — at best inferred/unverified per EBV.
 */
export const ConnectMemoryEvidenceSchema = z.object({
  /** Exact quote supporting the observation (verbatim — it is bound, not paraphrased). */
  quote: z.string().min(1).max(2000),
  /** Where the agent saw it (URL, document title, tool name…). Audit metadata only. */
  source_ref: z.string().min(1).max(500).optional(),
  /** Surrounding passage the quote appears in; stored as the bindable source text. */
  context: z.string().min(1).max(8000).optional()
});

export type ConnectMemoryEvidence = z.infer<typeof ConnectMemoryEvidenceSchema>;

export const ConnectMemoryObservationSchema = z.object({
  /** The claim the agent wants to remember. */
  text: z.string().min(1).max(2000),
  evidence: ConnectMemoryEvidenceSchema.optional()
});

export type ConnectMemoryObservation = z.infer<typeof ConnectMemoryObservationSchema>;

export const ConnectMemoryWriteRequestSchema = ConnectWorkspaceContextSchema.extend({
  contract_version: ConnectApiContractVersionSchema.optional(),
  observations: z
    .array(ConnectMemoryObservationSchema)
    .min(1)
    .max(CONNECT_MEMORY_MAX_OBSERVATIONS)
});

export type ConnectMemoryWriteRequest = z.infer<typeof ConnectMemoryWriteRequestSchema>;

/** EBV verification states an observation can land in (see verified-claim.ts). */
export const ConnectMemoryVerificationStateSchema = z.enum([
  'supported',
  'inferred',
  'unverified',
  'contradicted',
  'excluded'
]);

/**
 * accepted — persisted and reaches verified retrieval (supported; inferred is labeled).
 * review   — persisted as unverified; held for the review queue, never strict retrieval.
 * rejected — soft-excluded by remediation (no basis in the submitted evidence).
 */
export const ConnectMemoryOutcomeSchema = z.enum(['accepted', 'review', 'rejected']);

export const ConnectMemoryObservationResultSchema = z.object({
  /** Position of the observation in the request array. */
  index: z.number().int().nonnegative(),
  /** Stored unit record id (claims are persisted whatever the verdict — soft-excluded when rejected). */
  unit_id: z.string(),
  /** Deterministic claim identity (Stage 3.2 machinery). */
  claim_key: z.string().nullable(),
  /** Final stored text (remediation may have repaired it to match the evidence). */
  text: z.string(),
  verification_state: ConnectMemoryVerificationStateSchema,
  evidence_binding: z.enum(['bound', 'unbound', 'no_evidence']),
  outcome: ConnectMemoryOutcomeSchema,
  /** True when remediation repaired the text and the repair re-passed the judge gate. */
  repaired: z.boolean(),
  /** Transparent machine+human readable reasons (binding/entailment/remediation notes). */
  reasons: z.array(z.string())
});

export type ConnectMemoryObservationResult = z.infer<typeof ConnectMemoryObservationResultSchema>;

export const ConnectMemoryWriteResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  request_id: z.string().min(1),
  /** Source record registering this submission (kind "agent_observation"). */
  source_id: z.string(),
  provenance: z.object({
    kind: z.literal('agent_observation'),
    /** Submitting key id (audit identity — never the raw key). */
    key_id: z.string().nullable(),
    auth_type: z.string()
  }),
  results: z.array(ConnectMemoryObservationResultSchema),
  summary: z.object({
    supported: z.number().int().nonnegative(),
    inferred: z.number().int().nonnegative(),
    unverified: z.number().int().nonnegative(),
    excluded: z.number().int().nonnegative(),
    /** Units embedded for vector retrieval (may lag `results` if embedding degraded). */
    embedded: z.number().int().nonnegative()
  }),
  warnings: z.array(z.string()).optional()
});

export type ConnectMemoryWriteResponse = z.infer<typeof ConnectMemoryWriteResponseSchema>;

// ─── Graph orchestrator (higher-order retrieval — RetrievalOrchestrator) ────

export const ConnectGraphVerificationCategorySchema = z.enum(['supported', 'weak', 'unsupported']);
export type ConnectGraphVerificationCategory = z.infer<typeof ConnectGraphVerificationCategorySchema>;

/**
 * Per-query trust filter. Defaults to supported-only with flagged excluded —
 * weak/unsupported claims are returned only when explicitly requested.
 */
export const ConnectGraphVerificationPolicySchema = z.object({
  include: z.array(ConnectGraphVerificationCategorySchema).min(1),
  min_trust_score: z.number().min(0).max(100).optional(),
  exclude_flagged: z.boolean().optional()
});
export type ConnectGraphVerificationPolicy = z.infer<typeof ConnectGraphVerificationPolicySchema>;

export const ConnectGraphReasoningModeSchema = z.enum(['semantic', 'causal', 'temporal']);
export type ConnectGraphReasoningMode = z.infer<typeof ConnectGraphReasoningModeSchema>;

export const ConnectGraphOperationSchema = z.enum([
  'retrieve_context',
  'expand_context',
  'find_relevant_subgraph',
  'find_paths',
  'summarise_subgraph'
]);
export type ConnectGraphOperation = z.infer<typeof ConnectGraphOperationSchema>;

export const ConnectGraphOpRequestSchema = ConnectWorkspaceContextSchema.extend({
  contract_version: ConnectApiContractVersionSchema.optional(),
  operation: ConnectGraphOperationSchema,
  /** retrieve_context */
  query: z.string().min(1).optional(),
  /** find_relevant_subgraph */
  topic: z.string().min(1).optional(),
  reasoning_mode: ConnectGraphReasoningModeSchema.optional(),
  top_k: z.number().int().positive().max(100).optional(),
  max_depth: z.number().int().positive().max(8).optional(),
  max_nodes: z.number().int().positive().max(500).optional(),
  domain: z.string().min(1).optional(),
  /** expand_context */
  seed_node_ids: z.array(z.string().min(1)).min(1).max(50).optional(),
  depth: z.number().int().positive().max(8).optional(),
  edge_types: z.array(z.string().min(1)).max(20).optional(),
  /** find_paths */
  source_node_id: z.string().min(1).optional(),
  target_node_id: z.string().min(1).optional(),
  max_hops: z.number().int().positive().max(8).optional(),
  /** shared */
  max_tokens: z.number().int().positive().max(100_000).optional(),
  verification_policy: ConnectGraphVerificationPolicySchema.optional(),
  /**
   * As-of retrieval (Stage 3.3): subgraph ops return only claim versions valid at this
   * ISO 8601 instant. Stores without version chains degrade explicitly via
   * `metadata.temporal.degraded_reason`. Ignored by find_paths (no claim payload).
   */
  as_of: z.string().datetime({ offset: true }).optional(),
  /** Audit view (Stage 3.3): also return superseded versions with states + windows. */
  include_superseded: z.boolean().optional()
});
export type ConnectGraphOpRequest = z.infer<typeof ConnectGraphOpRequestSchema>;

export const ConnectGraphNodeSchema = ConnectRetrievedClaimSchema.extend({
  verification_state: z.string().nullable().optional(),
  trust_score: z.number().nullable().optional(),
  verification_category: ConnectGraphVerificationCategorySchema.optional()
});
export type ConnectGraphNode = z.infer<typeof ConnectGraphNodeSchema>;

export const ConnectGraphPathSchema = z.object({
  node_ids: z.array(z.string()),
  relations: z.array(
    z.object({
      relation_type: z.string(),
      from_node_id: z.string(),
      to_node_id: z.string()
    })
  ),
  score: z.number()
});
export type ConnectGraphPath = z.infer<typeof ConnectGraphPathSchema>;

const ConnectGraphCategoryCountsSchema = z.object({
  supported: z.number().int().nonnegative(),
  weak: z.number().int().nonnegative(),
  unsupported: z.number().int().nonnegative()
});

export const ConnectGraphTraceSummarySchema = z.object({
  operation: ConnectGraphOperationSchema,
  seed_count: z.number().int().nonnegative(),
  hops: z.number().int().nonnegative(),
  claim_count: z.number().int().nonnegative(),
  relation_count: z.number().int().nonnegative(),
  tokens_used: z.number().int().nonnegative(),
  nodes_dropped: z.number().int().nonnegative(),
  reasoning_mode: ConnectGraphReasoningModeSchema.optional(),
  verification: z
    .object({
      include: z.array(ConnectGraphVerificationCategorySchema),
      exclude_flagged: z.boolean(),
      included: ConnectGraphCategoryCountsSchema,
      excluded: ConnectGraphCategoryCountsSchema
    })
    .optional(),
  reason: z.string().optional()
});
export type ConnectGraphTraceSummary = z.infer<typeof ConnectGraphTraceSummarySchema>;

export const ConnectGraphOpResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  request_id: z.string().min(1),
  /** Provenance trace id; fetch the full audit trace at GET /connect/v1/traces/{trace_id}. */
  trace_id: z.string().optional(),
  operation: ConnectGraphOperationSchema,
  context_block: z.string().optional(),
  subgraph: z
    .object({
      claims: z.array(ConnectGraphNodeSchema),
      relations: z.array(ConnectRetrievedRelationSchema),
      arguments: z.array(ConnectRetrievedArgumentSchema),
      seed_claim_ids: z.array(z.string())
    })
    .optional(),
  paths: z.array(ConnectGraphPathSchema).optional(),
  /**
   * Verified-claim envelope per subgraph claim (matched by `claim.id`) — see
   * ./verified-claim.ts and docs/decisions/evidence-bound-verification.md.
   */
  verified_claims: z.array(VerifiedClaimEnvelopeSchema).optional(),
  trace: ConnectGraphTraceSummarySchema,
  metadata: z.object({
    retrieval_degraded: z.boolean().optional(),
    retrieval_degraded_reason: z.string().optional(),
    /** Per-state counts over `verified_claims` (quick non-supported gate). */
    verification_summary: VerifiedClaimSummarySchema.optional(),
    /** Temporal-filtering report; present when the request asked for as-of/audit data. */
    temporal: ConnectTemporalMetadataSchema.optional()
  })
});
export type ConnectGraphOpResponse = z.infer<typeof ConnectGraphOpResponseSchema>;

// ─── Ingest (Connect Ingest sub-product) ───────────────────────────────────

/** Provenance hints from a source pre-check (URL/HTML head or upload filename). */
export const ConnectSourceProvenanceSchema = z.object({
  title: z.string().max(500).optional(),
  canonical_url: z.string().max(2000).optional(),
  url: z.string().max(2000).optional(),
  authors: z.array(z.string().max(200)).max(20).optional(),
  description: z.string().max(2000).optional(),
  site_name: z.string().max(200).optional(),
  published_at: z.string().max(80).optional(),
  /**
   * Surreal record id of the bibliographic source this document was copied FROM when it
   * originated in the user's own BYO graph (set by graph-import). Its presence tells the
   * ingest writer the user's store already holds the full source text under this record,
   * so re-ingest must NOT re-write / clobber it (P2a BYO double-write guard).
   */
  graph_source_key: z.string().max(2000).optional()
});
export type ConnectSourceProvenance = z.infer<typeof ConnectSourceProvenanceSchema>;

export const ConnectIngestSourceSchema = z.object({
  url: z.string().url().optional(),
  text: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  content_type: z.enum(['url', 'text', 'file_ref']).optional(),
  provenance: ConnectSourceProvenanceSchema.optional()
}).refine((s) => Boolean(s.url?.trim() || s.text?.trim()), {
  message: 'Provide at least one of `url` or `text` on each source.'
});

export const ConnectIngestJobCreateRequestSchema = ConnectWorkspaceContextSchema.extend({
  contract_version: ConnectApiContractVersionSchema.optional(),
  sources: z.array(ConnectIngestSourceSchema).min(1).max(100),
  /** Optional label for operator UI / idempotency hints. */
  label: z.string().min(1).max(200).optional(),
  stop_after_stage: ConnectIngestStageSchema.optional(),
  /** Optional references to operator configuration (domain-agnostic ingestion). */
  pipeline_profile_id: z.string().uuid().optional(),
  domain_pack_id: z.string().uuid().optional(),
  graph_target_id: z.string().uuid().optional()
});

export type ConnectIngestJobCreateRequest = z.infer<typeof ConnectIngestJobCreateRequestSchema>;

/**
 * Dashboard (session) create payload — workspace is resolved server-side from the
 * signed-in session, so it is omitted here. Used by the operator BFF.
 */
export const ConnectIngestJobDashboardCreateSchema = z
  .object({
    sources: z.array(ConnectIngestSourceSchema).max(100).optional(),
    /** Previously-added, parsed source documents to include (expanded server-side). */
    document_ids: z.array(z.string().uuid()).max(200).optional(),
    label: z.string().min(1).max(200).optional(),
    stop_after_stage: ConnectIngestStageSchema.optional(),
    project_id: z.string().uuid().optional(),
    pipeline_profile_id: z.string().uuid().optional(),
    domain_pack_id: z.string().uuid().optional(),
    graph_target_id: z.string().uuid().optional()
  })
  .refine((v) => (v.sources?.length ?? 0) > 0 || (v.document_ids?.length ?? 0) > 0, {
    message: 'Provide at least one source or document.'
  });

export type ConnectIngestJobDashboardCreate = z.infer<typeof ConnectIngestJobDashboardCreateSchema>;

/** Re-run validation on units already stored in the workspace graph. */
export const ConnectGraphRevalidateScopeSchema = z.enum([
  'all',
  'unchecked',
  'linked',
  'flagged',
  'quarantine',
  'unsupported'
]);
export type ConnectGraphRevalidateScope = z.infer<typeof ConnectGraphRevalidateScopeSchema>;

export const ConnectGraphRevalidateModeSchema = z.enum([
  'validate',
  'validate_and_remediate',
  // Remediate ideas already flagged weak/unsupported — no re-validation pass.
  'remediate'
]);
export type ConnectGraphRevalidateMode = z.infer<typeof ConnectGraphRevalidateModeSchema>;

/** Remediation aggressiveness: repair-only (conservative) → repair + remove unsupported (strict). */
export const ConnectGraphRemediationStrictnessSchema = z.enum([
  'conservative',
  'balanced',
  'strict'
]);
export type ConnectGraphRemediationStrictness = z.infer<
  typeof ConnectGraphRemediationStrictnessSchema
>;

export const ConnectGraphRevalidateRequestSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  /** Keys ingestion route id for the validation stage (overrides workspace default). */
  validation_route_id: z.string().uuid().optional(),
  /** Keys ingestion route id for the remediation stage (overrides workspace default). */
  remediation_route_id: z.string().uuid().optional(),
  domain_pack_id: z.string().uuid().optional(),
  scope: ConnectGraphRevalidateScopeSchema.default('unchecked'),
  mode: ConnectGraphRevalidateModeSchema.default('validate'),
  /**
   * Verdict source: "ai" runs the LLM faithfulness check (default); "trust_provenance"
   * accepts graph-native ideas (already linked to a source) as supported with no LLM —
   * for pre-existing/curated graphs where re-validation would only burn tokens.
   */
  validation_mode: z.enum(['ai', 'trust_provenance']).default('ai'),
  /** Remediation aggressiveness (mode "remediate" / "validate_and_remediate"). */
  remediation_strictness: ConnectGraphRemediationStrictnessSchema.default('balanced'),
  /** Min model confidence (0-1) before a remediation action applies; defaults per level. */
  remediation_threshold: z.number().min(0).max(1).optional(),
  project_id: z.string().uuid().optional(),
  /**
   * Cap on units processed per run, so a large backlog is cleared in bounded
   * batches (predictable cost, survives worker time limits). Omit to process all.
   */
  max_units: z.number().int().min(1).max(100_000).optional(),
  /**
   * After a capped run, automatically enqueue the next batch until the scope is
   * clear — lets a big backlog drain unattended (overnight / background).
   */
  continue_in_background: z.boolean().optional(),
  /**
   * Readiness-run cohort id. When set, the job only processes units stamped as
   * members of that run (knowledge_readiness_run_units), so a named pass can take
   * its specific cohort through validation independent of the global backlog.
   */
  cohort_run_id: z.string().optional()
});
export type ConnectGraphRevalidateRequest = z.infer<typeof ConnectGraphRevalidateRequestSchema>;

/** Re-link graph ideas to the best matching ingest or pipeline source text. */
export const ConnectGraphLinkSourcesScopeSchema = z.enum(['all', 'unlinked_only']);
export type ConnectGraphLinkSourcesScope = z.infer<typeof ConnectGraphLinkSourcesScopeSchema>;

export const ConnectGraphLinkSourcesRequestSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  domain_pack_id: z.string().uuid().optional(),
  scope: ConnectGraphLinkSourcesScopeSchema.default('unlinked_only'),
  project_id: z.string().uuid().optional(),
  /** Readiness-run cohort id — link only this run's stamped units. */
  cohort_run_id: z.string().optional()
});
export type ConnectGraphLinkSourcesRequest = z.infer<typeof ConnectGraphLinkSourcesRequestSchema>;

// ─── Source documents (connectors + parsing) ─────────────────────────────────

/** Where a source document came from. */
export const ConnectSourceKindSchema = z.enum(['upload', 'url', 's3', 'google_drive', 'sharepoint']);
export type ConnectSourceKind = z.infer<typeof ConnectSourceKindSchema>;

export const ConnectSourceDocumentStatusSchema = z.enum(['parsed', 'failed', 'pending']);
export type ConnectSourceDocumentStatus = z.infer<typeof ConnectSourceDocumentStatusSchema>;

/** A normalized, parsed document available to ingest jobs. Never includes full text. */
export const ConnectSourceDocumentSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  source_kind: ConnectSourceKindSchema,
  name: z.string().min(1).max(500),
  mime: z.string().max(200).optional(),
  url: z.string().max(2000).optional(),
  provenance: ConnectSourceProvenanceSchema.optional(),
  char_count: z.number().int().nonnegative(),
  chunk_count: z.number().int().nonnegative(),
  status: ConnectSourceDocumentStatusSchema,
  error: z.string().optional(),
  parser_provider: z.string().max(60).optional(),
  created_at: z.string().datetime()
});

export type ConnectSourceDocument = z.infer<typeof ConnectSourceDocumentSchema>;

/** Add-document request from the operator UI (URL fetch or inline upload). */
export const ConnectSourceDocumentCreateSchema = z
  .object({
    kind: z.enum(['url', 'upload']),
    url: z.string().url().max(2000).optional(),
    name: z.string().min(1).max(500).optional(),
    mime: z.string().max(200).optional(),
    /** For upload: UTF-8 text or base64; binary formats need a managed parser. */
    content: z.string().max(5_000_000).optional(),
    content_encoding: z.enum(['utf8', 'base64']).default('utf8'),
    /** From pre-check; applied to display name and stored on the document. */
    provenance: ConnectSourceProvenanceSchema.optional()
  })
  .refine((v) => (v.kind === 'url' ? Boolean(v.url) : Boolean(v.content)), {
    message: 'url is required for kind=url; content is required for kind=upload.'
  });

export type ConnectSourceDocumentCreate = z.infer<typeof ConnectSourceDocumentCreateSchema>;

export const ConnectSourceDocumentPreviewRequestSchema = z
  .object({
    kind: z.enum(['url', 'upload']),
    url: z.string().url().max(2000).optional(),
    name: z.string().min(1).max(500).optional(),
    mime: z.string().max(200).optional(),
    content: z.string().max(512_000).optional(),
    content_encoding: z.enum(['utf8', 'base64']).default('utf8')
  })
  .refine((v) => (v.kind === 'url' ? Boolean(v.url) : Boolean(v.content)), {
    message: 'url is required for kind=url; content is required for kind=upload.'
  });

export type ConnectSourceDocumentPreviewRequest = z.infer<
  typeof ConnectSourceDocumentPreviewRequestSchema
>;

export const ConnectSourceDocumentPreviewResponseSchema = z.object({
  ok: z.literal(true),
  suggested_name: z.string().min(1).max(500),
  mime: z.string().max(200).optional(),
  provenance: ConnectSourceProvenanceSchema,
  warnings: z.array(z.string().max(500)).max(10).optional()
});

export type ConnectSourceDocumentPreviewResponse = z.infer<
  typeof ConnectSourceDocumentPreviewResponseSchema
>;

// ─── Source connections (cloud connectors) ───────────────────────────────────

/** Connectors that hold a persisted connection (OAuth/credentialed). */
export const ConnectConnectorProviderSchema = z.enum(['s3', 'google_drive', 'sharepoint']);
export type ConnectConnectorProvider = z.infer<typeof ConnectConnectorProviderSchema>;

export const ConnectConnectionStatusSchema = z.enum(['connected', 'needs_auth', 'error']);
export type ConnectConnectionStatus = z.infer<typeof ConnectConnectionStatusSchema>;

/** A saved connector connection (never includes the secret). */
export const ConnectSourceConnectionSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  provider: ConnectConnectorProviderSchema,
  label: z.string().max(200).optional(),
  /** Non-secret config surfaced to the UI (e.g. S3 region/bucket/prefix). */
  config: z.record(z.string(), z.unknown()),
  secret_set: z.boolean(),
  status: ConnectConnectionStatusSchema,
  error: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ConnectSourceConnection = z.infer<typeof ConnectSourceConnectionSchema>;

/** Create an S3 (or S3-compatible) connection. */
export const ConnectS3ConnectionCreateSchema = z.object({
  provider: z.literal('s3'),
  label: z.string().min(1).max(200).optional(),
  region: z.string().min(1).max(60),
  bucket: z.string().min(1).max(200),
  prefix: z.string().max(500).optional(),
  /** S3-compatible endpoint (R2, MinIO, Backblaze). Omit for AWS S3. */
  endpoint: z.string().url().max(500).optional(),
  access_key_id: z.string().min(1).max(200),
  secret_access_key: z.string().min(1).max(400)
});

export type ConnectS3ConnectionCreate = z.infer<typeof ConnectS3ConnectionCreateSchema>;

/** A document discovered by browsing a connector. */
export const ConnectConnectorDocRefSchema = z.object({
  id: z.string().min(1).max(2000),
  name: z.string().min(1).max(500),
  mime: z.string().max(200).optional(),
  size: z.number().int().nonnegative().optional(),
  uri: z.string().max(2000).optional()
});

export type ConnectConnectorDocRef = z.infer<typeof ConnectConnectorDocRefSchema>;

/** Import selected connector documents. */
export const ConnectConnectorImportSchema = z.object({
  refs: z.array(ConnectConnectorDocRefSchema).min(1).max(100)
});

export type ConnectConnectorImport = z.infer<typeof ConnectConnectorImportSchema>;

// ─── Per-stage Keys route routing (visual route builder) ─────────────────────

/** Ingestion stages that call an LLM (relations are folded into extraction). */
export const CONNECT_MODEL_STAGES = [
  'extraction',
  'grouping',
  'validation',
  'remediation',
  'embedding'
] as const;

export type ConnectModelStage = (typeof CONNECT_MODEL_STAGES)[number];

/** Maps a Connect stage to Keys route discovery `stage` when `workload=ingestion`. */
export const CONNECT_STAGE_TO_INGESTION_ROUTE_STAGE: Record<ConnectModelStage, string> = {
  extraction: 'ingestion_extraction',
  grouping: 'ingestion_grouping',
  validation: 'ingestion_validation',
  remediation: 'ingestion_remediation',
  embedding: 'ingestion_embedding'
};

const stageRouteId = z.string().uuid();

/**
 * Workspace-scoped Keys routing for Connect ingestion. Routes are edited in the
 * visual route builder; resolve discovers by workload+stage or an explicit route id.
 */
export const ConnectStageRoutingSchema = z.object({
  project_id: z.string().uuid(),
  environment_id: z.string().uuid().optional(),
  /** Optional explicit route id per stage; omit to use workload/stage discovery. */
  routes: z
    .object({
      extraction: stageRouteId.optional(),
      grouping: stageRouteId.optional(),
      validation: stageRouteId.optional(),
      remediation: stageRouteId.optional(),
      embedding: stageRouteId.optional()
    })
    .optional(),
  /** Pipeline wizard / ingest default domain pack for this workspace. */
  default_domain_pack_id: z.string().uuid().optional()
});

export type ConnectStageRouting = z.infer<typeof ConnectStageRoutingSchema>;

/** @deprecated Use ConnectStageRoutingSchema — legacy model-id chains (pre-Keys routes). */
export const ConnectStageModelsSchema = z.object({
  extraction: z.array(z.string().min(1).max(120)).max(8).optional(),
  grouping: z.array(z.string().min(1).max(120)).max(8).optional(),
  validation: z.array(z.string().min(1).max(120)).max(8).optional(),
  remediation: z.array(z.string().min(1).max(120)).max(8).optional(),
  embedding: z.array(z.string().min(1).max(120)).max(8).optional()
});

/** @deprecated Use ConnectStageRouting */
export type ConnectStageModels = z.infer<typeof ConnectStageModelsSchema>;

/** Website / sitemap crawl request. */
export const ConnectCrawlRequestSchema = z.object({
  root_url: z.string().url().max(2000),
  max_pages: z.number().int().positive().max(50).default(10),
  same_host_only: z.boolean().default(true),
  use_sitemap: z.boolean().default(true)
});

export type ConnectCrawlRequest = z.infer<typeof ConnectCrawlRequestSchema>;

export const ConnectIngestJobProgressSchema = z.object({
  percent: z.number().min(0).max(100),
  processed: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  execution_mode: z.enum(["stub", "full"]).optional(),
});

export type ConnectIngestJobProgress = z.infer<typeof ConnectIngestJobProgressSchema>;

export const ConnectIngestStageProgressMetricsSchema = z.object({
  percent: z.number().min(0).max(100),
  processed: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  eta_seconds: z.number().int().nonnegative().optional(),
});

export type ConnectIngestStageProgressMetrics = z.infer<
  typeof ConnectIngestStageProgressMetricsSchema
>;

export const ConnectIngestJobStageProgressSchema = z.object({
  stage: ConnectIngestStageSchema,
  status: z.enum(['pending', 'running', 'completed', 'failed', 'skipped']),
  started_at: z.string().datetime().optional(),
  completed_at: z.string().datetime().optional(),
  error: z.string().optional(),
  progress: ConnectIngestStageProgressMetricsSchema.optional(),
});

/**
 * Public ingest quality report (C2). Curated, stable projection of the internal
 * run quality report — surfaces trust score and the supported/weak/unsupported
 * validation breakdown so external consumers can gate on graph quality without
 * the operator-only internals (next_actions, pack readiness, percentages).
 */
export const ConnectIngestQualityReportSchema = z.object({
  trust_score: z.number().min(0).max(100),
  supported_count: z.number().int().nonnegative(),
  weak_count: z.number().int().nonnegative(),
  unsupported_count: z.number().int().nonnegative(),
  total_count: z.number().int().nonnegative(),
  remediation_applied: z.boolean(),
  assessed_at: z.string().datetime(),
});

export type ConnectIngestQualityReport = z.infer<typeof ConnectIngestQualityReportSchema>;

export const ConnectIngestJobSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  status: ConnectIngestJobStatusSchema,
  label: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  current_stage: ConnectIngestStageSchema.optional(),
  /** Teleprompter line — what the worker is doing right now. */
  current_action: z.string().max(500).optional(),
  progress: ConnectIngestJobProgressSchema.optional(),
  stages: z.array(ConnectIngestJobStageProgressSchema).optional(),
  /** Job inputs (echoed back to operator UI on detail reads). */
  sources: z.array(ConnectIngestSourceSchema).optional(),
  stop_after_stage: ConnectIngestStageSchema.optional(),
  /** Pipeline profile / domain pack / graph target the job was created against (operator UI). */
  pipeline_profile_id: z.string().uuid().optional(),
  domain_pack_id: z.string().uuid().optional(),
  graph_target_id: z.string().uuid().optional(),
  /** Curated quality report (present once a run reaches a terminal state with graph stats). */
  quality_report: ConnectIngestQualityReportSchema.nullable().optional(),
  error: z.string().optional()
});

export type ConnectIngestJob = z.infer<typeof ConnectIngestJobSchema>;

export const ConnectIngestJobCreateResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  job: ConnectIngestJobSchema
});

export type ConnectIngestJobCreateResponse = z.infer<typeof ConnectIngestJobCreateResponseSchema>;

export const ConnectIngestJobListResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  jobs: z.array(ConnectIngestJobSchema),
  /** Opaque cursor; pass as ?cursor= to fetch the next page. Null when no further pages. */
  next_cursor: z.string().nullable(),
  total_count: z.number().int().nonnegative(),
});

export type ConnectIngestJobListResponse = z.infer<typeof ConnectIngestJobListResponseSchema>;

export const ConnectIngestJobStatusResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  job: ConnectIngestJobSchema
});

export type ConnectIngestJobStatusResponse = z.infer<typeof ConnectIngestJobStatusResponseSchema>;

/** Incremental live status for operator run console (poll with ?since=log_id). */
export const ConnectIngestJobLiveStatusResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  job: ConnectIngestJobSchema,
  log_lines: z.array(z.string()),
  log_line_total: z.number().int().nonnegative(),
  since: z.number().int().nonnegative(),
});

export type ConnectIngestJobLiveStatusResponse = z.infer<
  typeof ConnectIngestJobLiveStatusResponseSchema
>;

// ─── Public live log streaming (I11) ─────────────────────────────────────────
//
// GET /connect/v1/ingest/jobs/{jobId}/logs?since=&limit= — incremental, paginated
// worker log lines for external consumers (the operator BFF stream, but public).

export const ConnectIngestJobLogLineSchema = z.object({
  /** Monotonic cursor — pass the response's next_since back as ?since= to page forward. */
  index: z.number().int().nonnegative(),
  timestamp: z.string().datetime(),
  /** Bracket tag the worker emitted (EXTRACT, RELATE, STORE, INGEST, FATAL, …). */
  stage: z.string(),
  level: z.enum(["info", "warn", "error"]),
  message: z.string(),
});

export type ConnectIngestJobLogLine = z.infer<typeof ConnectIngestJobLogLineSchema>;

export const ConnectIngestJobLogsResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  job_id: z.string().uuid(),
  log_lines: z.array(ConnectIngestJobLogLineSchema),
  /** Cursor to pass as ?since= on the next poll (highest index returned). */
  next_since: z.number().int().nonnegative(),
  /** Total log lines recorded for the job (for progress UIs). */
  total: z.number().int().nonnegative(),
});

export type ConnectIngestJobLogsResponse = z.infer<typeof ConnectIngestJobLogsResponseSchema>;

// ─── Ingest webhooks (I1) ────────────────────────────────────────────────────
//
// Workspace-scoped outbound webhooks fired when an ingest job reaches a terminal
// state. Payloads are HMAC-SHA256 signed (X-Restormel-Signature: sha256=<hex>).

export const ConnectWebhookEventSchema = z.enum([
  "job.completed",
  "job.failed",
  "job.quality_below_threshold",
]);

export type ConnectWebhookEvent = z.infer<typeof ConnectWebhookEventSchema>;

export const ConnectWebhookCreateRequestSchema = z.object({
  workspace_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  url: z.string().url().max(2048),
  events: z.array(ConnectWebhookEventSchema).min(1),
  /** Trust-score threshold (0–100) for job.quality_below_threshold. Default 70. */
  quality_threshold: z.number().min(0).max(100).optional(),
  /** Caller-supplied signing secret; one is generated and returned when omitted. */
  secret: z.string().min(16).max(256).optional(),
});

export type ConnectWebhookCreateRequest = z.infer<typeof ConnectWebhookCreateRequestSchema>;

export const ConnectWebhookSchema = z.object({
  webhook_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  url: z.string().url(),
  events: z.array(ConnectWebhookEventSchema),
  quality_threshold: z.number().min(0).max(100).nullable().optional(),
  active: z.boolean(),
  created_at: z.string().datetime(),
});

export type ConnectWebhook = z.infer<typeof ConnectWebhookSchema>;

/** Registration response — includes the signing_secret exactly once. */
export const ConnectWebhookCreateResponseSchema = ConnectWebhookSchema.extend({
  signing_secret: z.string(),
});

export type ConnectWebhookCreateResponse = z.infer<typeof ConnectWebhookCreateResponseSchema>;

export const ConnectWebhookListResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  webhooks: z.array(ConnectWebhookSchema),
});

export type ConnectWebhookListResponse = z.infer<typeof ConnectWebhookListResponseSchema>;

/** Delivered webhook envelope (documents the payload third parties receive). */
export const ConnectWebhookDeliveryPayloadSchema = z.object({
  webhook_id: z.string().uuid(),
  event: ConnectWebhookEventSchema,
  timestamp: z.string().datetime(),
  data: z.object({
    job_id: z.string().uuid(),
    workspace_id: z.string().uuid(),
    status: ConnectIngestJobStatusSchema,
    quality_report: ConnectIngestQualityReportSchema.nullable().optional(),
  }),
});

export type ConnectWebhookDeliveryPayload = z.infer<typeof ConnectWebhookDeliveryPayloadSchema>;

// ─── Domain Pack (domain-agnostic ingestion configuration) ───────────────────
//
// A Domain Pack is the customisable layer that lets the ingestion pipeline work
// for ANY corpus, not just the philosophy domain it was first built for in SOPHIA.
// It captures everything that was previously hardcoded: the ontology (taxonomy,
// unit/relation/role vocabulary), per-stage prompt overrides, the graph schema
// (table/edge names), passage segmentation heuristics, optional entity linking,
// and the embedding contract. Core pipeline mechanics (job/run orchestration,
// stage machine, checkpoints, routing) stay generic and consume a pack.

/** Vocabulary for the knowledge graph the pipeline builds. */
export const ConnectOntologySchema = z.object({
  /** Noun for an atomic extracted unit (SOPHIA: "claim"). */
  unit_noun: z.string().min(1).max(40).default('claim'),
  /** Noun for a named group of units (SOPHIA: "argument"). */
  group_noun: z.string().min(1).max(40).default('group'),
  /** Taxonomy slugs for classifying units (SOPHIA: 21 philosophy domains). Empty = no classification. */
  domains: z.array(z.string().min(1).max(60)).max(200).default([]),
  /** Unit type enum (SOPHIA: thesis, objection, thought_experiment, …). */
  unit_types: z.array(z.string().min(1).max(60)).max(100).default([]),
  /** Relation edge types between units (SOPHIA: supports, contradicts, depends_on, …). */
  relation_types: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        description: z.string().max(280).optional()
      })
    )
    .max(100)
    .default([]),
  /** Roles a unit can play within a group (SOPHIA: conclusion, key_premise, objection, …). */
  group_roles: z.array(z.string().min(1).max(60)).max(100).default([]),
  /**
   * Allowed relationship triplets that ground extraction (Neo4j-style patterns):
   * which unit types may connect via which relation. Empty = any unit may relate
   * via any relation_type. Capturing relationships — not just text — is what makes
   * a graph (the philosophy lesson: ideas connect, they aren't isolated chunks).
   */
  relationship_patterns: z
    .array(
      z.object({
        from_unit_type: z.string().min(1).max(60),
        relation: z.string().min(1).max(60),
        to_unit_type: z.string().min(1).max(60)
      })
    )
    .max(300)
    .default([]),
  /**
   * How strictly to ground extraction to the declared ontology:
   * - strict: only declared types/relations/patterns
   * - guided: prefer declared types but allow well-justified additions
   * - open: discover types from the corpus (GraphRAG-style)
   */
  schema_mode: z.enum(['strict', 'guided', 'open']).default('guided')
});

export type ConnectOntology = z.infer<typeof ConnectOntologySchema>;

/** Structure-aware chunking that preserves complete units (vs naive fixed-size). */
export const ConnectChunkingProfileSchema = z.object({
  strategy: z.enum(['recursive', 'structure_aware', 'semantic', 'fixed']).default('structure_aware'),
  min_chars: z.number().int().positive().max(20000).default(400),
  max_chars: z.number().int().positive().max(40000).default(4000),
  overlap_chars: z.number().int().nonnegative().max(4000).default(0)
});

export type ConnectChunkingProfile = z.infer<typeof ConnectChunkingProfileSchema>;

/** Pluggable document parser selection (builtin OSS default; managed opt-in). */
export const ConnectParserProfileSchema = z.object({
  provider: z.enum(['builtin', 'llamaparse', 'unstructured']).default('builtin'),
  /** Provider-specific, non-secret options. */
  options: z.record(z.string(), z.unknown()).optional()
});

export type ConnectParserProfile = z.infer<typeof ConnectParserProfileSchema>;

/**
 * Per-stage system prompt overrides. When omitted, the pipeline composes a
 * generic prompt from the ontology (unit/relation/role nouns + taxonomy).
 * Authors may use `{unit_noun}`, `{group_noun}`, `{domains}`, `{unit_types}`,
 * `{relation_types}`, `{group_roles}` placeholders.
 */
export const ConnectStagePromptsSchema = z.object({
  extraction: z.string().max(8000).optional(),
  relations: z.string().max(8000).optional(),
  grouping: z.string().max(8000).optional(),
  validation: z.string().max(8000).optional(),
  remediation: z.string().max(8000).optional()
});

export type ConnectStagePrompts = z.infer<typeof ConnectStagePromptsSchema>;

/** Names of tables/edges the `storing` stage writes to in the graph store. */
export const ConnectGraphSchemaMapSchema = z.object({
  source_table: z.string().min(1).max(60).default('source'),
  passage_table: z.string().min(1).max(60).default('passage'),
  unit_table: z.string().min(1).max(60).default('claim'),
  group_table: z.string().min(1).max(60).default('argument'),
  /** Edge linking a unit to a group, carrying a role. */
  part_of_edge: z.string().min(1).max(60).default('part_of'),
  /** Relation edge table names (must align with ontology.relation_types). */
  relation_edges: z.array(z.string().min(1).max(60)).max(100).default([]),
  /**
   * Field on the unit table holding the embedding vector. Configurable so a
   * Bring-Your-Own graph that stored vectors under a different name (e.g. `vector`)
   * is recognised for stats, re-embed, and dense retrieval. Auto-detected on import.
   */
  unit_vector_field: z.string().min(1).max(60).default('embedding'),
  /** Optional inline field on the source table holding full document text. */
  source_text_field: z.string().min(1).max(60).optional(),
  /** Field on the passage table holding passage/chunk text (default `text`). */
  passage_text_field: z.string().min(1).max(60).optional(),
  /** Field on the passage table linking to a source record (default `source`). */
  passage_source_field: z.string().min(1).max(60).optional()
});

export type ConnectGraphSchemaMap = z.infer<typeof ConnectGraphSchemaMapSchema>;

/** Passage segmentation heuristics (SOPHIA: argumentative lexicon). */
export const ConnectPassageProfileSchema = z.object({
  /** Marker phrases that flag salient passages; empty = segment by size only. */
  marker_lexicon: z.array(z.string().min(1).max(80)).max(200).default([]),
  min_passage_chars: z.number().int().positive().max(20000).default(400),
  max_passage_chars: z.number().int().positive().max(40000).default(6000)
});

export type ConnectPassageProfile = z.infer<typeof ConnectPassageProfileSchema>;

/** Optional entity-identity linking (SOPHIA: thinker → Wikidata). */
export const ConnectEntityLinkingSchema = z.object({
  enabled: z.boolean().default(false),
  /** Graph table holding canonical entities (SOPHIA: thinker). */
  entity_table: z.string().min(1).max(60).optional(),
  /** Edge from entity to source (SOPHIA: authored). */
  source_edge: z.string().min(1).max(60).optional(),
  /** External identity provider hint (SOPHIA: wikidata). */
  external_id_provider: z.string().min(1).max(60).optional()
});

export type ConnectEntityLinking = z.infer<typeof ConnectEntityLinkingSchema>;

export const ConnectEmbeddingContractSchema = z.object({
  model: z.string().min(1).max(120).default('voyage-3'),
  dimensions: z.number().int().positive().max(8192).default(1024)
});

export type ConnectEmbeddingContract = z.infer<typeof ConnectEmbeddingContractSchema>;

/** Production is default; starter is explicit demo opt-down. */
export const ConnectQualityPresetSchema = z.enum(['production', 'starter']).default('production');

export type ConnectQualityPreset = z.infer<typeof ConnectQualityPresetSchema>;

/** Use-case archetype for default stage prompt templates (connect-core composer). */
export const ConnectPackArchetypeSchema = z.enum([
  'argumentative',
  'factual',
  'procedural',
  'product_docs',
  'generic'
]);

export type ConnectPackArchetype = z.infer<typeof ConnectPackArchetypeSchema>;

/** A reusable, domain-agnostic ingestion configuration. */
export const ConnectDomainPackSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must be kebab-case'),
  title: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  quality_preset: ConnectQualityPresetSchema.default('production'),
  /** When true, validation route should use a different provider/model than extraction. */
  cross_model_validation: z.boolean().default(true),
  /** Drives default stage prompts when prompts.* are empty. Inferred from slug when omitted. */
  archetype: ConnectPackArchetypeSchema.optional(),
  /** Bumped when automated feedback loop ships template calibration (G7). */
  prompt_template_version: z.number().int().positive().optional(),
  ontology: ConnectOntologySchema,
  prompts: ConnectStagePromptsSchema.default({}),
  graph_schema: ConnectGraphSchemaMapSchema,
  passage_profile: ConnectPassageProfileSchema,
  chunking: ConnectChunkingProfileSchema.optional(),
  parser: ConnectParserProfileSchema.optional(),
  entity_linking: ConnectEntityLinkingSchema.optional(),
  embedding: ConnectEmbeddingContractSchema,
  /**
   * Optional verification rule-set override (Stage 4C). Reference a named rule set by id, or
   * supply inline dimension-weight overrides. Omitted ⇒ the built-in "Restormel Core v1" applies.
   */
  verification_rules: DomainPackVerificationRulesSchema.optional(),
  is_builtin: z.boolean().default(false),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ConnectDomainPack = z.infer<typeof ConnectDomainPackSchema>;

export const ConnectDomainPackUpsertSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'slug must be kebab-case'),
  title: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  quality_preset: ConnectQualityPresetSchema.optional(),
  cross_model_validation: z.boolean().optional(),
  archetype: ConnectPackArchetypeSchema.optional(),
  prompt_template_version: z.number().int().positive().optional(),
  ontology: ConnectOntologySchema,
  prompts: ConnectStagePromptsSchema.optional(),
  graph_schema: ConnectGraphSchemaMapSchema,
  passage_profile: ConnectPassageProfileSchema,
  chunking: ConnectChunkingProfileSchema.optional(),
  parser: ConnectParserProfileSchema.optional(),
  entity_linking: ConnectEntityLinkingSchema.optional(),
  embedding: ConnectEmbeddingContractSchema
});

export type ConnectDomainPackUpsert = z.infer<typeof ConnectDomainPackUpsertSchema>;

/**
 * Domain-neutral default pack. No taxonomy assumptions, generic relation set,
 * generic graph schema. A new tenant can ingest any corpus with this and refine.
 */
export const DEFAULT_GENERIC_DOMAIN_PACK: ConnectDomainPackUpsert = {
  slug: 'generic',
  title: 'Generic knowledge',
  description:
    'Domain-neutral starting point: extract atomic statements, relate them, group into topics, embed, and store. Customise the ontology and prompts for your corpus.',
  ontology: {
    unit_noun: 'statement',
    group_noun: 'topic',
    domains: [],
    unit_types: ['assertion', 'definition', 'example', 'question'],
    relation_types: [
      { name: 'supports', description: 'A backs or provides evidence for B' },
      { name: 'contradicts', description: 'A conflicts with B' },
      { name: 'depends_on', description: 'A presupposes B' },
      { name: 'relates_to', description: 'A is topically related to B' }
    ],
    group_roles: ['summary', 'key_point', 'supporting_detail', 'caveat'],
    relationship_patterns: [],
    schema_mode: 'guided'
  },
  archetype: 'generic',
  prompts: {
    extraction:
      'You build a knowledge graph from text for "{pack_title}". Extract atomic {unit_noun}s — each a complete idea — and identify how they relate.',
    validation:
      'You validate extracted {unit_noun}s for "{pack_title}". Catch hallucinations and serious misreadings — not faithful paraphrases.',
    remediation:
      'Repair {unit_noun}s flagged as weak or unsupported for "{pack_title}", or drop those that cannot be supported.',
    grouping:
      'Group related {unit_noun}s into {group_noun}s for "{pack_title}". Each group is a coherent whole, not an arbitrary bucket.'
  },
  graph_schema: {
    source_table: 'source',
    passage_table: 'passage',
    unit_table: 'statement',
    group_table: 'topic',
    part_of_edge: 'part_of',
    relation_edges: ['supports', 'contradicts', 'depends_on', 'relates_to'],
    unit_vector_field: 'embedding'
  },
  passage_profile: {
    marker_lexicon: [],
    min_passage_chars: 400,
    max_passage_chars: 6000
  },
  embedding: { model: 'voyage-3', dimensions: 1024 },
  quality_preset: 'production',
  cross_model_validation: true,
  prompt_template_version: 1
};

/**
 * Philosophy pack mirroring SOPHIA's hardcoded vocabulary — shipped as an example
 * of how a fully-specified domain looks. The pipeline core treats it as data.
 */
export const PHILOSOPHY_DOMAIN_PACK: ConnectDomainPackUpsert = {
  slug: 'philosophy',
  title: 'Philosophy (SOPHIA parity)',
  description:
    'Argument-mining ontology extracted from SOPHIA: philosophical claims, argument structures, and discourse relations.',
  ontology: {
    unit_noun: 'claim',
    group_noun: 'argument',
    domains: [
      'aesthetics',
      'applied_ethics',
      'epistemology',
      'ethics',
      'logic',
      'metaphysics',
      'philosophy_of_language',
      'philosophy_of_mind',
      'philosophy_of_science',
      'political_philosophy'
    ],
    unit_types: ['thesis', 'objection', 'reply', 'thought_experiment', 'definition', 'premise', 'conclusion'],
    relation_types: [
      { name: 'supports', description: 'Claim A supports claim B' },
      { name: 'contradicts', description: 'Claim A contradicts claim B' },
      { name: 'depends_on', description: 'Claim A depends on claim B' },
      { name: 'responds_to', description: 'Claim A responds to claim B' },
      { name: 'defines', description: 'Claim A defines a term in claim B' },
      { name: 'qualifies', description: 'Claim A qualifies claim B' }
    ],
    group_roles: ['conclusion', 'key_premise', 'premise', 'objection', 'reply'],
    relationship_patterns: [
      { from_unit_type: 'premise', relation: 'supports', to_unit_type: 'conclusion' },
      { from_unit_type: 'objection', relation: 'contradicts', to_unit_type: 'thesis' },
      { from_unit_type: 'reply', relation: 'responds_to', to_unit_type: 'objection' }
    ],
    schema_mode: 'guided'
  },
  archetype: 'argumentative',
  prompts: {
    extraction:
      'You build a knowledge graph from argumentative discourse for "{pack_title}". Extract complete {unit_noun}s (premises, conclusions, objections) and discourse relations — not isolated fragments.',
    relations:
      'Identify discourse relations between {unit_noun}s in argumentative text for "{pack_title}". Focus on supports, contradicts, responds_to, and qualifies.',
    validation:
      'Validate extracted {unit_noun}s from argumentative sources for "{pack_title}". Flag only clear hallucinations — faithful paraphrase of premises and conclusions is "ok".',
    remediation:
      'Repair weak {unit_noun}s from argumentative text for "{pack_title}" so they remain faithful to the source, or drop unsupported ones.',
    grouping:
      'Group related {unit_noun}s into coherent {group_noun}s (e.g. a complete argument) for "{pack_title}".'
  },
  graph_schema: {
    source_table: 'source',
    passage_table: 'passage',
    unit_table: 'claim',
    group_table: 'argument',
    part_of_edge: 'part_of',
    relation_edges: ['supports', 'contradicts', 'depends_on', 'responds_to', 'defines', 'qualifies'],
    unit_vector_field: 'embedding'
  },
  passage_profile: {
    marker_lexicon: ['therefore', 'however', 'objection', 'counterargument', 'it follows that', 'suppose that'],
    min_passage_chars: 400,
    max_passage_chars: 6000
  },
  entity_linking: {
    enabled: true,
    entity_table: 'thinker',
    source_edge: 'authored',
    external_id_provider: 'wikidata'
  },
  embedding: { model: 'voyage-3', dimensions: 1024 },
  quality_preset: 'production',
  cross_model_validation: true,
  prompt_template_version: 1
};

// ─── Graph store target (Bring-Your-Own store) ───────────────────────────────

export const ConnectGraphProviderSchema = z.enum(['surreal', 'postgres']);
export type ConnectGraphProvider = z.infer<typeof ConnectGraphProviderSchema>;

export const ConnectGraphTargetStatusSchema = z.enum(['untested', 'ok', 'error']);
export type ConnectGraphTargetStatus = z.infer<typeof ConnectGraphTargetStatusSchema>;

/**
 * Non-secret connection fields surfaced to the operator UI. All optional because
 * the one-click Postgres option reuses the dashboard's own Neon connection and
 * carries no connection fields at all.
 */
export const ConnectGraphConnectionPublicSchema = z.object({
  endpoint: z.string().max(500).optional(),
  namespace: z.string().max(120).optional(),
  database: z.string().max(120).optional(),
  username: z.string().max(120).optional()
});

export type ConnectGraphConnectionPublic = z.infer<typeof ConnectGraphConnectionPublicSchema>;

/**
 * Per-graph bundle: settings that switch in lockstep with the active graph so an
 * operator can move between graph stores without re-entering anything. The domain
 * pack carries the graph's schema/ontology; the rest restores the last run setup.
 */
export const ConnectGraphBundleSchema = z.object({
  /** Domain pack (schema/ontology/table mapping) used for this graph's ingest + retrieval. */
  default_domain_pack_id: z.string().uuid().optional(),
  /** Source documents selected for this graph's next ingest run (null/absent = all parsed). */
  ingest_document_ids: z.array(z.string()).optional(),
  /** Pipeline stage to stop after for this graph's runs. */
  default_stop_after_stage: ConnectIngestStageSchema.optional(),
  /**
   * Stage 3.2b: whether Restormel may create a `restormel_claim_versions` table in
   * this BYO Surreal database to enable incremental re-ingest with version chains.
   *
   * OFF (default): re-ingests degrade to full ingest with an explicit operator log;
   * no Restormel-owned tables are created in the user's database.
   *
   * ON: Restormel creates `restormel_claim_versions` (additive-only, clearly named)
   * and carries/changed/removed semantics match the Postgres spine path. If table
   * creation fails (permissions), the run degrades to the OFF path with an
   * operator-visible warning — never blocks, never silently pretends versions exist.
   *
   * Only meaningful for Surreal BYO stores; ignored for Postgres spine targets.
   */
  allow_claim_versions_table: z.boolean().default(false)
});

export type ConnectGraphBundle = z.infer<typeof ConnectGraphBundleSchema>;

/** Graph target as returned to the UI — never includes the secret. */
export const ConnectGraphTargetSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  /** Friendly name for the saved graph (Graph Library card title). */
  label: z.string().max(120).optional(),
  /** True when this is the workspace's active graph (drives retrieval/ingest/MCP). */
  is_active: z.boolean().default(false),
  provider: ConnectGraphProviderSchema,
  connection: ConnectGraphConnectionPublicSchema,
  /** Postgres only: reuse the dashboard's Neon connection (one-click, zero credentials). */
  use_dashboard_database: z.boolean().default(false),
  /** True when an encrypted secret (password/token) is stored. */
  secret_set: z.boolean(),
  /** Per-graph settings that travel with this graph when it is activated. */
  bundle: ConnectGraphBundleSchema.default({ allow_claim_versions_table: false }),
  status: ConnectGraphTargetStatusSchema,
  last_tested_at: z.string().datetime().optional(),
  last_error: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ConnectGraphTarget = z.infer<typeof ConnectGraphTargetSchema>;

/**
 * Upsert payload — includes the secret (write-only; never echoed back). Used for
 * both creating a new Graph Library entry and editing an existing one (by id).
 */
export const ConnectGraphTargetUpsertSchema = z.object({
  /** Friendly name for the saved graph. Defaults to namespace/database when omitted. */
  label: z.string().min(1).max(120).optional(),
  provider: ConnectGraphProviderSchema.default('surreal'),
  endpoint: z.string().url().max(500),
  namespace: z.string().min(1).max(120),
  database: z.string().min(1).max(120),
  username: z.string().min(1).max(120).optional(),
  /** Password/token; encrypted at rest. Omit to keep the existing secret. */
  secret: z.string().min(1).max(2000).optional(),
  /** Domain pack to bundle with this graph. */
  default_domain_pack_id: z.string().uuid().optional(),
  /** Stage 3.2b: allow Restormel to manage restormel_claim_versions in this Surreal DB. */
  allow_claim_versions_table: z.boolean().optional()
});

export type ConnectGraphTargetUpsert = z.infer<typeof ConnectGraphTargetUpsertSchema>;

// ─── Pipeline profile (saved configuration: pack + target + defaults) ─────────

export const ConnectPipelineProfileSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  title: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  domain_pack_id: z.string().uuid(),
  graph_target_id: z.string().uuid().optional(),
  default_stop_after_stage: ConnectIngestStageSchema.optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ConnectPipelineProfile = z.infer<typeof ConnectPipelineProfileSchema>;

export const ConnectPipelineProfileUpsertSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(600).optional(),
  domain_pack_id: z.string().uuid(),
  graph_target_id: z.string().uuid().optional(),
  default_stop_after_stage: ConnectIngestStageSchema.optional()
});

export type ConnectPipelineProfileUpsert = z.infer<typeof ConnectPipelineProfileUpsertSchema>;
