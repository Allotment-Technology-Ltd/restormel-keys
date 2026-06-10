-- EBV Layer 2 judgment audit (Stage 1.0d, docs/decisions/evidence-bound-verification.md).
-- Append-only: every span-scoped entailment verdict is recorded with its judge model,
-- prompt version, and timestamp. A re-judged claim gets a NEW row — prior verdicts are
-- never updated or deleted, so the full judgment history of any claim is auditable.
CREATE TABLE IF NOT EXISTS connect_claim_judgments (
  id              BIGSERIAL   PRIMARY KEY,
  workspace_id    TEXT        NOT NULL,
  unit_id         TEXT        NOT NULL,
  verdict         TEXT        NOT NULL, -- entailed | not_entailed | abstain
  confidence      REAL,
  note            TEXT,
  judge_model     TEXT,
  prompt_version  INT         NOT NULL,
  judged_at       TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connect_claim_judgments_unit
  ON connect_claim_judgments (workspace_id, unit_id, judged_at DESC);
