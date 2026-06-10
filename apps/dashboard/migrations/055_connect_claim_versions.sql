-- EBV Layer 1 persistence + verified-memory version chains (one table, per the approved
-- ADRs: docs/decisions/evidence-bound-verification.md and
-- docs/decisions/verified-memory-incremental-ingest.md).
-- Each row is one claim VERSION: the unit's text at a point in time, its evidence span
-- pinned to a source-version content hash, its verification state, and its validity
-- window. Stage 1.0c writes version 1 rows (claim_key NULL until Stage 3.2's identity
-- backfill); supersession (valid_to / superseded_by) is written by Stage 3.2.
CREATE TABLE IF NOT EXISTS connect_claim_versions (
  id                  BIGSERIAL   PRIMARY KEY,
  workspace_id        TEXT        NOT NULL,
  unit_id             TEXT        NOT NULL,
  claim_key           TEXT,
  version_no          INT         NOT NULL DEFAULT 1,
  text                TEXT        NOT NULL,
  evidence_quote      TEXT,
  span_start          INT,
  span_end            INT,
  evidence_match      TEXT,       -- exact | normalized | fuzzy
  evidence_status     TEXT        NOT NULL, -- bound | unbound | no_evidence
  source_hash         TEXT,
  verification_state  TEXT        NOT NULL DEFAULT 'unverified',
  judged_by           TEXT,
  judged_at           TIMESTAMPTZ,
  valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_to            TIMESTAMPTZ,
  superseded_by       BIGINT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_connect_claim_versions_unit
  ON connect_claim_versions (workspace_id, unit_id) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_connect_claim_versions_state
  ON connect_claim_versions (workspace_id, verification_state) WHERE valid_to IS NULL;

CREATE INDEX IF NOT EXISTS idx_connect_claim_versions_claim_key
  ON connect_claim_versions (workspace_id, claim_key) WHERE claim_key IS NOT NULL;
