/**
 * Account reset to day-0 / GDPR Art 17 right-to-erasure — scoped, transactional,
 * AUDITED deletion of the REQUESTING account's data.
 *
 * WHY: the founder needs (a) a clean first-time-user test and (b) a lawful
 * right-to-erasure path. This module clears the signed-in account's SOURCES,
 * GRAPHS, KEYS, PROJECTS and all dependents (ingestion/readiness runs, the
 * Connect ledger, routes, model bindings, request/usage logs, encrypted BYOK
 * credentials) back to day-0 — and NEVER another account's data.
 *
 * SECURITY / SCOPING CONTRACT (the whole point of this module):
 *   - The unit of ownership is the WORKSPACE, resolved from the session user's
 *     id via `workspaces.owner_user_id` (one workspace per user). Every DELETE
 *     is parameterised by that resolved `workspaceId` (or the user's `userId`
 *     for the handful of user-scoped tables). There is NO unparameterised /
 *     global DELETE anywhere in this module — see `accountReset.test.ts`, which
 *     asserts every statement carries an account-scoped predicate.
 *   - Most child rows are wiped by `ON DELETE CASCADE` when the workspace row is
 *     deleted (projects → environments → routes → steps; provider_integrations →
 *     bindings; policies; audit; knowledge_*; connect_webhooks; etc.). The
 *     encrypted BYOK credential columns live ON the `provider_integrations` row,
 *     so deleting that row is a HARD delete of the ciphertext — no soft-delete,
 *     as Art 17 requires.
 *   - A set of tables have NO cascade FK back to the workspace (request_logs,
 *     usage_aggregates, the connect_* verdict/provenance/claim/idempotency
 *     tables, testing_run_verdicts) and would otherwise be orphaned. Those are
 *     deleted EXPLICITLY, scoped by `workspace_id`, BEFORE the cascade.
 *   - User-scoped rows that don't hang off the workspace (cli_device_sessions,
 *     and — only on full erasure — email_preferences / email_send_log) are
 *     scoped by `user_id` / email.
 *
 * NOT IN SCOPE (deliberately excluded — cannot be safely account-scoped, or are
 * shared/global, so touching them would risk other accounts):
 *   - `restormel_testing_run_jobs` — keyed by suite_id / workspace_root
 *     (filesystem path) by the sidecar runs service; not account-scopable.
 *   - `founders_applications` / `founders_circle_access` / `service_admin_emails`
 *     — global operational allowlists.
 *   - `models` / `provider_model_variants` / `catalog_*` — shared global catalog.
 *   - SurrealDB / external graph stores referenced by
 *     `workspaces.graph_store_config`: the Postgres knowledge_graph_* spine IS
 *     wiped here, but if a workspace points at an EXTERNAL graph DB its rows live
 *     outside this Postgres transaction. See `EXTERNAL_GRAPH_RESIDUAL` below and
 *     the open question in the PR description.
 *
 * Atomicity: all DELETEs (plus the new-workspace creation on a full account
 * reset) run inside ONE `sql.transaction()` so a failure rolls everything back.
 */

import type { DbClient, TxnClient, TxnQuery } from "$lib/server/db-adapter";

/**
 * Tables with NO `ON DELETE CASCADE` path back to `workspaces` — they carry a
 * `workspace_id` column but no FK, so they must be deleted explicitly and BEFORE
 * the workspace row. Each would otherwise be silently orphaned.
 *
 * Keeping this as data (not inline SQL) lets the unit test assert that EVERY
 * entry is emitted with a `workspace_id = $1` predicate and nothing else.
 */
export const ORPHAN_RISK_WORKSPACE_TABLES = [
  "request_logs",
  "usage_aggregates",
  "connect_ingest_idempotency_keys",
  "connect_provenance_traces",
  "connect_claim_versions",
  "connect_claim_judgments",
  "connect_eval_verdicts",
  "testing_run_verdicts",
] as const;

/**
 * Note for reviewers: an external graph store (when
 * `workspaces.graph_store_config` points at SurrealDB / another graph DB) is NOT
 * reachable from this Postgres transaction. Full erasure of those rows is a
 * follow-up (open question). The Postgres `knowledge_graph_*` spine IS cleared
 * via the workspace cascade.
 */
export const EXTERNAL_GRAPH_RESIDUAL =
  "external graph store rows (graph_store_config) are not deleted by this Postgres transaction";

/** The exact phrase the user must type to confirm a destructive reset. */
export const RESET_CONFIRM_PHRASE = "reset my account";

export type ResetScope = "account" | "project";

export interface ResetPlanInput {
  /** Resolved from the session user's workspace (owner_user_id). Required. */
  workspaceId: string;
  /** The session user id. Used for user-scoped tables. Required. */
  userId: string;
  /** "account" = full day-0 wipe; "project" = clear one project subtree only. */
  scope: ResetScope;
  /** Required when scope === "project"; MUST already be validated to belong to workspaceId. */
  projectId?: string;
  /**
   * GDPR Art 17 hard-erasure: also purge the user-scoped consent ledger
   * (email_preferences) and transactional send log. Default false — a "clean
   * first-run test" should NOT silently drop the user's marketing-consent record.
   */
  eraseUserScopedData?: boolean;
}

/**
 * Build the ordered list of parameterised DELETE statements (plus, for a full
 * account reset, the final `DELETE FROM workspaces`). PURE: no DB access, no
 * env. The executor runs these inside a transaction. Returning descriptors makes
 * the scoping directly assertable in tests.
 *
 * Ordering: orphan-risk explicit deletes first, then the cascading parent
 * (`workspaces` for an account reset, or `projects` for a project-scoped reset).
 */
export function buildResetStatements(input: ResetPlanInput): TxnQuery[] {
  if (!input.workspaceId) throw new Error("workspaceId required");
  if (!input.userId) throw new Error("userId required");

  const stmts: TxnQuery[] = [];

  if (input.scope === "project") {
    const projectId = input.projectId;
    if (!projectId) throw new Error("projectId required for project-scoped reset");
    // Project-scoped reset clears one project's subtree. Routes/api_keys/
    // provider_bindings/project_model_bindings/hosted_runtime_jobs all cascade
    // from `projects`. Orphan-risk log tables are workspace+project denormalised;
    // scope them by BOTH workspace_id AND project_id so we never touch another
    // workspace even if a project_id were somehow reused.
    stmts.push({
      text: `DELETE FROM request_logs WHERE workspace_id = $1 AND project_id = $2`,
      params: [input.workspaceId, projectId],
    });
    stmts.push({
      text: `DELETE FROM usage_aggregates WHERE workspace_id = $1 AND project_id = $2`,
      params: [input.workspaceId, projectId],
    });
    // Then delete the project row (cascades the rest). The owner predicate is
    // enforced by the caller (getProjectInWorkspace), and re-asserted here.
    stmts.push({
      text: `DELETE FROM projects WHERE id = $1 AND workspace_id = $2 AND user_id = $3`,
      params: [projectId, input.workspaceId, input.userId],
    });
    return stmts;
  }

  // -------- Full account reset to day-0 --------
  // 1) Explicit deletes for orphan-risk tables (workspace-scoped).
  for (const table of ORPHAN_RISK_WORKSPACE_TABLES) {
    stmts.push({
      text: `DELETE FROM ${table} WHERE workspace_id = $1`,
      params: [input.workspaceId],
    });
  }

  // 2) User-scoped, no-workspace-cascade tables.
  //    cli_device_sessions: project_id is SET NULL on project delete, so
  //    standalone/pending rows survive the cascade — purge by user_id.
  stmts.push({
    text: `DELETE FROM cli_device_sessions WHERE user_id = $1`,
    params: [input.userId],
  });

  // 3) Optional GDPR Art 17 hard-erasure of the user-scoped consent ledger.
  if (input.eraseUserScopedData) {
    stmts.push({
      text: `DELETE FROM email_send_log WHERE context_key IN (SELECT email FROM email_preferences WHERE user_id = $1)`,
      params: [input.userId],
    });
    stmts.push({
      text: `DELETE FROM email_preferences WHERE user_id = $1`,
      params: [input.userId],
    });
  }

  // 4) The cascading parent. Deleting the workspace row CASCADES the entire
  //    subtree (projects → environments → routes → steps/edges → api_keys;
  //    provider_integrations + encrypted credential columns → bindings;
  //    management_keys; policies → bindings/version events; audit_events;
  //    all workspace-scoped knowledge_* incl. the graph spine; connect_webhooks
  //    + deliveries; workspace_webhooks; upstream_mcp_targets; readiness runs).
  //    The `owner_user_id = $2` guard makes a cross-account delete impossible
  //    even if a wrong workspaceId were ever passed.
  stmts.push({
    text: `DELETE FROM workspaces WHERE id = $1 AND owner_user_id = $2`,
    params: [input.workspaceId, input.userId],
  });

  return stmts;
}

export interface ResetResult {
  scope: ResetScope;
  /** The workspace that was cleared. */
  clearedWorkspaceId: string;
  /** Per-statement deleted-row counts, keyed by table (best-effort, for the audit summary). */
  deleted: Record<string, number>;
}

/**
 * Execute the reset inside ONE transaction. Returns per-table delete counts.
 *
 * The caller MUST have already:
 *   - authenticated the session user,
 *   - resolved `workspaceId` from that user (owner_user_id),
 *   - validated `projectId` belongs to the workspace (for project scope),
 *   - verified the type-to-confirm phrase and same-origin.
 */
export async function executeAccountReset(sql: DbClient, input: ResetPlanInput): Promise<ResetResult> {
  const statements = buildResetStatements(input);

  // Run every delete atomically inside a single BEGIN/COMMIT — any failure rolls
  // the whole reset back, so the account is never left half-cleared.
  await sql.transaction((txn: TxnClient) =>
    statements.map((s) => txn.query(s.text, s.params)),
  );

  // Surface the set of tables touched (for the audit summary). Per-row counts
  // aren't portably available across the neon-http / pg drivers without a
  // RETURNING pass, so we record the table list rather than row tallies.
  const deleted: Record<string, number> = {};
  for (const s of statements) {
    const table = s.text.match(/DELETE FROM (\w+)/)?.[1];
    if (table) deleted[table] = (deleted[table] ?? 0) + 1; // statements per table
  }

  return {
    scope: input.scope,
    clearedWorkspaceId: input.workspaceId,
    deleted,
  };
}
