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
  getConnectGraphTargetForWorkspace,
  pingDashboardDatabase,
  updateConnectGraphTargetStatus,
  upsertConnectGraphTarget,
  type ConnectGraphTargetRecord,
} from "$lib/server/neon";
import { looksLikeSurrealJwt, parseSurrealConnectionString } from "$lib/server/connect/connection-string";

export { parseSurrealConnectionString };

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

export function graphTargetRecordToApi(row: ConnectGraphTargetRecord): ConnectGraphTarget {
  const provider = row.provider === "postgres" ? "postgres" : "surreal";
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    provider,
    connection: {
      ...(row.endpoint ? { endpoint: row.endpoint } : {}),
      ...(row.namespace ? { namespace: row.namespace } : {}),
      ...(row.database ? { database: row.database } : {}),
      ...(row.username ? { username: row.username } : {}),
    },
    use_dashboard_database: row.useDashboardDatabase,
    secret_set: Boolean(row.secretCiphertext),
    status: row.status === "ok" ? "ok" : row.status === "error" ? "error" : "untested",
    ...(row.lastTestedAt ? { last_tested_at: msToIso(row.lastTestedAt) } : {}),
    ...(row.lastError ? { last_error: row.lastError } : {}),
    created_at: msToIso(row.createdAt),
    updated_at: msToIso(row.updatedAt),
  };
}

/**
 * One-click connect: use the dashboard's own Neon database as the graph spine.
 * Gated by `restormel-module-connect-neon-graph-store` (default off for MVP).
 * No credentials required — reuses the configured DATABASE_URL.
 */
export async function connectDashboardNeonTarget(workspaceId: string): Promise<ConnectGraphTarget> {
  const row = await upsertConnectGraphTarget({
    workspaceId,
    provider: "postgres",
    useDashboardDatabase: true,
    endpoint: null,
    namespace: null,
    database: null,
    username: null,
    status: "ok",
  });
  return graphTargetRecordToApi(row);
}

export async function getGraphTargetForUi(workspaceId: string): Promise<ConnectGraphTarget | null> {
  const row = await getConnectGraphTargetForWorkspace(workspaceId);
  return row ? graphTargetRecordToApi(row) : null;
}

export type GraphTargetSaveResult =
  | { ok: true; target: ConnectGraphTarget }
  | { ok: false; status: number; error: string; message: string };

export async function saveGraphTarget(
  workspaceId: string,
  input: ConnectGraphTargetUpsert,
): Promise<GraphTargetSaveResult> {
  const existing = await getConnectGraphTargetForWorkspace(workspaceId);
  let secretPayload:
    | { ciphertext: string; iv: string; authTag: string; encryptionVersion: number }
    | null
    | undefined;

  if (input.secret && input.secret.trim()) {
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
    const enc = encryptProviderSecret(input.secret.trim());
    if (!enc.ok) {
      return { ok: false, status: 503, error: "server_misconfigured", message: enc.error };
    }
    secretPayload = {
      ciphertext: enc.payload.ciphertextB64,
      iv: enc.payload.ivB64,
      authTag: enc.payload.authTagB64,
      encryptionVersion: enc.payload.encryptionVersion,
    };
  } else {
    // keep existing secret
    secretPayload = undefined;
  }

  if (!existing && secretPayload === undefined && !input.username) {
    // First-time save without auth material is allowed (anonymous Surreal), so no hard error here.
  }

  const row = await upsertConnectGraphTarget({
    workspaceId,
    provider: input.provider,
    endpoint: input.endpoint,
    namespace: input.namespace,
    database: input.database,
    username: input.username ?? null,
    secret: secretPayload,
  });
  return { ok: true, target: graphTargetRecordToApi(row) };
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
      });
    } catch (e) {
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
): Promise<{ ok: boolean; message: string }> {
  const row = await getConnectGraphTargetForWorkspace(workspaceId);
  if (!row) {
    return { ok: false, message: "No graph target configured for this workspace." };
  }

  if (row.provider === "postgres" && row.useDashboardDatabase) {
    try {
      const ok = await pingDashboardDatabase();
      await updateConnectGraphTargetStatus({
        workspaceId,
        status: ok ? "ok" : "error",
        lastError: ok ? null : "dashboard database unreachable",
      });
      return ok
        ? { ok: true, message: "Connected to this workspace's Neon database." }
        : { ok: false, message: "Dashboard database unreachable." };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection failed";
      await updateConnectGraphTargetStatus({ workspaceId, status: "error", lastError: msg.slice(0, 280) });
      return { ok: false, message: msg.slice(0, 280) };
    }
  }

  if (!row.endpoint || !row.namespace || !row.database) {
    await updateConnectGraphTargetStatus({
      workspaceId,
      status: "error",
      lastError: "incomplete Surreal connection",
    });
    return { ok: false, message: "Surreal target is missing endpoint, namespace, or database." };
  }
  const secret = decryptGraphTargetSecret(row);
  try {
    const result = await surrealHttpQuery({
      endpoint: row.endpoint,
      namespace: row.namespace,
      database: row.database,
      username: row.username,
      password: secret,
      sql: "RETURN true;",
    });
    if (result.ok) {
      await updateConnectGraphTargetStatus({ workspaceId, status: "ok", lastError: null });
      return { ok: true, message: "Connection succeeded." };
    }
    await updateConnectGraphTargetStatus({ workspaceId, status: "error", lastError: result.error });
    return { ok: false, message: result.error };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Connection failed";
    await updateConnectGraphTargetStatus({ workspaceId, status: "error", lastError: msg.slice(0, 280) });
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
  const result = await surrealHttpQuery({
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

/** Minimal Surreal HTTP /sql client (no driver dependency). */
export async function surrealHttpQuery(params: {
  endpoint: string;
  namespace: string;
  database: string;
  username?: string | null;
  password?: string | null;
  /** When set, skips sign-in / token resolution (used by cached graph store sessions). */
  bearerToken?: string | null;
  sql: string;
}): Promise<{ ok: true; data: unknown } | { ok: false; error: string }> {
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
    res = await fetch(url, { method: "POST", headers, body: params.sql });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
  if (!res.ok) {
    const hint =
      res.status === 401
        ? " Check credentials, or use a Surreal Cloud token (leave Username empty)."
        : "";
    return { ok: false, error: `Surreal HTTP ${res.status}${hint}` };
  }
  try {
    const data = (await res.json()) as unknown;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "Invalid Surreal response" };
  }
}
