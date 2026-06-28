-- Migration 074: connect_store_move_decisions (RES-113 PR-K — M3 non-destructive store move).
--
-- WHAT: an append-only audit of the M3 "own your store" non-destructive choice
-- (REC-ADR-017 / REC-ADR-021 M3). Each row records, for a workspace, the read-only
-- node-count probe snapshot of a target store and the operator's chosen option
-- (use_existing / add_alongside / keep_separate) together with the resolved
-- non-destructive plan. This is the durable substrate for the load-bearing
-- reversibility promise — "your managed copy remains until you confirm the switch,
-- and you can switch back at any time": the system must be able to say which
-- binding was chosen, when, and that nothing was deleted.
--
-- NON-DESTRUCTIVE BY CONSTRUCTION: this table records DECISIONS only. It NEVER
-- holds customer graph data and the feature performs no copy/overwrite/migrate at
-- decide-time (the real cross-store move is env-pending — see store-move-plan.ts).
-- Storing only counts + timestamps + the chosen option keeps the customer-store
-- read footprint minimal (REC-ADR-017 Consequences: a non-empty-target read is a
-- read of customer metadata).
--
-- FLAG-GATED + NOT REQUIRED AT BOOT: the whole RES-113 store-move surface is gated
-- behind connectHostManagedGraphStore + onboardingJourney (default OFF), so this
-- migration is intentionally NOT promoted to REQUIRED_MIGRATION — a deploy that has
-- not yet applied it must still boot with the flags off. The writer tolerates the
-- table's absence (schema-drift-safe), mirroring the 070/072 incident lessons:
-- new tables ship as a numbered migration (runtime DDL is disabled in prod), and
-- the route degrades gracefully rather than 500-ing if the migration is pending.
--
-- ROLLBACK:
--   DROP TABLE IF EXISTS connect_store_move_decisions;

CREATE TABLE IF NOT EXISTS connect_store_move_decisions (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Target store engine probed: 'postgres' (managed origin, #288) | 'surreal' | 'neo4j'.
  target_engine TEXT NOT NULL,
  -- Read-only probe snapshot at decision time.
  probe_node_count INTEGER,            -- NULL = count unknown at probe time.
  probe_last_write_at TIMESTAMPTZ,     -- NULL when the engine exposes no last-write.
  target_was_empty BOOLEAN NOT NULL,
  -- The operator's chosen option.
  chosen_option TEXT NOT NULL,
  -- The resolved non-destructive plan (StoreMovePlan), for audit/replay.
  plan JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Invariant witnesses: these are always true for an accepted decision. Stored
  -- explicitly so the audit row itself attests the non-destructiveness guarantee.
  managed_copy_retained BOOLEAN NOT NULL DEFAULT TRUE,
  reversible BOOLEAN NOT NULL DEFAULT TRUE,
  -- TRUE while the actual cross-store copy / read re-point has not been executed
  -- (env-pending). A decision is recorded before any move runs.
  execution_env_pending BOOLEAN NOT NULL DEFAULT TRUE,
  created_at BIGINT NOT NULL,
  CONSTRAINT connect_store_move_decisions_engine_check
    CHECK (target_engine IN ('postgres', 'surreal', 'neo4j')),
  CONSTRAINT connect_store_move_decisions_option_check
    CHECK (chosen_option IN ('use_existing', 'add_alongside', 'keep_separate')),
  -- Belt-and-braces at the data layer: an audited decision can never claim the
  -- managed copy was dropped or that it is irreversible.
  CONSTRAINT connect_store_move_decisions_nondestructive_check
    CHECK (managed_copy_retained = TRUE AND reversible = TRUE)
);

-- Hot path: the workspace's latest store-move decision (reversibility "current binding").
CREATE INDEX IF NOT EXISTS idx_connect_store_move_decisions_workspace_created
  ON connect_store_move_decisions (workspace_id, created_at DESC);
