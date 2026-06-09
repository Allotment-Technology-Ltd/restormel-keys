import { describe, expect, it } from 'vitest';
import {
  CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
  ConnectEvalG2Schema,
  ConnectEvalVerdictSchema
} from './connect-eval.js';

describe('@restormel/contracts/connect-eval', () => {
  const verdict = {
    schema_version: CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
    evaluated_at: '2026-06-09T12:00:00.000Z',
    source: { kind: 'ingest_job', workspace_id: 'ws-1', job_id: 'job-1', assessed_at: '2026-06-09T11:58:00.000Z' },
    g2: { ok: 95, weak: 3, unsupported: 1, ok_pct: 96, unsupported_pct: 1 },
    targets: { ok_pct_min: 90, unsupported_pct_max: 2 },
    trust_score: 88,
    pass: true,
    reasons: []
  };

  it('parses a passing ingest-job verdict', () => {
    const parsed = ConnectEvalVerdictSchema.parse(verdict);
    expect(parsed.pass).toBe(true);
    expect(parsed.g2.ok_pct).toBe(96);
    expect(parsed.source.kind).toBe('ingest_job');
  });

  it('parses a failing local-counts verdict with optional fields omitted', () => {
    const parsed = ConnectEvalVerdictSchema.parse({
      schema_version: '1.0',
      evaluated_at: '2026-06-09T12:00:00.000Z',
      source: { kind: 'counts_file', path: './counts.json' },
      g2: { ok: 10, weak: 5, unsupported: 5, ok_pct: 50, unsupported_pct: 25 },
      targets: { ok_pct_min: 90, unsupported_pct_max: 2 },
      pass: false,
      reasons: ['ok_pct 50% < 90%', 'unsupported_pct 25% > 2%']
    });
    expect(parsed.pass).toBe(false);
    expect(parsed.trust_score).toBeUndefined();
    expect(parsed.reasons).toHaveLength(2);
  });

  it('carries coverage_gaps and fingerprint when supplied', () => {
    const parsed = ConnectEvalVerdictSchema.parse({
      ...verdict,
      source: { kind: 'stdin' },
      coverage_gaps: 2,
      fingerprint: '00000000a1b2c3d4'
    });
    expect(parsed.coverage_gaps).toBe(2);
    expect(parsed.fingerprint).toBe('00000000a1b2c3d4');
  });

  it('rejects an unknown schema_version', () => {
    expect(ConnectEvalVerdictSchema.safeParse({ ...verdict, schema_version: '2.0' }).success).toBe(false);
  });

  it('rejects negative or fractional counts', () => {
    expect(ConnectEvalG2Schema.safeParse({ ok: -1, weak: 0, unsupported: 0, ok_pct: 0, unsupported_pct: 0 }).success).toBe(false);
    expect(ConnectEvalG2Schema.safeParse({ ok: 1.5, weak: 0, unsupported: 0, ok_pct: 100, unsupported_pct: 0 }).success).toBe(false);
  });

  it('rejects a verdict missing the g2 breakdown', () => {
    const { g2: _g2, ...withoutG2 } = verdict;
    expect(ConnectEvalVerdictSchema.safeParse(withoutG2).success).toBe(false);
  });
});
