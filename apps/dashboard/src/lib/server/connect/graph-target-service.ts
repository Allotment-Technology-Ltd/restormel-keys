/**
 * Knowledge graph target service: encrypt connection secrets, persist via Neon,
 * map records to the public contract shape (never expose the secret), and run a
 * lightweight connectivity test against the configured Surreal HTTP endpoint.
 */
import type { ConnectGraphTarget, ConnectGraphTargetUpsert } from "@restormel/contracts/connect";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  isCredentialEncryptionConfigured,
  credentialEncryptionMisconfigReason,
} from "$lib/server/credential-crypto";
import {
  deleteConnectGraphTarget,
  getConnectGraphTargetById,
  getConnectGraphTargetForWorkspace,
  getConnectStageRoutingConfig,
  invalidateConnectGraphStatsCache,
  listConnectGraphTargetsForWorkspace,
  pingDashboardDatabase,
  updateConnectGraphTargetStatus,
  upsertConnectGraphTarget,
  upsertConnectStageRoutingConfig,
  type ConnectGraphTargetRecord,
} from "$lib/server/neon";
import { looksLikeSurrealJwt, parseSurrealConnectionString } from "$lib/server/connect/connection-string";
import { validateOutboundSurrealEndpoint } from "$lib/server/connect/outbound-surreal-endpoint";
import { isWebSocketSurrealEndpoint, surrealSdkQuery } from "$lib/server/connect/surreal-sdk";
import {
  parsePipelinePreset,
  parsePipelineSlotAssignments,
  parseRevertedSlots,
} from "$lib/connect/pipeline-config";

export { parseSurrealConnectionString };

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

function bundleFromRecord(row: ConnectGraphTargetRecord): ConnectGraphTarget["bundle"] {
  const settings = row.settings;
  const ids = settings.ingest_document_ids;
  const stage = settings.default_stop_after_stage;
  const allowVersionTable = settings.allow_claim_versions_table;
  // RES-113 PR-2: per-slot plug-point choices + server-side reverts, persisted
  // as settings keys (no schema column). Parsed defensively — unknown slot keys
  // and non-string ids are dropped; an unrecognised option id falls back to the
  // recommended default inside the derivation, so a stale id can never render.
  const pipelineSlots = parsePipelineSlotAssignments(settings.pipeline_slots);
  const revertedSlots = parseRevertedSlots(settings.reverted_slots);
  const pipelinePreset = parsePipelinePreset(settings.pipeline_preset);
  return {
    ...(row.defaultDomainPackId ? { default_domain_pack_id: row.defaultDomainPackId } : {}),
    ...(Array.isArray(ids)
      ? { ingest_document_ids: ids.filter((x): x is string => typeof x === "string") }
      : {}),
    ...(typeof stage === "string" && stage
      ? { default_stop_after_stage: stage as ConnectGraphTarget["bundle"]["default_stop_after_stage"] }
      : {}),
    // Stage 3.2b: default false when absent (opt-in, never assumed).
    allow_claim_versions_table: allowVersionTable === true,
    ...(Object.keys(pipelineSlots).length > 0 ? { pipeline_slots: pipelineSlots } : {}),
    ...(revertedSlots.length > 0 ? { reverted_slots: revertedSlots } : {}),
    ...(pipelinePreset ? { pipeline_preset: pipelinePreset } : {}),
  };
}

export function graphTargetRecordToApi(
  row: ConnectGraphTargetRecord,
  opts?: { isActive?: boolean },
): ConnectGraphTarget {
  const provider = row.provider === "postgres" ? "postgres" : "surreal";
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    ...(row.label ? { label: row.label } : {}),
    is_active: opts?.isActive ?? false,
    provider,
    connection: {
      ...(row.endpoint ? { endpoint: row.endpoint } : {}),
      ...(row.namespace ? { namespace: row.namespace } : {}),
      ...(row.database ? { database: row.database } : {}),
      ...(row.username ? { username: row.username } : {}),
    },
    use_dashboard_database: row.useDashboardDatabase,
    secret_set: Boolean(row.secretCiphertext),
    bundle: bundleFromRecord(row),
    status: row.status === "ok" ? "ok" : row.status === "error" ? "error" : "untested",
    ...(row.lastTestedAt ? { last_tested_at: msToIso(row.lastTestedAt) } : {}),
    ...(row.lastError ? { last_error: row.lastError } : {}),
    created_at: msToIso(row.createdAt),
    updated_at: msToIso(row.updatedAt),
  };
}

// ─── Active-graph pointer (stored in the workspace stage-routing config) ──────

const ACTIVE_GRAPH_KEY = "active_graph_target_id";

async function readRoutingConfig(workspaceId: string): Promise<Record<string, unknown>> {
  const raw = await getConnectStageRoutingConfig(workspaceId);
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? { ...(raw as Record<string, unknown>) }
    : {};
}

export async function getActiveGraphTargetId(workspaceId: string): Promise<string | null> {
  const cfg = await readRoutingConfig(workspaceId);
  const id = cfg[ACTIVE_GRAPH_KEY];
  return typeof id === "string" && id ? id : null;
}

/**
 * Make `graphTargetId` the workspace's active graph and hydrate the live
 * routing-config settings (selected domain pack, ingest document selection,
 * stop-after-stage) from that graph's saved bundle, so the whole app picks it up.
 */
export async function activateGraphTarget(
  workspaceId: string,
  graphTargetId: string,
): Promise<{ ok: true } | { ok: false; error: "not_found" }> {
  const target = await getConnectGraphTargetById({ id: graphTargetId, workspaceId });
  if (!target) return { ok: false, error: "not_found" };
  const cfg = await readRoutingConfig(workspaceId);
  cfg[ACTIVE_GRAPH_KEY] = graphTargetId;

  if (target.defaultDomainPackId) cfg.default_domain_pack_id = target.defaultDomainPackId;
  else delete cfg.default_domain_pack_id;

  const ids = target.settings.ingest_document_ids;
  if (Array.isArray(ids) && ids.length > 0) cfg.ingest_document_ids = ids;
  else delete cfg.ingest_document_ids;

  const stage = target.settings.default_stop_after_stage;
  if (typeof stage === "string" && stage) cfg.default_stop_after_stage = stage;
  else delete cfg.default_stop_after_stage;

  await upsertConnectStageRoutingConfig(workspaceId, cfg);
  return { ok: true };
}

/**
 * One-click connect: use the dashboard's own host-managed Postgres database as the graph
 * spine (REC-ADR-008 — self-hosted EU Postgres, the EU-sovereign default tier). Gated by
 * `connectHostManagedGraphStore` (default off for MVP). No credentials required — reuses the
 * configured server-side DATABASE_URL; custody stays Restormel-side. Reuses an existing
 * host-managed graph for the workspace if one is already saved, and activates it.
 */
export async function connectHostManagedGraphTarget(workspaceId: string): Promise<ConnectGraphTarget> {
  const existing = (await listConnectGraphTargetsForWorkspace(workspaceId)).find(
    (t) => t.useDashboardDatabase,
  );
  const row = await upsertConnectGraphTarget({
    id: existing?.id,
    workspaceId,
    label: existing?.label ?? "Workspace database",
    provider: "postgres",
    useDashboardDatabase: true,
    endpoint: null,
    namespace: null,
    database: null,
    username: null,
    status: "ok",
  });
  await activateGraphTarget(workspaceId, row.id);
  return graphTargetRecordToApi(row, { isActive: true });
}

/**
 * Back-compat alias (REC-ADR-008 rename). Prefer {@link connectHostManagedGraphTarget}.
 * Retained so any not-yet-updated import keeps resolving to the same provisioner.
 */
export const connectDashboardNeonTarget = connectHostManagedGraphTarget;

export async function getGraphTargetForUi(workspaceId: string): Promise<ConnectGraphTarget | null> {
  const row = await getConnectGraphTargetForWorkspace(workspaceId);
  return row ? graphTargetRecordToApi(row, { isActive: true }) : null;
}

/** List every saved graph (Graph Library) with the active one flagged. */
export async function listGraphTargetsForUi(workspaceId: string): Promise<ConnectGraphTarget[]> {
  const [rows, activeId] = await Promise.all([
    listConnectGraphTargetsForWorkspace(workspaceId),
    getActiveGraphTargetId(workspaceId),
  ]);
  // Fall back to most-recent (first row) when no explicit pointer is set.
  const resolvedActive = activeId ?? rows[0]?.id ?? null;
  return rows.map((row) => graphTargetRecordToApi(row, { isActive: row.id === resolvedActive }));
}

export type GraphTargetSaveResult =
  | { ok: true; target: ConnectGraphTarget }
  | { ok: false; status: number; error: string; message: string };

/** Encrypt the provided secret, or signal that the existing one should be kept. */
function resolveSecretPayload(
  secret: string | undefined,
):
  | { ok: true; payload: { ciphertext: string; iv: string; authTag: string; encryptionVersion: number } | undefined }
  | { ok: false; status: number; error: string; message: string } {
  if (!secret || !secret.trim()) return { ok: true, payload: undefined };
  if (!isCredentialEncryptionConfigured()) {
    const reason = credentialEncryptionMisconfigReason();
    return {
      ok: false,
      status: 503,
      error: "server_misconfigured",
      message:
        reason ??
        "RESTORMEL_CREDENTIALS_ENCRYPTION_KEY is not configured; cannot store the graph store secret.",
    };
  }
  const enc = encryptProviderSecret(secret.trim());
  if (!enc.ok) {
    return { ok: false, status: 503, error: "server_misconfigured", message: enc.error };
  }
  return {
    ok: true,
    payload: {
      ciphertext: enc.payload.ciphertextB64,
      iv: enc.payload.ivB64,
      authTag: enc.payload.authTagB64,
      encryptionVersion: enc.payload.encryptionVersion,
    },
  };
}

/**
 * A Postgres error string/code that indicates the persisted schema is BEHIND the
 * code — an undefined column (42703) or undefined table (42P01). This is the
 * deploy/migration-drift signature (cf. incident 2026-06-16 catalogue 503 and
 * 2026-06-18 add-graph 500): the only fix is to apply the pending migration, not
 * to retry. We surface a distinct, actionable message for it.
 */
function isSchemaDriftError(message: string): boolean {
  return (
    /\b42703\b/.test(message) || // undefined_column
    /\b42P01\b/.test(message) || // undefined_table
    /column .* does not exist/i.test(message) ||
    /relation .* does not exist/i.test(message)
  );
}

/**
 * Map a thrown persistence error to a typed GraphTargetSaveResult so the route
 * never returns a bare 500. NEVER include the secret/credentials in the log or
 * the response — only the workspace id and a sanitised DB error string. The
 * encrypted ciphertext stays at rest; nothing here can leak plaintext.
 */
function mapGraphTargetPersistError(e: unknown, workspaceId: string): GraphTargetSaveResult {
  const raw = e instanceof Error ? e.message : String(e);
  // Defensive: cap and strip any accidental credential-looking material from logs.
  const safe = raw.replace(/\s+/g, " ").slice(0, 280);
  console.error("[graph-target-service] persist failed", { workspaceId, error: safe });
  if (isSchemaDriftError(raw)) {
    return {
      ok: false,
      status: 503,
      error: "server_misconfigured",
      message:
        "The server's database is missing a required migration for graph connections. " +
        "This is a deploy/configuration issue, not your credentials — please retry shortly or contact support if it persists.",
    };
  }
  return {
    ok: false,
    status: 503,
    error: "storage_unavailable",
    message: "Couldn't save the graph connection — the database is temporarily unavailable. Please try again.",
  };
}

/** Shared core: persist a Surreal graph (create when `id` is absent) and optionally activate it. */
async function persistGraphTarget(
  workspaceId: string,
  input: ConnectGraphTargetUpsert,
  opts: { id?: string; activate?: boolean },
): Promise<GraphTargetSaveResult> {
  const secret = resolveSecretPayload(input.secret);
  if (!secret.ok) return secret;

  const endpointCheck = validateOutboundSurrealEndpoint(input.endpoint);
  if (!endpointCheck.ok) {
    return { ok: false, status: 400, error: "invalid_endpoint", message: endpointCheck.message };
  }

  const label = input.label?.trim() || `${input.namespace}/${input.database}`;

  // Persist + (optionally) activate. Every DB call below can throw — most notably
  // on schema drift, where prod runs migrations behind the code and a referenced
  // column/table does not yet exist (incident 2026-06-18: the Graph Library
  // columns label/default_domain_pack_id/settings lived only in runtime DDL,
  // which is disabled in prod). An UNCAUGHT throw here became a bare HTTP 500
  // ("Internal Error") on every save. Map it to a clear, typed result instead,
  // and log the failure WITHOUT the secret (only ws id + sanitised DB error).
  try {
    // Stage 3.2b: persist the version-table opt-in in the settings JSONB so it travels
    // with the graph and survives reconnections. We must merge with the existing settings
    // rather than replace them, so other settings keys (ingest_document_ids etc.) are preserved.
    const existingSettings: Record<string, unknown> = opts.id
      ? ((await getConnectGraphTargetById({ id: opts.id, workspaceId }))?.settings ?? {})
      : {};
    const newSettings: Record<string, unknown> = {
      ...existingSettings,
      // Only write when the caller sent the field (undefined = keep existing value).
      ...(input.allow_claim_versions_table !== undefined
        ? { allow_claim_versions_table: input.allow_claim_versions_table }
        : {}),
    };

    const row = await upsertConnectGraphTarget({
      id: opts.id,
      workspaceId,
      label,
      provider: input.provider,
      endpoint: input.endpoint,
      namespace: input.namespace,
      database: input.database,
      username: input.username ?? null,
      defaultDomainPackId: input.default_domain_pack_id ?? undefined,
      settings: newSettings,
      secret: secret.payload,
    });

    let isActive = false;
    if (opts.activate) {
      await activateGraphTarget(workspaceId, row.id);
      isActive = true;
    } else {
      isActive = (await getActiveGraphTargetId(workspaceId)) === row.id;
    }
    return { ok: true, target: graphTargetRecordToApi(row, { isActive }) };
  } catch (e) {
    return mapGraphTargetPersistError(e, workspaceId);
  }
}

/**
 * Legacy single-target save (store wizard / older API): update the active graph,
 * or create the first one and activate it.
 */
export async function saveGraphTarget(
  workspaceId: string,
  input: ConnectGraphTargetUpsert,
): Promise<GraphTargetSaveResult> {
  const existing = await getConnectGraphTargetForWorkspace(workspaceId);
  return persistGraphTarget(workspaceId, input, {
    id: existing?.id,
    activate: !existing,
  });
}

/** Graph Library: create a new saved graph; activate it when requested (or if it's the first). */
export async function createGraphTarget(
  workspaceId: string,
  input: ConnectGraphTargetUpsert,
  opts?: { activate?: boolean },
): Promise<GraphTargetSaveResult> {
  const isFirst = (await listConnectGraphTargetsForWorkspace(workspaceId)).length === 0;
  return persistGraphTarget(workspaceId, input, { activate: opts?.activate ?? isFirst });
}

/** Graph Library: update an existing saved graph in place. */
export async function updateGraphTarget(
  workspaceId: string,
  id: string,
  input: ConnectGraphTargetUpsert,
): Promise<GraphTargetSaveResult | { ok: false; status: 404; error: "not_found"; message: string }> {
  const existing = await getConnectGraphTargetById({ id, workspaceId });
  if (!existing) {
    return { ok: false, status: 404, error: "not_found", message: "Graph not found." };
  }
  const result = await persistGraphTarget(workspaceId, input, { id });
  // The connection or pack may have changed — drop cached stats for this graph.
  await invalidateConnectGraphStatsCache({ workspaceId, graphTargetId: id }).catch(() => {});
  // Re-sync the live routing config if we edited the active graph's bundle.
  if (result.ok && (await getActiveGraphTargetId(workspaceId)) === id) {
    await activateGraphTarget(workspaceId, id);
    result.target.is_active = true;
  }
  return result;
}

/** Graph Library: switch the active graph. */
export async function setActiveGraphTarget(
  workspaceId: string,
  id: string,
): Promise<{ ok: true } | { ok: false; status: 404; error: "not_found" }> {
  const result = await activateGraphTarget(workspaceId, id);
  if (result.ok) {
    await invalidateConnectGraphStatsCache({ workspaceId, graphTargetId: id }).catch(() => {});
  }
  return result.ok ? { ok: true } : { ok: false, status: 404, error: "not_found" };
}

/** Graph Library: delete a saved graph; re-point the active graph if it was deleted. */
export async function removeGraphTarget(
  workspaceId: string,
  id: string,
): Promise<{ ok: true; nextActiveId: string | null } | { ok: false; status: 404; error: "not_found" }> {
  const deleted = await deleteConnectGraphTarget({ id, workspaceId });
  if (!deleted) return { ok: false, status: 404, error: "not_found" };
  await invalidateConnectGraphStatsCache({ workspaceId, graphTargetId: id }).catch(() => {});
  const activeId = await getActiveGraphTargetId(workspaceId);
  if (activeId === id || activeId === null) {
    const remaining = await listConnectGraphTargetsForWorkspace(workspaceId);
    const next = remaining[0]?.id ?? null;
    if (next) {
      await activateGraphTarget(workspaceId, next);
      return { ok: true, nextActiveId: next };
    }
    // No graphs left — clear the pointer.
    const cfg = await readRoutingConfig(workspaceId);
    delete cfg[ACTIVE_GRAPH_KEY];
    await upsertConnectStageRoutingConfig(workspaceId, cfg);
    return { ok: true, nextActiveId: null };
  }
  return { ok: true, nextActiveId: activeId };
}

export type SurrealHttpConn = {
  endpoint: string;
  namespace: string;
  database: string;
  username: string | null;
  password: string | null;
};

function surrealHttpBase(endpoint: string): string {
  return endpoint.replace(/\/$/, "");
}

function extractSurrealSignInToken(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const token = (data as Record<string, unknown>).token;
  return typeof token === "string" && token.trim() ? token.trim() : null;
}

/**
 * Namespace and database DEFINE USER accounts must sign in via POST /signin and
 * use Bearer on /sql. Basic auth on /sql is root-level only and returns 401 for
 * scoped users.
 */
export async function surrealSignIn(
  conn: SurrealHttpConn,
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const endpointCheck = validateOutboundSurrealEndpoint(conn.endpoint);
  if (!endpointCheck.ok) return { ok: false, error: endpointCheck.message };

  const username = conn.username?.trim() ?? "";
  const password = conn.password?.trim() ?? "";
  if (!username || !password) {
    return { ok: false, error: "Username and password are required to sign in." };
  }

  const signinUrl = `${surrealHttpBase(conn.endpoint)}/signin`;
  const attempts: Record<string, string>[] = [
    { ns: conn.namespace, db: conn.database, user: username, pass: password },
    { ns: conn.namespace, user: username, pass: password },
    { user: username, pass: password },
  ];

  let lastError = "Surreal sign-in failed";
  for (const body of attempts) {
    let res: Response;
    try {
      res = await fetch(signinUrl, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
        // Same deadline as /sql queries — a wedged sign-in must not hang ingest runs.
        signal: AbortSignal.timeout(SURREAL_HTTP_TIMEOUT_MS),
      });
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
        return { ok: false, error: `Surreal sign-in timed out after ${SURREAL_HTTP_TIMEOUT_MS}ms` };
      }
      return { ok: false, error: e instanceof Error ? e.message : "network error" };
    }

    if (!res.ok) {
      lastError = `Surreal sign-in HTTP ${res.status}`;
      continue;
    }

    try {
      const data = (await res.json()) as unknown;
      const token = extractSurrealSignInToken(data);
      if (token) return { ok: true, token };
      lastError = "Surreal sign-in returned no token";
    } catch {
      lastError = "Invalid Surreal sign-in response";
    }
  }

  return {
    ok: false,
    error: `${lastError}. Check username/password and that the user is defined at root, namespace, or database level in Surreal.`,
  };
}

/** Resolve Authorization bearer token (or null for anonymous). */
export async function resolveSurrealBearerToken(
  conn: SurrealHttpConn,
): Promise<{ ok: true; token: string | null } | { ok: false; error: string }> {
  const secret = conn.password?.trim() ?? "";
  const username = conn.username?.trim() ?? "";

  if (secret && (!username || looksLikeSurrealJwt(secret))) {
    return { ok: true, token: secret };
  }

  if (username && secret) {
    const signin = await surrealSignIn(conn);
    if (!signin.ok) return signin;
    return { ok: true, token: signin.token };
  }

  if (username && !secret) {
    return { ok: false, error: "Password is required with username." };
  }

  return { ok: true, token: null };
}

export function decryptGraphTargetSecret(row: ConnectGraphTargetRecord): string | null {
  if (!row.secretCiphertext) return null;
  const res = decryptProviderSecret({
    credentialCiphertext: row.secretCiphertext,
    credentialIv: row.secretIv,
    credentialAuthTag: row.secretAuthTag,
    encryptionVersion: row.secretEncryptionVersion,
  });
  return res.ok ? res.secret : null;
}

/**
 * Test connectivity to a Surreal HTTP endpoint with a trivial `RETURN true` query.
 * Uses the SurrealDB HTTP /sql API; no extra driver dependency.
 */
export async function testGraphTargetConnection(
  workspaceId: string,
  graphTargetId?: string,
): Promise<{ ok: boolean; message: string }> {
  const row = graphTargetId
    ? await getConnectGraphTargetById({ id: graphTargetId, workspaceId })
    : await getConnectGraphTargetForWorkspace(workspaceId);
  if (!row) {
    return { ok: false, message: "No graph target configured for this workspace." };
  }
  const targetId = row.id;

  if (row.provider === "postgres" && row.useDashboardDatabase) {
    try {
      const ok = await pingDashboardDatabase();
      await updateConnectGraphTargetStatus({
        workspaceId,
        graphTargetId: targetId,
        status: ok ? "ok" : "error",
        lastError: ok ? null : "dashboard database unreachable",
      });
      return ok
        ? { ok: true, message: "Connected to this workspace's host-managed Postgres graph store." }
        : { ok: false, message: "Host-managed Postgres graph store unreachable." };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      await updateConnectGraphTargetStatus({ workspaceId, graphTargetId: targetId, status: "error", lastError: msg.slice(0, 280) });
      return { ok: false, message: msg.slice(0, 280) };
    }
  }

  if (!row.endpoint || !row.namespace || !row.database) {
    await updateConnectGraphTargetStatus({
      workspaceId,
      graphTargetId: targetId,
      status: "error",
      lastError: "incomplete Surreal connection",
    });
    return { ok: false, message: "Surreal target is missing endpoint, namespace, or database." };
  }
  const secret = decryptGraphTargetSecret(row);
  try {
    const result = await surrealQuery({
      endpoint: row.endpoint,
      namespace: row.namespace,
      database: row.database,
      username: row.username,
      password: secret,
      sql: "RETURN true;",
    });
    if (result.ok) {
      await updateConnectGraphTargetStatus({ workspaceId, graphTargetId: targetId, status: "ok", lastError: null });
      await invalidateConnectGraphStatsCache({ workspaceId, graphTargetId: targetId }).catch(() => {});
      return { ok: true, message: "Connection succeeded." };
    }
    await updateConnectGraphTargetStatus({ workspaceId, graphTargetId: targetId, status: "error", lastError: result.error });
    return { ok: false, message: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Connection failed";
    await updateConnectGraphTargetStatus({ workspaceId, graphTargetId: targetId, status: "error", lastError: msg.slice(0, 280) });
    return { ok: false, message: msg.slice(0, 280) };
  }
}

/** Test Surreal connectivity from draft form values without persisting. */
export async function testGraphTargetDraft(
  workspaceId: string,
  draft: {
    endpoint: string;
    namespace: string;
    database: string;
    username?: string | null;
    secret?: string | null;
    useSavedSecret?: boolean;
  },
): Promise<{ ok: boolean; message: string }> {
  let secret = draft.secret?.trim() || null;
  if (!secret && draft.useSavedSecret) {
    const row = await getConnectGraphTargetForWorkspace(workspaceId);
    secret = row ? decryptGraphTargetSecret(row) : null;
  }
  if (!secret && !draft.username) {
    return {
      ok: false,
      message: "Add a token or password to test, or keep your CLI paste in the box above.",
    };
  }
  const result = await surrealQuery({
    endpoint: draft.endpoint,
    namespace: draft.namespace,
    database: draft.database,
    username: draft.username,
    password: secret,
    sql: "RETURN true;",
  });
  return result.ok
    ? { ok: true, message: "Connection succeeded." }
    : { ok: false, message: result.error };
}

/** Default per-request timeout (ms) for outbound Surreal HTTP calls. Override via env. */
export const SURREAL_HTTP_TIMEOUT_MS = (() => {
  const raw = Number(process.env.RESTORMEL_SURREAL_HTTP_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : 25_000;
})();

/** Minimal Surreal HTTP /sql client (no driver dependency). */
export async function surrealHttpQuery(params: {
  endpoint: string;
  namespace: string;
  database: string;
  username?: string | null;
  password?: string | null;
  /** When set, skips sign-in / token resolution (used by cached graph store sessions). */
  bearerToken?: string | null;
  /** Abort the request after this many ms (default SURREAL_HTTP_TIMEOUT_MS) so a slow query can't hang a page load. */
  timeoutMs?: number;
  sql: string;
}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  const endpointCheck = validateOutboundSurrealEndpoint(params.endpoint);
  if (!endpointCheck.ok) return { ok: false, error: endpointCheck.message };

  const base = surrealHttpBase(params.endpoint);
  const url = base.endsWith("/sql") ? base : `${base}/sql`;
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "text/plain",
    "Surreal-NS": params.namespace,
    "Surreal-DB": params.database,
    NS: params.namespace,
    DB: params.database,
  };

  let bearer = params.bearerToken ?? undefined;
  if (bearer === undefined) {
    const auth = await resolveSurrealBearerToken({
      endpoint: params.endpoint,
      namespace: params.namespace,
      database: params.database,
      username: params.username ?? null,
      password: params.password ?? null,
    });
    if (!auth.ok) return auth;
    bearer = auth.token ?? undefined;
  }

  if (bearer) {
    headers.Authorization = `Bearer ${bearer}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: params.sql,
      signal: AbortSignal.timeout(params.timeoutMs ?? SURREAL_HTTP_TIMEOUT_MS),
    });
  } catch (e) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      return {
        ok: false,
        error: `Surreal query timed out after ${params.timeoutMs ?? SURREAL_HTTP_TIMEOUT_MS}ms`,
      };
    }
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) {
    const hint =
      res.status === 401
        ? " Check credentials, or use a Surreal Cloud token (leave Username empty)."
        : "";
    let detail = "";
    try {
      const raw = await res.text();
      if (raw.trim()) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed)) {
            const first = parsed[0] as { result?: string; message?: string } | undefined;
            detail = String(first?.result ?? first?.message ?? "").trim();
          } else if (parsed && typeof parsed === "object") {
            const rec = parsed as Record<string, unknown>;
            detail = String(rec.message ?? rec.error ?? rec.result ?? "").trim();
          }
        } catch {
          detail = raw.trim();
        }
        if (detail.length > 240) detail = `${detail.slice(0, 240)}…`;
        if (detail) detail = ` — ${detail}`;
      }
    } catch {
      // ignore body read errors
    }
    return { ok: false, error: `Surreal HTTP ${res.status}${hint}${detail}` };
  }
  try {
    const data = (await res.json()) as unknown;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Invalid Surreal response" };
  }
}

/**
 * Dispatch a Surreal query by endpoint scheme: ws/wss → the SDK (WebSocket RPC),
 * http/https → the HTTP /sql client. Returns the same `{ ok, data }` envelope shape
 * either way (data = [{ result }, …], one entry per statement).
 */
export async function surrealQuery(params: {
  endpoint: string;
  namespace: string;
  database: string;
  username?: string | null;
  password?: string | null;
  bearerToken?: string | null;
  timeoutMs?: number;
  vars?: Record<string, unknown>;
  sql: string;
}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
  if (isWebSocketSurrealEndpoint(params.endpoint)) {
    return surrealSdkQuery(params);
  }
  return surrealHttpQuery(params);
}
