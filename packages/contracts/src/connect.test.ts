import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GENERIC_DOMAIN_PACK,
  CONNECT_API_CONTRACT_VERSION,
  ConnectDomainPackUpsertSchema,
  ConnectGraphTargetSchema,
  ConnectGraphTargetUpsertSchema,
  ConnectGraphLinkSourcesRequestSchema,
  ConnectGraphRevalidateRequestSchema,
  ConnectIngestJobCreateRequestSchema,
  ConnectIngestJobSchema,
  ConnectIngestQualityReportSchema,
  ConnectIngestJobLogsResponseSchema,
  ConnectWebhookCreateRequestSchema,
  ConnectWebhookCreateResponseSchema,
  ConnectPipelineProfileUpsertSchema,
  ConnectRetrieveRequestSchema,
  ConnectRetrieveResponseSchema,
  ConnectVerifyRequestSchema,
  PHILOSOPHY_DOMAIN_PACK
} from './connect.js';

describe('@restormel/contracts/connect', () => {
  const workspaceId = '11111111-1111-4111-8111-111111111111';

  it('parses Connect verify request envelope', () => {
    const parsed = ConnectVerifyRequestSchema.parse({
      workspace_id: workspaceId,
      verify: { text: 'All knowledge begins with doubt.' }
    });
    expect(parsed.verify.text).toContain('doubt');
  });

  it('parses Connect retrieve request envelope', () => {
    const parsed = ConnectRetrieveRequestSchema.parse({
      workspace_id: workspaceId,
      query: 'What is public reason?',
      depth: 'standard'
    });
    expect(parsed.depth).toBe('standard');
  });

  it('parses as_of + include_superseded on the retrieve request (Stage 3.3, additive)', () => {
    const parsed = ConnectRetrieveRequestSchema.parse({
      workspace_id: workspaceId,
      query: 'What is public reason?',
      as_of: '2026-06-01T12:00:00.000Z',
      include_superseded: true
    });
    expect(parsed.as_of).toBe('2026-06-01T12:00:00.000Z');
    expect(parsed.include_superseded).toBe(true);
    // Honest input validation: as_of must be a real ISO 8601 instant.
    expect(() =>
      ConnectRetrieveRequestSchema.parse({
        workspace_id: workspaceId,
        query: 'q',
        as_of: 'yesterday'
      })
    ).toThrow();
  });

  it('parses temporal metadata on the retrieve response, including the explicit degrade', () => {
    const base = {
      contract_version: CONNECT_API_CONTRACT_VERSION,
      request_id: 'req-1',
      context_block: '',
      metadata: {
        claims_retrieved: 1,
        arguments_retrieved: 0,
        temporal: {
          as_of: '2026-06-01T12:00:00.000Z',
          applied: true,
          include_superseded: false,
          excluded_claims: 1,
          substituted_claims: 1,
          superseded_claims_returned: 0,
          unversioned_claims: 2
        }
      }
    };
    expect(() => ConnectRetrieveResponseSchema.parse(base)).not.toThrow();
    expect(() =>
      ConnectRetrieveResponseSchema.parse({
        ...base,
        metadata: {
          claims_retrieved: 1,
          arguments_retrieved: 0,
          temporal: {
            as_of: '2026-06-01T12:00:00.000Z',
            applied: false,
            include_superseded: false,
            degraded_reason: 'surreal_version_chains_unavailable'
          }
        }
      })
    ).not.toThrow();
  });

  it('parses Connect retrieve response with context_pack and graph', () => {
    const parsed = ConnectRetrieveResponseSchema.parse({
      contract_version: CONNECT_API_CONTRACT_VERSION,
      request_id: 'req-1',
      context_block: '=== CONTEXT ===',
      context_pack: {
        analysis: {
          block: 'analysis block',
          stats: {
            token_budget: 900,
            estimated_tokens: 100,
            truncated: false,
            claim_count: 2,
            relation_count: 1,
            argument_count: 0
          }
        },
        critique: {
          block: 'critique',
          stats: {
            token_budget: 860,
            estimated_tokens: 80,
            truncated: false,
            claim_count: 1,
            relation_count: 0,
            argument_count: 0
          }
        },
        synthesis: {
          block: 'synthesis',
          stats: {
            token_budget: 1040,
            estimated_tokens: 120,
            truncated: false,
            claim_count: 2,
            relation_count: 1,
            argument_count: 0
          }
        }
      },
      graph: {
        claims: [
          {
            id: 'claim:1',
            text: 'Virtue is a mean.',
            claim_type: 'premise',
            domain: 'ethics',
            source_title: 'Nicomachean Ethics',
            confidence: 0.9
          }
        ],
        relations: [],
        arguments: [],
        seed_claim_ids: ['claim:1']
      },
      metadata: {
        claims_retrieved: 1,
        arguments_retrieved: 0,
        retrieval_degraded: false
      }
    });
    expect(parsed.graph?.claims).toHaveLength(1);
  });

  it('parses graph re-validation request with default scope', () => {
    const parsed = ConnectGraphRevalidateRequestSchema.parse({ scope: 'unchecked' });
    expect(parsed.scope).toBe('unchecked');
  });

  it('parses graph re-validation request with optional route override', () => {
    const routeId = '22222222-2222-4222-8222-222222222222';
    const parsed = ConnectGraphRevalidateRequestSchema.parse({
      scope: 'flagged',
      validation_route_id: routeId
    });
    expect(parsed.validation_route_id).toBe(routeId);
  });

  it('parses auto-remediation scopes', () => {
    expect(
      ConnectGraphRevalidateRequestSchema.parse({
        scope: 'quarantine',
        mode: 'validate_and_remediate'
      }).scope
    ).toBe('quarantine');
    expect(
      ConnectGraphRevalidateRequestSchema.parse({
        scope: 'unsupported',
        mode: 'validate_and_remediate'
      }).scope
    ).toBe('unsupported');
  });

  it('parses graph source-link request with default scope', () => {
    const parsed = ConnectGraphLinkSourcesRequestSchema.parse({});
    expect(parsed.scope).toBe('unlinked_only');
  });

  it('parses Connect ingest job create request', () => {
    const parsed = ConnectIngestJobCreateRequestSchema.parse({
      workspace_id: workspaceId,
      sources: [{ url: 'https://example.com/article', title: 'Example' }],
      label: 'wave-1-smoke'
    });
    expect(parsed.sources).toHaveLength(1);
    expect(CONNECT_API_CONTRACT_VERSION).toBe('2026-06-01');
  });

  it('rejects ingest job with empty sources', () => {
    expect(() =>
      ConnectIngestJobCreateRequestSchema.parse({
        workspace_id: workspaceId,
        sources: []
      })
    ).toThrow();
  });

  it('built-in domain packs validate as upserts (domain-agnostic config)', () => {
    expect(() => ConnectDomainPackUpsertSchema.parse(DEFAULT_GENERIC_DOMAIN_PACK)).not.toThrow();
    expect(() => ConnectDomainPackUpsertSchema.parse(PHILOSOPHY_DOMAIN_PACK)).not.toThrow();
    expect(DEFAULT_GENERIC_DOMAIN_PACK.ontology.unit_noun).toBe('statement');
    expect(PHILOSOPHY_DOMAIN_PACK.ontology.unit_noun).toBe('claim');
  });

  it('rejects a custom domain pack with a non-kebab slug', () => {
    expect(() =>
      ConnectDomainPackUpsertSchema.parse({ ...DEFAULT_GENERIC_DOMAIN_PACK, slug: 'Not Kebab' })
    ).toThrow();
  });

  it('parses a graph target upsert and treats the secret as write-only', () => {
    const parsed = ConnectGraphTargetUpsertSchema.parse({
      provider: 'surreal',
      endpoint: 'https://surreal.example.com:8000',
      namespace: 'restormel',
      database: 'knowledge',
      username: 'ingest',
      secret: 'super-secret-token'
    });
    expect(parsed.provider).toBe('surreal');
    expect(parsed.secret).toBe('super-secret-token');
  });

  it('accepts a one-click Postgres (dashboard Neon) target with no connection fields', () => {
    const parsed = ConnectGraphTargetSchema.parse({
      id: workspaceId,
      workspace_id: workspaceId,
      provider: 'postgres',
      connection: {},
      use_dashboard_database: true,
      secret_set: false,
      status: 'ok',
      created_at: '2026-06-02T12:00:00.000Z',
      updated_at: '2026-06-02T12:00:00.000Z'
    });
    expect(parsed.provider).toBe('postgres');
    expect(parsed.use_dashboard_database).toBe(true);
  });

  it('parses a pipeline profile upsert', () => {
    const parsed = ConnectPipelineProfileUpsertSchema.parse({
      title: 'Docs ingestion',
      domain_pack_id: workspaceId,
      default_stop_after_stage: 'extracting'
    });
    expect(parsed.default_stop_after_stage).toBe('extracting');
  });

  it('accepts an ingest job with a curated quality_report (C2)', () => {
    const report = {
      trust_score: 82,
      supported_count: 40,
      weak_count: 5,
      unsupported_count: 2,
      total_count: 47,
      remediation_applied: true,
      assessed_at: '2026-06-07T10:00:00.000Z'
    };
    expect(ConnectIngestQualityReportSchema.parse(report).trust_score).toBe(82);
    const job = ConnectIngestJobSchema.parse({
      id: workspaceId,
      workspace_id: workspaceId,
      status: 'completed',
      created_at: '2026-06-07T09:00:00.000Z',
      updated_at: '2026-06-07T10:00:00.000Z',
      quality_report: report
    });
    expect(job.quality_report?.supported_count).toBe(40);
  });

  it('allows quality_report to be null', () => {
    const job = ConnectIngestJobSchema.parse({
      id: workspaceId,
      workspace_id: workspaceId,
      status: 'running',
      created_at: '2026-06-07T09:00:00.000Z',
      updated_at: '2026-06-07T09:30:00.000Z',
      quality_report: null
    });
    expect(job.quality_report).toBeNull();
  });

  it('parses a live log streaming response (I11)', () => {
    const parsed = ConnectIngestJobLogsResponseSchema.parse({
      contract_version: CONNECT_API_CONTRACT_VERSION,
      job_id: workspaceId,
      log_lines: [
        { index: 12, timestamp: '2026-06-07T10:00:00.000Z', stage: 'EXTRACT', level: 'info', message: 'Extracting graph units' },
        { index: 13, timestamp: '2026-06-07T10:00:01.000Z', stage: 'FATAL', level: 'error', message: 'boom' }
      ],
      next_since: 13,
      total: 13
    });
    expect(parsed.log_lines).toHaveLength(2);
    expect(parsed.next_since).toBe(13);
  });

  it('parses a webhook registration request and response (I1)', () => {
    const req = ConnectWebhookCreateRequestSchema.parse({
      workspace_id: workspaceId,
      url: 'https://example.com/hook',
      events: ['job.completed', 'job.quality_below_threshold'],
      quality_threshold: 75
    });
    expect(req.events).toContain('job.quality_below_threshold');

    const res = ConnectWebhookCreateResponseSchema.parse({
      webhook_id: workspaceId,
      workspace_id: workspaceId,
      url: 'https://example.com/hook',
      events: ['job.completed'],
      active: true,
      created_at: '2026-06-07T10:00:00.000Z',
      signing_secret: 'whsec_abcdef0123456789'
    });
    expect(res.signing_secret).toMatch(/^whsec_/);
  });

  it('rejects a webhook request with an unknown event', () => {
    const bad = ConnectWebhookCreateRequestSchema.safeParse({
      workspace_id: workspaceId,
      url: 'https://example.com/hook',
      events: ['job.exploded']
    });
    expect(bad.success).toBe(false);
  });
});
