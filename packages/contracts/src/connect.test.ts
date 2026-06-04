import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GENERIC_DOMAIN_PACK,
  CONNECT_API_CONTRACT_VERSION,
  ConnectDomainPackUpsertSchema,
  ConnectGraphTargetSchema,
  ConnectGraphTargetUpsertSchema,
  ConnectGraphRevalidateRequestSchema,
  ConnectIngestJobCreateRequestSchema,
  ConnectPipelineProfileUpsertSchema,
  ConnectRetrieveRequestSchema,
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
});
