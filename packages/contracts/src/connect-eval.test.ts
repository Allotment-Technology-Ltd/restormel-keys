import { describe, expect, it } from 'vitest';
import {
  CONNECT_EVAL_BASELINE_SCHEMA_VERSION,
  CONNECT_EVAL_DIFF_SCHEMA_VERSION,
  CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
  ConnectEvalBaselineSchema,
  ConnectEvalClaimRefSchema,
  ConnectEvalDiffSchema,
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

  it('carries unsupported_claims (Stage 2.2, additive — same schema_version)', () => {
    const parsed = ConnectEvalVerdictSchema.parse({
      ...verdict,
      unsupported_claims: [
        { id: 'claim-9', text: 'Utilitarianism was first formalised in 1900.', source_ref: 'https://example.test/sep' },
        { text: 'A claim with no stable id.' }
      ]
    });
    expect(parsed.schema_version).toBe(CONNECT_EVAL_VERDICT_SCHEMA_VERSION);
    expect(parsed.unsupported_claims).toHaveLength(2);
    expect(parsed.unsupported_claims?.[0].source_ref).toBe('https://example.test/sep');
  });

  it('rejects claim refs with empty text or empty id/source_ref', () => {
    expect(ConnectEvalClaimRefSchema.safeParse({ text: '' }).success).toBe(false);
    expect(ConnectEvalClaimRefSchema.safeParse({ text: 'ok', id: '' }).success).toBe(false);
    expect(ConnectEvalClaimRefSchema.safeParse({ text: 'ok', source_ref: '' }).success).toBe(false);
    expect(ConnectEvalClaimRefSchema.safeParse({ text: 'ok' }).success).toBe(true);
  });
});

describe('@restormel/contracts/connect-eval baseline + diff (Stage 2.2)', () => {
  const verdict = {
    schema_version: CONNECT_EVAL_VERDICT_SCHEMA_VERSION,
    evaluated_at: '2026-06-09T12:00:00.000Z',
    source: { kind: 'counts_file', path: './counts.json' },
    g2: { ok: 95, weak: 3, unsupported: 1, ok_pct: 96, unsupported_pct: 1 },
    targets: { ok_pct_min: 90, unsupported_pct_max: 2 },
    trust_score: 88,
    fingerprint: '00000000a1b2c3d4',
    pass: true,
    reasons: []
  };

  it('parses a baseline embedding the full verdict (no parallel shape)', () => {
    const parsed = ConnectEvalBaselineSchema.parse({
      schema_version: CONNECT_EVAL_BASELINE_SCHEMA_VERSION,
      saved_at: '2026-06-09T12:00:00.000Z',
      fingerprint: '00000000a1b2c3d4',
      verdict
    });
    expect(parsed.verdict.g2.ok_pct).toBe(96);
    expect(parsed.fingerprint).toBe('00000000a1b2c3d4');
  });

  it('rejects a baseline whose embedded verdict is invalid', () => {
    expect(
      ConnectEvalBaselineSchema.safeParse({
        schema_version: CONNECT_EVAL_BASELINE_SCHEMA_VERSION,
        saved_at: '2026-06-09T12:00:00.000Z',
        verdict: { ...verdict, g2: undefined }
      }).success
    ).toBe(false);
  });

  it('parses a regression diff with new unsupported claims cited by text + source ref', () => {
    const parsed = ConnectEvalDiffSchema.parse({
      schema_version: CONNECT_EVAL_DIFF_SCHEMA_VERSION,
      compared_at: '2026-06-10T08:00:00.000Z',
      baseline_saved_at: '2026-06-09T12:00:00.000Z',
      baseline_fingerprint: '00000000a1b2c3d4',
      current_fingerprint: '00000000a1b2c3d4',
      fingerprint_changed: false,
      tolerance: 1,
      deltas: { ok_pct: -8, unsupported_pct: 2, trust_score: -8, coverage_gaps: 1 },
      claims_compared: true,
      new_unsupported_claims: [
        { id: 'claim-9', text: 'Utilitarianism was first formalised in 1900.', source_ref: 'https://example.test/sep' }
      ],
      regression: true,
      regressions: ['ok_pct dropped 96% → 88% (Δ -8 beyond tolerance 1)']
    });
    expect(parsed.regression).toBe(true);
    expect(parsed.new_unsupported_claims[0].text).toContain('Utilitarianism');
  });

  it('rejects a diff with a negative tolerance or unknown schema_version', () => {
    const base = {
      schema_version: CONNECT_EVAL_DIFF_SCHEMA_VERSION,
      compared_at: '2026-06-10T08:00:00.000Z',
      baseline_saved_at: '2026-06-09T12:00:00.000Z',
      fingerprint_changed: false,
      tolerance: 1,
      deltas: { ok_pct: 0, unsupported_pct: 0 },
      claims_compared: false,
      new_unsupported_claims: [],
      regression: false,
      regressions: []
    };
    expect(ConnectEvalDiffSchema.safeParse(base).success).toBe(true);
    expect(ConnectEvalDiffSchema.safeParse({ ...base, tolerance: -1 }).success).toBe(false);
    expect(ConnectEvalDiffSchema.safeParse({ ...base, schema_version: '9.9' }).success).toBe(false);
  });
});
