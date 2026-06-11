import { describe, it, expect } from 'vitest';
import {
  TestingVerdictIngestSchema,
  TestingVerdictEntrySchema,
  TestingVerdictHistoryResponseSchema,
  TESTING_VERDICT_SCHEMA_VERSION,
} from './testing-verdict.js';

describe('TestingVerdictIngestSchema', () => {
  const minimalValid = {
    schema_version: TESTING_VERDICT_SCHEMA_VERSION,
    suite_id: 'my-suite',
    evaluated_at: '2026-06-11T10:00:00Z',
    pass: true,
    reasons: [],
    source: 'ci_action' as const,
  };

  it('accepts a minimal valid payload', () => {
    const result = TestingVerdictIngestSchema.safeParse(minimalValid);
    expect(result.success).toBe(true);
  });

  it('accepts a full payload with all optional fields', () => {
    const full = {
      ...minimalValid,
      goals_passed: 8,
      goals_total: 10,
      artifact_ref: 'https://example.com/release-pack.zip',
      commit_sha: 'abc123',
      repository: 'org/repo',
      pr_number: '42',
    };
    const result = TestingVerdictIngestSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('rejects missing suite_id', () => {
    const { suite_id: _, ...bad } = minimalValid;
    const result = TestingVerdictIngestSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects empty suite_id', () => {
    const result = TestingVerdictIngestSchema.safeParse({ ...minimalValid, suite_id: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid source enum', () => {
    const result = TestingVerdictIngestSchema.safeParse({ ...minimalValid, source: 'github_action' });
    expect(result.success).toBe(false);
  });

  it('rejects wrong schema_version', () => {
    const result = TestingVerdictIngestSchema.safeParse({ ...minimalValid, schema_version: '2.0' });
    expect(result.success).toBe(false);
  });

  it('rejects negative goals_passed', () => {
    const result = TestingVerdictIngestSchema.safeParse({ ...minimalValid, goals_passed: -1 });
    expect(result.success).toBe(false);
  });

  it('accepts a failing verdict with reasons', () => {
    const failing = { ...minimalValid, pass: false, reasons: ['Goal "login" failed: timeout'] };
    const result = TestingVerdictIngestSchema.safeParse(failing);
    expect(result.success).toBe(true);
  });
});

describe('TestingVerdictEntrySchema', () => {
  it('accepts a well-formed entry', () => {
    const entry = {
      id: 'entry-1',
      workspace_id: 'ws-abc',
      recorded_at: '2026-06-11T10:00:01Z',
      verdict: {
        schema_version: TESTING_VERDICT_SCHEMA_VERSION,
        suite_id: 'my-suite',
        evaluated_at: '2026-06-11T10:00:00Z',
        pass: true,
        reasons: [],
        source: 'cli',
      },
    };
    const result = TestingVerdictEntrySchema.safeParse(entry);
    expect(result.success).toBe(true);
  });
});

describe('TestingVerdictHistoryResponseSchema', () => {
  it('accepts an empty entries list without next_cursor', () => {
    const result = TestingVerdictHistoryResponseSchema.safeParse({ entries: [] });
    expect(result.success).toBe(true);
  });

  it('accepts entries with next_cursor', () => {
    const result = TestingVerdictHistoryResponseSchema.safeParse({
      entries: [],
      next_cursor: 'cursor-42',
    });
    expect(result.success).toBe(true);
  });
});
