/**
 * Restormel Connect — public REST API contracts (Phase 0 draft).
 * Canonical programme: docs/restormel/SUITE-ARCHITECTURE-MIGRATION.md
 * OpenAPI mirror: docs/api/openapi-suite-v1-draft.yaml
 */
import { z } from 'zod';
import { VerificationRequestSchema } from './verification.js';

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

export const ConnectRetrieveRequestSchema = ConnectWorkspaceContextSchema.extend({
  contract_version: ConnectApiContractVersionSchema.optional(),
  query: z.string().min(1),
  depth: ConnectRetrieveDepthSchema.optional(),
  domain_hint: z.string().min(1).optional(),
  max_claims: z.number().int().positive().max(500).optional(),
  require_verified: z.boolean().optional()
});

export type ConnectRetrieveRequest = z.infer<typeof ConnectRetrieveRequestSchema>;

export const ConnectRetrieveResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  request_id: z.string().min(1),
  context_block: z.string(),
  metadata: z.object({
    claims_retrieved: z.number().int().nonnegative(),
    arguments_retrieved: z.number().int().nonnegative(),
    retrieval_degraded: z.boolean().optional(),
    retrieval_degraded_reason: z.string().optional(),
    detected_domain: z.string().optional(),
    domain_confidence: z.enum(['high', 'medium', 'low']).optional()
  })
});

export type ConnectRetrieveResponse = z.infer<typeof ConnectRetrieveResponseSchema>;

// ─── Ingest (Connect Ingest sub-product) ───────────────────────────────────

export const ConnectIngestSourceSchema = z.object({
  url: z.string().url().optional(),
  text: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  content_type: z.enum(['url', 'text', 'file_ref']).optional()
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
export const ConnectGraphRevalidateScopeSchema = z.enum(['all', 'unchecked', 'flagged']);
export type ConnectGraphRevalidateScope = z.infer<typeof ConnectGraphRevalidateScopeSchema>;

export const ConnectGraphRevalidateRequestSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  /** Keys ingestion route id for the validation stage (overrides workspace default). */
  validation_route_id: z.string().uuid().optional(),
  domain_pack_id: z.string().uuid().optional(),
  scope: ConnectGraphRevalidateScopeSchema.default('unchecked'),
  project_id: z.string().uuid().optional()
});
export type ConnectGraphRevalidateRequest = z.infer<typeof ConnectGraphRevalidateRequestSchema>;

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
    content_encoding: z.enum(['utf8', 'base64']).default('utf8')
  })
  .refine((v) => (v.kind === 'url' ? Boolean(v.url) : Boolean(v.content)), {
    message: 'url is required for kind=url; content is required for kind=upload.'
  });

export type ConnectSourceDocumentCreate = z.infer<typeof ConnectSourceDocumentCreateSchema>;

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
  error: z.string().optional()
});

export type ConnectIngestJob = z.infer<typeof ConnectIngestJobSchema>;

export const ConnectIngestJobCreateResponseSchema = z.object({
  contract_version: ConnectApiContractVersionSchema,
  job: ConnectIngestJobSchema
});

export type ConnectIngestJobCreateResponse = z.infer<typeof ConnectIngestJobCreateResponseSchema>;

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
  relation_edges: z.array(z.string().min(1).max(60)).max(100).default([])
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
  ontology: ConnectOntologySchema,
  prompts: ConnectStagePromptsSchema.default({}),
  graph_schema: ConnectGraphSchemaMapSchema,
  passage_profile: ConnectPassageProfileSchema,
  chunking: ConnectChunkingProfileSchema.optional(),
  parser: ConnectParserProfileSchema.optional(),
  entity_linking: ConnectEntityLinkingSchema.optional(),
  embedding: ConnectEmbeddingContractSchema,
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
  prompts: {},
  graph_schema: {
    source_table: 'source',
    passage_table: 'passage',
    unit_table: 'statement',
    group_table: 'topic',
    part_of_edge: 'part_of',
    relation_edges: ['supports', 'contradicts', 'depends_on', 'relates_to']
  },
  passage_profile: {
    marker_lexicon: [],
    min_passage_chars: 400,
    max_passage_chars: 6000
  },
  embedding: { model: 'voyage-3', dimensions: 1024 }
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
  prompts: {},
  graph_schema: {
    source_table: 'source',
    passage_table: 'passage',
    unit_table: 'claim',
    group_table: 'argument',
    part_of_edge: 'part_of',
    relation_edges: ['supports', 'contradicts', 'depends_on', 'responds_to', 'defines', 'qualifies']
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
  embedding: { model: 'voyage-3', dimensions: 1024 }
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

/** Graph target as returned to the UI — never includes the secret. */
export const ConnectGraphTargetSchema = z.object({
  id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  provider: ConnectGraphProviderSchema,
  connection: ConnectGraphConnectionPublicSchema,
  /** Postgres only: reuse the dashboard's Neon connection (one-click, zero credentials). */
  use_dashboard_database: z.boolean().default(false),
  /** True when an encrypted secret (password/token) is stored. */
  secret_set: z.boolean(),
  status: ConnectGraphTargetStatusSchema,
  last_tested_at: z.string().datetime().optional(),
  last_error: z.string().optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime()
});

export type ConnectGraphTarget = z.infer<typeof ConnectGraphTargetSchema>;

/** Upsert payload — includes the secret (write-only; never echoed back). */
export const ConnectGraphTargetUpsertSchema = z.object({
  provider: ConnectGraphProviderSchema.default('surreal'),
  endpoint: z.string().url().max(500),
  namespace: z.string().min(1).max(120),
  database: z.string().min(1).max(120),
  username: z.string().min(1).max(120).optional(),
  /** Password/token; encrypted at rest. Omit to keep the existing secret. */
  secret: z.string().min(1).max(2000).optional()
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
