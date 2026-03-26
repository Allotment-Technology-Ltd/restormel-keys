/**
 * Neon (Postgres) storage: workspaces, projects, environments, api_keys (Gateway keys).
 * No raw Gateway keys stored; prefix + hash only. See security-baseline.
 * Schema: 001_initial, 002_better_auth, 003_workspaces_and_environments.
 */
import { neon } from "@neondatabase/serverless";
import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "rk_";

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  createdAt: number;
  plan: "free" | "pro";
  /** Unix ms; Pro reverts after this unless NULL (paid / no calendar expiry). */
  planExpiresAt: number | null;
};

export type Project = {
  id: string;
  name: string;
  userId: string;
  workspaceId: string | null;
  createdAt: number;
};

export type Environment = {
  id: string;
  projectId: string;
  name: string;
  type: string;
  createdAt: number;
};

/** Gateway key record (Restormel auth). Stored as prefix + hash; table name api_keys for compatibility. */
export type ApiKeyRecord = {
  id: string;
  keyPrefix: string;
  keyHash: string;
  createdAt: number;
};

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

/** Max users who receive founding Pro on first workspace creation (default 50). 0 = disable new grants. */
export function foundingPromoMaxUsers(): number {
  const n = parseInt(process.env.FOUNDING_PROMO_MAX_USERS ?? "50", 10);
  if (!Number.isFinite(n) || n < 0) return 50;
  return Math.min(n, 100_000);
}

export function foundingPromoMonths(): number {
  const n = parseInt(process.env.FOUNDING_PROMO_MONTHS ?? "12", 10);
  if (!Number.isFinite(n) || n < 1) return 12;
  return Math.min(n, 120);
}

function addMonthsMillis(fromMs: number, months: number): number {
  const d = new Date(fromMs);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.getTime();
}

function rowToWorkspace(r: {
  id: string;
  name: string;
  slug: string;
  ownerUserId: string;
  createdAt: unknown;
  plan: string;
  planExpiresAt: unknown;
}): Workspace {
  const exp = r.planExpiresAt;
  const planExpiresAt =
    exp == null || exp === "" ? null : typeof exp === "bigint" ? Number(exp) : Number(exp);
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    ownerUserId: r.ownerUserId,
    createdAt: Number(r.createdAt),
    plan: (r.plan === "pro" ? "pro" : "free") as "free" | "pro",
    planExpiresAt: Number.isFinite(planExpiresAt) ? planExpiresAt : null,
  };
}

/** Signup order among Better Auth users (1 = earliest). Null if user not in "user" table. */
export async function getAuthUserSignupRank(userId: string): Promise<number | null> {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT sub.rn AS rn FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, id ASC) AS rn
        FROM "user"
      ) sub WHERE sub.id = ${userId} LIMIT 1
    `;
    const n = rows[0]?.rn;
    if (n == null) return null;
    return typeof n === "bigint" ? Number(n) : Number(n);
  } catch {
    return null;
  }
}

/** Ensure app-level users table has a row for authenticated user. */
export async function upsertUser(userId: string, email?: string | null): Promise<void> {
  const sql = getSql();
  const createdAt = Date.now();
  await sql`
    INSERT INTO users (id, email, created_at)
    VALUES (${userId}, ${email ?? null}, ${createdAt})
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email
    WHERE users.email IS DISTINCT FROM EXCLUDED.email
  `;
}

/** Get or create the default workspace for a user (one workspace per user for first rollout). */
export async function getOrCreateDefaultWorkspace(userId: string): Promise<Workspace> {
  const sql = getSql();
  const existing = await sql`
    SELECT id, name, slug, owner_user_id AS "ownerUserId", created_at AS "createdAt", plan,
           plan_expires_at AS "planExpiresAt"
    FROM workspaces
    WHERE owner_user_id = ${userId}
    ORDER BY created_at ASC
    LIMIT 1
  `;
  if (existing.length > 0) {
    const r = existing[0];
    return rowToWorkspace({
      id: r.id,
      name: r.name,
      slug: r.slug,
      ownerUserId: r.ownerUserId,
      createdAt: r.createdAt,
      plan: r.plan,
      planExpiresAt: r.planExpiresAt,
    });
  }
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await sql`
    INSERT INTO workspaces (id, name, slug, owner_user_id, created_at, plan, plan_updated_at, plan_expires_at)
    VALUES (${id}, 'Default', 'default', ${userId}, ${createdAt}, 'free', ${createdAt}, NULL)
  `;
  const cap = foundingPromoMaxUsers();
  if (cap > 0) {
    const rank = await getAuthUserSignupRank(userId);
    if (rank != null && rank <= cap) {
      const expiresAt = addMonthsMillis(Date.now(), foundingPromoMonths());
      const now = Date.now();
      await sql`
        UPDATE workspaces
        SET plan = 'pro', plan_updated_at = ${now}, plan_expires_at = ${expiresAt}
        WHERE id = ${id}
      `;
      return {
        id,
        name: "Default",
        slug: "default",
        ownerUserId: userId,
        createdAt,
        plan: "pro",
        planExpiresAt: expiresAt,
      };
    }
  }
  return {
    id,
    name: "Default",
    slug: "default",
    ownerUserId: userId,
    createdAt,
    plan: "free",
    planExpiresAt: null,
  };
}

export async function getWorkspace(workspaceId: string): Promise<Workspace | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, slug, owner_user_id AS "ownerUserId", created_at AS "createdAt", plan,
           plan_expires_at AS "planExpiresAt"
    FROM workspaces
    WHERE id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return rowToWorkspace({
    id: r.id,
    name: r.name,
    slug: r.slug,
    ownerUserId: r.ownerUserId,
    createdAt: r.createdAt,
    plan: r.plan,
    planExpiresAt: r.planExpiresAt,
  });
}

/** Time-limited Pro past expiry → Free (paid Pro keeps plan_expires_at NULL). */
export async function downgradeWorkspaceIfProExpired(workspaceId: string): Promise<void> {
  const sql = getSql();
  const now = Date.now();
  await sql`
    UPDATE workspaces
    SET plan = 'free',
        plan_updated_at = ${now},
        plan_expires_at = NULL
    WHERE id = ${workspaceId}
      AND plan = 'pro'
      AND plan_expires_at IS NOT NULL
      AND plan_expires_at <= ${now}
  `;
}

export async function setWorkspacePlan(params: {
  workspaceId: string;
  plan: "free" | "pro";
  /** null = paid Pro (no calendar expiry); number = founding-style expiry */
  planExpiresAt?: number | null;
  paddleCustomerId?: string | null;
  paddleTransactionId?: string | null;
  paddleSubscriptionId?: string | null;
  paddleSubscriptionStatus?: string | null;
}): Promise<void> {
  const sql = getSql();
  const now = Date.now();
  const exp =
    params.planExpiresAt === undefined
      ? undefined
      : params.planExpiresAt === null
        ? null
        : params.planExpiresAt;
  if (exp === undefined) {
    await sql`
      UPDATE workspaces
      SET plan = ${params.plan},
          plan_updated_at = ${now},
          paddle_customer_id = COALESCE(${params.paddleCustomerId ?? null}, paddle_customer_id),
          paddle_transaction_id = COALESCE(${params.paddleTransactionId ?? null}, paddle_transaction_id),
          paddle_subscription_id = COALESCE(${params.paddleSubscriptionId ?? null}, paddle_subscription_id),
          paddle_subscription_status = COALESCE(${params.paddleSubscriptionStatus ?? null}, paddle_subscription_status)
      WHERE id = ${params.workspaceId}
    `;
  } else {
    await sql`
      UPDATE workspaces
      SET plan = ${params.plan},
          plan_updated_at = ${now},
          plan_expires_at = ${exp},
          paddle_customer_id = COALESCE(${params.paddleCustomerId ?? null}, paddle_customer_id),
          paddle_transaction_id = COALESCE(${params.paddleTransactionId ?? null}, paddle_transaction_id),
          paddle_subscription_id = COALESCE(${params.paddleSubscriptionId ?? null}, paddle_subscription_id),
          paddle_subscription_status = COALESCE(${params.paddleSubscriptionStatus ?? null}, paddle_subscription_status)
      WHERE id = ${params.workspaceId}
    `;
  }
}

/** List projects for user (ownership via user_id; projects belong to user's workspace). */
export async function listProjects(userId: string): Promise<Project[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt"
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    userId: r.userId,
    workspaceId: r.workspaceId ?? null,
    createdAt: Number(r.createdAt),
  })) as Project[];
}

/** List projects in a workspace (for Management key scope). */
export async function listProjectsByWorkspace(workspaceId: string): Promise<Project[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt"
    FROM projects
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    userId: r.userId,
    workspaceId: r.workspaceId ?? null,
    createdAt: Number(r.createdAt),
  })) as Project[];
}

/** Get project if it belongs to the given workspace (for Management key scope). */
export async function getProjectInWorkspace(projectId: string, workspaceId: string): Promise<Project | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt"
    FROM projects
    WHERE id = ${projectId} AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    userId: r.userId,
    workspaceId: r.workspaceId ?? null,
    createdAt: Number(r.createdAt),
  } as Project;
}

/** Create project under user's default workspace; seeds dev and prod environments. */
export async function createProject(userId: string, name: string): Promise<Project> {
  const sql = getSql();
  const workspace = await getOrCreateDefaultWorkspace(userId);
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const projectName = name || "Unnamed project";
  await sql`
    INSERT INTO projects (id, name, user_id, workspace_id, created_at)
    VALUES (${id}, ${projectName}, ${userId}, ${workspace.id}, ${createdAt})
  `;
  const envCreatedAt = Date.now();
  await sql`
    INSERT INTO environments (id, project_id, name, type, created_at)
    VALUES
      (${crypto.randomUUID()}, ${id}, 'Development', 'dev', ${envCreatedAt}),
      (${crypto.randomUUID()}, ${id}, 'Production', 'prod', ${envCreatedAt})
  `;
  return { id, name: projectName, userId, workspaceId: workspace.id, createdAt };
}

/** Get project; returns null if not found or not owner */
export async function getProject(projectId: string, userId: string): Promise<Project | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt"
    FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    userId: r.userId,
    workspaceId: r.workspaceId ?? null,
    createdAt: Number(r.createdAt),
  } as Project;
}

/** Get project by id regardless of owner (use only after auth scope checks). */
export async function getProjectById(projectId: string): Promise<Project | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt"
    FROM projects
    WHERE id = ${projectId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    name: r.name,
    userId: r.userId,
    workspaceId: r.workspaceId ?? null,
    createdAt: Number(r.createdAt),
  } as Project;
}

/** List environments for a project (caller must own project). */
export async function listEnvironments(projectId: string, userId: string): Promise<Environment[]> {
  const project = await getProject(projectId, userId);
  if (!project) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT id, project_id AS "projectId", name, type, created_at AS "createdAt"
    FROM environments
    WHERE project_id = ${projectId}
    ORDER BY type ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    type: r.type,
    createdAt: Number(r.createdAt),
  })) as Environment[];
}

/** Get environment if it belongs to the project (for route creation). */
export async function getEnvironmentInProject(
  environmentId: string,
  projectId: string
): Promise<Environment | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, project_id AS "projectId", name, type, created_at AS "createdAt"
    FROM environments
    WHERE id = ${environmentId} AND project_id = ${projectId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, projectId: r.projectId, name: r.name, type: r.type, createdAt: Number(r.createdAt) } as Environment;
}

/** Update project name */
export async function updateProject(projectId: string, userId: string, name: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    UPDATE projects SET name = ${name}
    WHERE id = ${projectId} AND user_id = ${userId}
    RETURNING id
  `;
  return Array.isArray(rows) && rows.length > 0;
}

/** Delete project (and its Gateway keys in api_keys via FK CASCADE) */
export async function deleteProject(projectId: string, userId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM projects WHERE id = ${projectId} AND user_id = ${userId}
    RETURNING id
  `;
  return Array.isArray(rows) && rows.length > 0;
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

/** Result of verifying a Gateway key (Bearer). Used for programmatic API access. */
export type GatewayKeyContext = {
  keyId: string;
  projectId: string;
  userId: string;
};

/**
 * Verify a raw Gateway key and record last-used. Returns key context or null.
 * Uses same hash as create (SHA-256). Never log or expose raw key.
 */
export async function verifyGatewayKey(rawKey: string): Promise<GatewayKeyContext | null> {
  const keyHash = hashKey(rawKey);
  const sql = getSql();
  const rows = await sql`
    SELECT k.id AS "keyId", k.project_id AS "projectId", p.user_id AS "userId"
    FROM api_keys k
    INNER JOIN projects p ON k.project_id = p.id
    WHERE k.key_hash = ${keyHash}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as { keyId: string; projectId: string; userId: string };
  const now = Date.now();
  await sql`
    UPDATE api_keys SET last_used_at = ${now} WHERE id = ${r.keyId}
  `;
  return { keyId: r.keyId, projectId: r.projectId, userId: r.userId };
}

/** Result of verifying a Management key (Bearer). Workspace-scoped admin. */
export type ManagementKeyContext = {
  keyId: string;
  workspaceId: string;
};

/**
 * Verify a raw Management key and record last-used. Returns key context or null.
 * Only active keys (status = 'active' or null) are accepted.
 */
export async function verifyManagementKey(rawKey: string): Promise<ManagementKeyContext | null> {
  const keyHash = hashKey(rawKey);
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId"
    FROM management_keys
    WHERE key_hash = ${keyHash} AND (status IS NULL OR status = 'active')
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as { id: string; workspaceId: string };
  const now = Date.now();
  await sql`
    UPDATE management_keys SET last_used_at = ${now} WHERE id = ${r.id}
  `;
  return { keyId: r.id, workspaceId: r.workspaceId };
}

/** List Gateway keys for project (prefix only) */
export async function listApiKeys(projectId: string, userId: string): Promise<ApiKeyRecord[]> {
  const project = await getProject(projectId, userId);
  if (!project) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT id, key_prefix AS "keyPrefix", key_hash AS "keyHash", created_at AS "createdAt"
    FROM api_keys
    WHERE project_id = ${projectId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    keyPrefix: r.keyPrefix,
    keyHash: r.keyHash,
    createdAt: Number(r.createdAt),
  })) as ApiKeyRecord[];
}

/**
 * Create Gateway key. Returns { rawKey, keyPrefix } once; caller must show to user. Store only prefix + hash.
 */
export async function createApiKey(
  projectId: string,
  userId: string
): Promise<{ rawKey: string; keyPrefix: string } | null> {
  const project = await getProject(projectId, userId);
  if (!project) return null;
  const rawKey = KEY_PREFIX + randomBytes(24).toString("base64url");
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12) + "…";
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const sql = getSql();
  await sql`
    INSERT INTO api_keys (id, project_id, key_prefix, key_hash, created_at)
    VALUES (${id}, ${projectId}, ${keyPrefix}, ${keyHash}, ${createdAt})
  `;
  if (project.workspaceId) {
    try {
      await insertAuditEvent({
        workspaceId: project.workspaceId,
        actorId: userId,
        actorType: "user",
        eventType: "gateway_key_created",
        targetType: "gateway_key",
        targetId: id,
        summary: "Gateway key created",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      console.error("[audit] insertAuditEvent after create:", msg.slice(0, 80));
    }
  }
  return { rawKey, keyPrefix };
}

/** Revoke (delete) Gateway key */
export async function deleteApiKey(projectId: string, keyId: string, userId: string): Promise<boolean> {
  const project = await getProject(projectId, userId);
  if (!project) return false;
  const sql = getSql();
  const rows = await sql`
    DELETE FROM api_keys WHERE id = ${keyId} AND project_id = ${projectId}
    RETURNING id
  `;
  const deleted = Array.isArray(rows) && rows.length > 0;
  if (deleted && project.workspaceId) {
    try {
      await insertAuditEvent({
        workspaceId: project.workspaceId,
        actorId: userId,
        actorType: "user",
        eventType: "gateway_key_revoked",
        targetType: "gateway_key",
        targetId: keyId,
        summary: "Gateway key revoked",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      console.error("[audit] insertAuditEvent after revoke:", msg.slice(0, 80));
    }
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// Audit events (control-plane; used by key create/revoke)
// ---------------------------------------------------------------------------

export type AuditEventRecord = {
  id: string;
  workspaceId: string;
  actorId: string;
  actorType: string;
  eventType: string;
  targetType: string;
  targetId: string;
  summary?: string | null;
  createdAt: number;
};

/** Record an audit event. Requires audit_events table (migration 004). */
export async function insertAuditEvent(params: {
  workspaceId: string;
  actorId: string;
  actorType: string;
  eventType: string;
  targetType: string;
  targetId: string;
  summary?: string;
}): Promise<void> {
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await sql`
    INSERT INTO audit_events (id, workspace_id, actor_id, actor_type, event_type, target_type, target_id, summary, created_at)
    VALUES (${id}, ${params.workspaceId}, ${params.actorId}, ${params.actorType}, ${params.eventType}, ${params.targetType}, ${params.targetId}, ${params.summary ?? null}, ${createdAt})
  `;
}

/** List recent audit events for a workspace (caller must have access). */
export async function listAuditEvents(
  workspaceId: string,
  options: { limit?: number; since?: number } = {}
): Promise<AuditEventRecord[]> {
  const { limit = 50, since } = options;
  const sql = getSql();
  const rows = since
    ? await sql`
        SELECT id, workspace_id AS "workspaceId", actor_id AS "actorId", actor_type AS "actorType",
               event_type AS "eventType", target_type AS "targetType", target_id AS "targetId",
               summary, created_at AS "createdAt"
        FROM audit_events
        WHERE workspace_id = ${workspaceId} AND created_at >= ${since}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, workspace_id AS "workspaceId", actor_id AS "actorId", actor_type AS "actorType",
               event_type AS "eventType", target_type AS "targetType", target_id AS "targetId",
               summary, created_at AS "createdAt"
        FROM audit_events
        WHERE workspace_id = ${workspaceId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    actorId: r.actorId,
    actorType: r.actorType,
    eventType: r.eventType,
    targetType: r.targetType,
    targetId: r.targetId,
    summary: r.summary ?? undefined,
    createdAt: Number(r.createdAt),
  })) as AuditEventRecord[];
}

// ---------------------------------------------------------------------------
// Provider integrations (credential_ref only; no raw secrets)
// ---------------------------------------------------------------------------

export type ProviderIntegrationRecord = {
  id: string;
  workspaceId: string;
  providerType: string;
  displayName: string | null;
  status: string;
  verificationStatus: string | null;
  credentialRef: string | null;
  createdBy: string | null;
  createdAt: number;
  lastVerifiedAt: number | null;
  metadata: Record<string, unknown> | null;
  region: string | null;
};

export type ProviderBindingRecord = {
  id: string;
  providerIntegrationId: string;
  projectId: string;
  environmentId: string | null;
  status: string;
  usageMode: string | null;
  createdAt: number;
};

const PROVIDER_INTEGRATION_DEFAULT_STATUS = "active";

/** List provider integrations for a workspace. */
export async function listProviderIntegrations(workspaceId: string): Promise<ProviderIntegrationRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", provider_type AS "providerType", display_name AS "displayName",
           status, verification_status AS "verificationStatus", credential_ref AS "credentialRef",
           created_by AS "createdBy", created_at AS "createdAt", last_verified_at AS "lastVerifiedAt",
           metadata, region
    FROM provider_integrations
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    providerType: r.providerType,
    displayName: r.displayName ?? null,
    status: r.status ?? PROVIDER_INTEGRATION_DEFAULT_STATUS,
    verificationStatus: r.verificationStatus ?? null,
    credentialRef: r.credentialRef ?? null,
    createdBy: r.createdBy ?? null,
    createdAt: Number(r.createdAt),
    lastVerifiedAt: r.lastVerifiedAt != null ? Number(r.lastVerifiedAt) : null,
    metadata: r.metadata ?? null,
    region: r.region ?? null,
  })) as ProviderIntegrationRecord[];
}

/** Get one provider integration; returns null if not in workspace. */
export async function getProviderIntegration(
  id: string,
  workspaceId: string
): Promise<ProviderIntegrationRecord | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", provider_type AS "providerType", display_name AS "displayName",
           status, verification_status AS "verificationStatus", credential_ref AS "credentialRef",
           created_by AS "createdBy", created_at AS "createdAt", last_verified_at AS "lastVerifiedAt",
           metadata, region
    FROM provider_integrations
    WHERE id = ${id} AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    providerType: r.providerType,
    displayName: r.displayName ?? null,
    status: r.status ?? PROVIDER_INTEGRATION_DEFAULT_STATUS,
    verificationStatus: r.verificationStatus ?? null,
    credentialRef: r.credentialRef ?? null,
    createdBy: r.createdBy ?? null,
    createdAt: Number(r.createdAt),
    lastVerifiedAt: r.lastVerifiedAt != null ? Number(r.lastVerifiedAt) : null,
    metadata: r.metadata ?? null,
    region: r.region ?? null,
  } as ProviderIntegrationRecord;
}

/** Create provider integration. credentialRef only; no raw secrets. */
export async function createProviderIntegration(params: {
  workspaceId: string;
  providerType: string;
  displayName?: string;
  credentialRef?: string;
  createdBy?: string;
  actorId: string;
  actorType: string;
}): Promise<ProviderIntegrationRecord> {
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const status = PROVIDER_INTEGRATION_DEFAULT_STATUS;
  const displayName = params.displayName?.trim() || null;
  const credentialRef = params.credentialRef?.trim() || null;
  await sql`
    INSERT INTO provider_integrations (id, workspace_id, provider_type, display_name, status, credential_ref, created_by, created_at)
    VALUES (${id}, ${params.workspaceId}, ${params.providerType}, ${displayName}, ${status}, ${credentialRef}, ${params.createdBy ?? null}, ${createdAt})
  `;
  try {
    await insertAuditEvent({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorType: params.actorType,
      eventType: "provider_integration_created",
      targetType: "provider_integration",
      targetId: id,
      summary: `Provider integration created: ${params.providerType}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("[audit] insertAuditEvent after provider create:", msg.slice(0, 80));
  }
  const out = await getProviderIntegration(id, params.workspaceId);
  if (!out) throw new Error("Provider integration not found after insert");
  return out;
}

/** Update provider integration (display name, status, verification). No raw credential. */
export async function updateProviderIntegration(
  id: string,
  workspaceId: string,
  updates: {
    displayName?: string;
    status?: string;
    verificationStatus?: string;
    lastVerifiedAt?: number;
    metadata?: Record<string, unknown>;
    region?: string | null;
  },
  audit?: { actorId: string; actorType: string }
): Promise<ProviderIntegrationRecord | null> {
  const sql = getSql();
  const existing = await getProviderIntegration(id, workspaceId);
  if (!existing) return null;
  const displayName = updates.displayName !== undefined ? (updates.displayName?.trim() || null) : existing.displayName;
  const status = updates.status ?? existing.status;
  const verificationStatus = updates.verificationStatus !== undefined ? updates.verificationStatus : existing.verificationStatus;
  const lastVerifiedAt = updates.lastVerifiedAt !== undefined ? updates.lastVerifiedAt : existing.lastVerifiedAt;
  const metadata = updates.metadata !== undefined ? updates.metadata : existing.metadata;
  const region = updates.region !== undefined ? updates.region : existing.region;
  await sql`
    UPDATE provider_integrations
    SET display_name = ${displayName}, status = ${status}, verification_status = ${verificationStatus},
        last_verified_at = ${lastVerifiedAt}, metadata = ${metadata ? JSON.stringify(metadata) : null}, region = ${region}
    WHERE id = ${id} AND workspace_id = ${workspaceId}
  `;
  if (audit) {
    try {
      await insertAuditEvent({
        workspaceId,
        actorId: audit.actorId,
        actorType: audit.actorType,
        eventType: "provider_integration_updated",
        targetType: "provider_integration",
        targetId: id,
        summary: "Provider integration updated",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      console.error("[audit] insertAuditEvent after provider update:", msg.slice(0, 80));
    }
  }
  return getProviderIntegration(id, workspaceId);
}

/** Delete provider integration (cascade deletes bindings). */
export async function deleteProviderIntegration(
  id: string,
  workspaceId: string,
  audit?: { actorId: string; actorType: string }
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM provider_integrations WHERE id = ${id} AND workspace_id = ${workspaceId}
    RETURNING id
  `;
  const deleted = Array.isArray(rows) && rows.length > 0;
  if (deleted && audit) {
    try {
      await insertAuditEvent({
        workspaceId,
        actorId: audit.actorId,
        actorType: audit.actorType,
        eventType: "provider_integration_deleted",
        targetType: "provider_integration",
        targetId: id,
        summary: "Provider integration deleted",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      console.error("[audit] insertAuditEvent after provider delete:", msg.slice(0, 80));
    }
  }
  return deleted;
}

/** Update verification state (hook for provider-specific verification). */
export async function updateProviderVerification(
  id: string,
  workspaceId: string,
  status: string,
  actorId: string,
  actorType: string
): Promise<ProviderIntegrationRecord | null> {
  const now = Date.now();
  return updateProviderIntegration(
    id,
    workspaceId,
    { verificationStatus: status, lastVerifiedAt: now },
    { actorId, actorType }
  );
}

// ---------------------------------------------------------------------------
// Provider bindings (project/environment scope)
// ---------------------------------------------------------------------------

/** List bindings for an integration. */
export async function listProviderBindingsByIntegration(
  providerIntegrationId: string
): Promise<ProviderBindingRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, provider_integration_id AS "providerIntegrationId", project_id AS "projectId",
           environment_id AS "environmentId", status, usage_mode AS "usageMode", created_at AS "createdAt"
    FROM provider_bindings
    WHERE provider_integration_id = ${providerIntegrationId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    providerIntegrationId: r.providerIntegrationId,
    projectId: r.projectId,
    environmentId: r.environmentId ?? null,
    status: r.status ?? "active",
    usageMode: r.usageMode ?? null,
    createdAt: Number(r.createdAt),
  })) as ProviderBindingRecord[];
}

/** List bindings for a project (for frontend). */
export async function listProviderBindingsByProject(projectId: string): Promise<
  (ProviderBindingRecord & { integration?: ProviderIntegrationRecord })[]
> {
  const sql = getSql();
  const rows = await sql`
    SELECT pb.id, pb.provider_integration_id AS "providerIntegrationId", pb.project_id AS "projectId",
           pb.environment_id AS "environmentId", pb.status, pb.usage_mode AS "usageMode", pb.created_at AS "createdAt",
           pi.workspace_id AS "piWorkspaceId", pi.provider_type AS "providerType", pi.display_name AS "displayName",
           pi.status AS "piStatus", pi.verification_status AS "verificationStatus", pi.credential_ref AS "credentialRef",
           pi.created_by AS "createdBy", pi.created_at AS "piCreatedAt", pi.last_verified_at AS "lastVerifiedAt",
           pi.metadata AS "piMetadata", pi.region AS "piRegion"
    FROM provider_bindings pb
    INNER JOIN provider_integrations pi ON pb.provider_integration_id = pi.id
    WHERE pb.project_id = ${projectId}
    ORDER BY pb.created_at DESC
  `;
  return rows.map((r) => {
    const binding: ProviderBindingRecord = {
      id: r.id,
      providerIntegrationId: r.providerIntegrationId,
      projectId: r.projectId,
      environmentId: r.environmentId ?? null,
      status: r.status ?? "active",
      usageMode: r.usageMode ?? null,
      createdAt: Number(r.createdAt),
    };
    const integration: ProviderIntegrationRecord = {
      id: r.providerIntegrationId,
      workspaceId: r.piWorkspaceId,
      providerType: r.providerType,
      displayName: r.displayName ?? null,
      status: r.piStatus ?? "active",
      verificationStatus: r.verificationStatus ?? null,
      credentialRef: null,
      createdBy: r.createdBy ?? null,
      createdAt: Number(r.piCreatedAt),
      lastVerifiedAt: r.lastVerifiedAt != null ? Number(r.lastVerifiedAt) : null,
      metadata: r.piMetadata ?? null,
      region: r.piRegion ?? null,
    };
    return { ...binding, integration };
  });
}

/** Create a binding (link integration to project/environment). Project must be in the same workspace. */
export async function createProviderBinding(params: {
  providerIntegrationId: string;
  projectId: string;
  environmentId?: string | null;
  workspaceId: string;
  actorId: string;
  actorType: string;
}): Promise<ProviderBindingRecord | null> {
  const sql = getSql();
  const integration = await getProviderIntegration(params.providerIntegrationId, params.workspaceId);
  if (!integration) return null;
  const projectRows = await sql`
    SELECT id FROM projects WHERE id = ${params.projectId} AND workspace_id = ${params.workspaceId} LIMIT 1
  `;
  if (projectRows.length === 0) return null;
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const status = "active";
  await sql`
    INSERT INTO provider_bindings (id, provider_integration_id, project_id, environment_id, status, created_at)
    VALUES (${id}, ${params.providerIntegrationId}, ${params.projectId}, ${params.environmentId ?? null}, ${status}, ${createdAt})
  `;
  try {
    await insertAuditEvent({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorType: params.actorType,
      eventType: "provider_binding_created",
      targetType: "provider_binding",
      targetId: id,
      summary: `Provider bound to project`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("[audit] insertAuditEvent after binding create:", msg.slice(0, 80));
  }
  const rows = await sql`
    SELECT id, provider_integration_id AS "providerIntegrationId", project_id AS "projectId",
           environment_id AS "environmentId", status, usage_mode AS "usageMode", created_at AS "createdAt"
    FROM provider_bindings WHERE id = ${id}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    providerIntegrationId: r.providerIntegrationId,
    projectId: r.projectId,
    environmentId: r.environmentId ?? null,
    status: r.status ?? "active",
    usageMode: r.usageMode ?? null,
    createdAt: Number(r.createdAt),
  } as ProviderBindingRecord;
}

/** Delete a binding. */
export async function deleteProviderBinding(
  id: string,
  workspaceId: string,
  audit?: { actorId: string; actorType: string }
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM provider_bindings pb
    USING provider_integrations pi
    WHERE pb.id = ${id} AND pb.provider_integration_id = pi.id AND pi.workspace_id = ${workspaceId}
    RETURNING pb.id
  `;
  const deleted = Array.isArray(rows) && rows.length > 0;
  if (deleted && audit) {
    try {
      await insertAuditEvent({
        workspaceId,
        actorId: audit.actorId,
        actorType: audit.actorType,
        eventType: "provider_binding_deleted",
        targetType: "provider_binding",
        targetId: id,
        summary: "Provider binding removed",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      console.error("[audit] insertAuditEvent after binding delete:", msg.slice(0, 80));
    }
  }
  return deleted;
}

// ---------------------------------------------------------------------------
// Model catalog (read-only; ingestion later)
// ---------------------------------------------------------------------------

export type ModelRecord = {
  id: string;
  canonicalName: string;
  family: string | null;
  lifecycleState: string | null;
  description: string | null;
  modalities: string[] | null;
  capabilities: string[] | null;
  contextWindow: number | null;
  maxOutputTokens: number | null;
  supportsTools: boolean | null;
  supportsStructuredOutput: boolean | null;
  supportsMcp: boolean | null;
  editorialSummary: string | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  recommendedFor: string[] | null;
  avoidFor: string[] | null;
  deprecationDate: number | null;
  retirementDate: number | null;
  replacementModelId: string | null;
  sourceLastVerifiedAt: number | null;
};

export type ProviderModelVariantRecord = {
  id: string;
  modelId: string;
  providerIntegrationType: string;
  catalogProviderId: string | null;
  providerModelId: string;
  availabilityStatus: string | null;
  pricingRef: string | null;
  rateLimitRef: string | null;
  metadata: Record<string, unknown> | null;
  sourceLastVerifiedAt: number | null;
};

function mapModelRow(r: Record<string, unknown>): ModelRecord {
  return {
    id: r.id as string,
    canonicalName: r.canonicalName as string,
    family: (r.family as string) ?? null,
    lifecycleState: (r.lifecycleState as string) ?? null,
    description: (r.description as string) ?? null,
    modalities: (r.modalities as string[]) ?? null,
    capabilities: (r.capabilities as string[]) ?? null,
    contextWindow: r.contextWindow != null ? Number(r.contextWindow) : null,
    maxOutputTokens: r.maxOutputTokens != null ? Number(r.maxOutputTokens) : null,
    supportsTools: r.supportsTools != null ? Boolean(r.supportsTools) : null,
    supportsStructuredOutput: r.supportsStructuredOutput != null ? Boolean(r.supportsStructuredOutput) : null,
    supportsMcp: r.supportsMcp != null ? Boolean(r.supportsMcp) : null,
    editorialSummary: (r.editorialSummary as string) ?? null,
    strengths: (r.strengths as string[]) ?? null,
    weaknesses: (r.weaknesses as string[]) ?? null,
    recommendedFor: (r.recommendedFor as string[]) ?? null,
    avoidFor: (r.avoidFor as string[]) ?? null,
    deprecationDate: r.deprecationDate != null ? Number(r.deprecationDate) : null,
    retirementDate: r.retirementDate != null ? Number(r.retirementDate) : null,
    replacementModelId: (r.replacementModelId as string) ?? null,
    sourceLastVerifiedAt: r.sourceLastVerifiedAt != null ? Number(r.sourceLastVerifiedAt) : null,
  };
}

function mapVariantRow(r: Record<string, unknown>): ProviderModelVariantRecord {
  return {
    id: r.id as string,
    modelId: r.modelId as string,
    providerIntegrationType: r.providerIntegrationType as string,
    catalogProviderId: (r.catalogProviderId as string) ?? null,
    providerModelId: r.providerModelId as string,
    availabilityStatus: (r.availabilityStatus as string) ?? null,
    pricingRef: (r.pricingRef as string) ?? null,
    rateLimitRef: (r.rateLimitRef as string) ?? null,
    metadata: (r.metadata as Record<string, unknown>) ?? null,
    sourceLastVerifiedAt: r.sourceLastVerifiedAt != null ? Number(r.sourceLastVerifiedAt) : null,
  };
}

let ensuredCatalogProviderIdColumn: Promise<void> | null = null;

async function ensureCatalogProviderIdColumn(): Promise<void> {
  if (ensuredCatalogProviderIdColumn) return ensuredCatalogProviderIdColumn;
  ensuredCatalogProviderIdColumn = (async () => {
    const sql = getSql();
    await sql`ALTER TABLE provider_model_variants ADD COLUMN IF NOT EXISTS catalog_provider_id TEXT`;
    await sql`
      UPDATE provider_model_variants
      SET catalog_provider_id = provider_integration_type
      WHERE catalog_provider_id IS NULL
    `;
  })();
  return ensuredCatalogProviderIdColumn;
}

export type ListModelsFilters = {
  lifecycleState?: string;
  family?: string;
  limit?: number;
  offset?: number;
};

/** List models (catalog). Optional filter by lifecycleState, family; pagination via limit/offset. */
export async function listModels(filters: ListModelsFilters = {}): Promise<ModelRecord[]> {
  const sql = getSql();
  const { lifecycleState, family, limit = 100, offset = 0 } = filters;
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const safeOffset = Math.max(0, offset);
  if (lifecycleState != null && lifecycleState !== "" && family != null && family !== "") {
    const rows = await sql`
      SELECT id, canonical_name AS "canonicalName", family, lifecycle_state AS "lifecycleState",
             description, modalities, capabilities, context_window AS "contextWindow",
             max_output_tokens AS "maxOutputTokens", supports_tools AS "supportsTools",
             supports_structured_output AS "supportsStructuredOutput", supports_mcp AS "supportsMcp",
             editorial_summary AS "editorialSummary", strengths, weaknesses, recommended_for AS "recommendedFor",
             avoid_for AS "avoidFor", deprecation_date AS "deprecationDate", retirement_date AS "retirementDate",
             replacement_model_id AS "replacementModelId", source_last_verified_at AS "sourceLastVerifiedAt"
      FROM models
      WHERE lifecycle_state = ${lifecycleState} AND family = ${family}
      ORDER BY canonical_name ASC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    return (rows as Record<string, unknown>[]).map(mapModelRow);
  }
  if (lifecycleState != null && lifecycleState !== "") {
    const rows = await sql`
      SELECT id, canonical_name AS "canonicalName", family, lifecycle_state AS "lifecycleState",
             description, modalities, capabilities, context_window AS "contextWindow",
             max_output_tokens AS "maxOutputTokens", supports_tools AS "supportsTools",
             supports_structured_output AS "supportsStructuredOutput", supports_mcp AS "supportsMcp",
             editorial_summary AS "editorialSummary", strengths, weaknesses, recommended_for AS "recommendedFor",
             avoid_for AS "avoidFor", deprecation_date AS "deprecationDate", retirement_date AS "retirementDate",
             replacement_model_id AS "replacementModelId", source_last_verified_at AS "sourceLastVerifiedAt"
      FROM models
      WHERE lifecycle_state = ${lifecycleState}
      ORDER BY canonical_name ASC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    return (rows as Record<string, unknown>[]).map(mapModelRow);
  }
  if (family != null && family !== "") {
    const rows = await sql`
      SELECT id, canonical_name AS "canonicalName", family, lifecycle_state AS "lifecycleState",
             description, modalities, capabilities, context_window AS "contextWindow",
             max_output_tokens AS "maxOutputTokens", supports_tools AS "supportsTools",
             supports_structured_output AS "supportsStructuredOutput", supports_mcp AS "supportsMcp",
             editorial_summary AS "editorialSummary", strengths, weaknesses, recommended_for AS "recommendedFor",
             avoid_for AS "avoidFor", deprecation_date AS "deprecationDate", retirement_date AS "retirementDate",
             replacement_model_id AS "replacementModelId", source_last_verified_at AS "sourceLastVerifiedAt"
      FROM models
      WHERE family = ${family}
      ORDER BY canonical_name ASC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    return (rows as Record<string, unknown>[]).map(mapModelRow);
  }
  const rows = await sql`
    SELECT id, canonical_name AS "canonicalName", family, lifecycle_state AS "lifecycleState",
           description, modalities, capabilities, context_window AS "contextWindow",
           max_output_tokens AS "maxOutputTokens", supports_tools AS "supportsTools",
           supports_structured_output AS "supportsStructuredOutput", supports_mcp AS "supportsMcp",
           editorial_summary AS "editorialSummary", strengths, weaknesses, recommended_for AS "recommendedFor",
           avoid_for AS "avoidFor", deprecation_date AS "deprecationDate", retirement_date AS "retirementDate",
           replacement_model_id AS "replacementModelId", source_last_verified_at AS "sourceLastVerifiedAt"
    FROM models
    ORDER BY canonical_name ASC
    LIMIT ${safeLimit} OFFSET ${safeOffset}
  `;
  return (rows as Record<string, unknown>[]).map(mapModelRow);
}

/** Get one model by id. */
export async function getModel(id: string): Promise<ModelRecord | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, canonical_name AS "canonicalName", family, lifecycle_state AS "lifecycleState",
           description, modalities, capabilities, context_window AS "contextWindow",
           max_output_tokens AS "maxOutputTokens", supports_tools AS "supportsTools",
           supports_structured_output AS "supportsStructuredOutput", supports_mcp AS "supportsMcp",
           editorial_summary AS "editorialSummary", strengths, weaknesses, recommended_for AS "recommendedFor",
           avoid_for AS "avoidFor", deprecation_date AS "deprecationDate", retirement_date AS "retirementDate",
           replacement_model_id AS "replacementModelId", source_last_verified_at AS "sourceLastVerifiedAt"
    FROM models
    WHERE id = ${id}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapModelRow(rows[0] as Record<string, unknown>);
}

/** Lifecycle-only view for warnings (deprecated/retiring models in use). */
export type ModelLifecycleInfo = {
  id: string;
  canonicalName: string;
  lifecycleState: string | null;
  deprecationDate: number | null;
  retirementDate: number | null;
  replacementModelId: string | null;
  sourceLastVerifiedAt: number | null;
};

/** Get lifecycle fields for multiple model IDs. Returns only existing models. Used to warn when routes use deprecated/retiring models. */
export async function getModelsLifecycleByIds(ids: string[]): Promise<ModelLifecycleInfo[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];
  const models = await Promise.all(unique.map((id) => getModel(id)));
  return models
    .filter((m): m is ModelRecord => m != null)
    .map((m) => ({
      id: m.id,
      canonicalName: m.canonicalName,
      lifecycleState: m.lifecycleState,
      deprecationDate: m.deprecationDate,
      retirementDate: m.retirementDate,
      replacementModelId: m.replacementModelId,
      sourceLastVerifiedAt: m.sourceLastVerifiedAt,
    }));
}

/** List provider model variants for a model. */
export async function listProviderModelVariants(modelId: string): Promise<ProviderModelVariantRecord[]> {
  await ensureCatalogProviderIdColumn();
  const sql = getSql();
  const rows = await sql`
    SELECT id, model_id AS "modelId", provider_integration_type AS "providerIntegrationType",
           catalog_provider_id AS "catalogProviderId",
           provider_model_id AS "providerModelId", availability_status AS "availabilityStatus",
           pricing_ref AS "pricingRef", rate_limit_ref AS "rateLimitRef", metadata,
           source_last_verified_at AS "sourceLastVerifiedAt"
    FROM provider_model_variants
    WHERE model_id = ${modelId}
    ORDER BY provider_integration_type ASC, provider_model_id ASC
  `;
  return (rows as Record<string, unknown>[]).map(mapVariantRow);
}

/** List provider model variants for many models in one query. */
export async function listProviderModelVariantsByModelIds(
  modelIds: string[]
): Promise<ProviderModelVariantRecord[]> {
  await ensureCatalogProviderIdColumn();
  const sql = getSql();
  const uniqueModelIds = Array.from(new Set(modelIds.map((id) => id.trim()).filter(Boolean)));
  if (uniqueModelIds.length === 0) return [];
  const rows = await sql`
    SELECT id, model_id AS "modelId", provider_integration_type AS "providerIntegrationType",
           catalog_provider_id AS "catalogProviderId",
           provider_model_id AS "providerModelId", availability_status AS "availabilityStatus",
           pricing_ref AS "pricingRef", rate_limit_ref AS "rateLimitRef", metadata,
           source_last_verified_at AS "sourceLastVerifiedAt"
    FROM provider_model_variants
    WHERE model_id = ANY(${uniqueModelIds})
    ORDER BY model_id ASC, provider_integration_type ASC, provider_model_id ASC
  `;
  return (rows as Record<string, unknown>[]).map(mapVariantRow);
}

// ---------------------------------------------------------------------------
// Project model index (per-project bindings for selectors / host merges)
// ---------------------------------------------------------------------------

let ensuredProjectModelBindingsSchema: Promise<void> | null = null;

async function ensureProjectModelBindingsSchema(): Promise<void> {
  if (ensuredProjectModelBindingsSchema) return ensuredProjectModelBindingsSchema;
  ensuredProjectModelBindingsSchema = (async () => {
    const sql = getSql();
    await sql`
      CREATE TABLE IF NOT EXISTS project_model_bindings (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        provider_type TEXT NOT NULL,
        model_id TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT true,
        binding_kind TEXT NOT NULL DEFAULT 'execution',
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        CONSTRAINT uq_project_model_binding UNIQUE (project_id, provider_type, model_id)
      )
    `;
    await sql`
      ALTER TABLE project_model_bindings
      ADD COLUMN IF NOT EXISTS binding_kind TEXT NOT NULL DEFAULT 'execution'
    `;
    await sql`
      ALTER TABLE project_model_bindings
      DROP CONSTRAINT IF EXISTS project_model_bindings_model_id_fkey
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_project_model_bindings_project
      ON project_model_bindings(project_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_project_model_bindings_project_enabled
      ON project_model_bindings(project_id, enabled)
    `;
  })();
  return ensuredProjectModelBindingsSchema;
}

export type ProjectModelBindingKind = "execution" | "registry";

export type ProjectModelBindingRecord = {
  id: string;
  projectId: string;
  providerType: string;
  modelId: string;
  enabled: boolean;
  bindingKind: ProjectModelBindingKind;
  createdAt: string;
  updatedAt: string;
};

function mapProjectModelBindingRow(r: Record<string, unknown>): ProjectModelBindingRecord {
  const ca = Number(r.createdAt ?? 0);
  const ua = Number(r.updatedAt ?? 0);
  const bk = r.bindingKind === "registry" ? "registry" : "execution";
  return {
    id: r.id as string,
    projectId: r.projectId as string,
    providerType: r.providerType as string,
    modelId: r.modelId as string,
    enabled: r.enabled !== false,
    bindingKind: bk,
    createdAt: new Date(ca).toISOString(),
    updatedAt: new Date(ua).toISOString(),
  };
}

/** List all bindings for a project (enabled and disabled). */
export async function listProjectModelBindings(projectId: string): Promise<ProjectModelBindingRecord[]> {
  await ensureProjectModelBindingsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, project_id AS "projectId", provider_type AS "providerType",
           model_id AS "modelId", enabled, binding_kind AS "bindingKind",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM project_model_bindings
    WHERE project_id = ${projectId}
    ORDER BY provider_type ASC, model_id ASC
  `;
  return (rows as Record<string, unknown>[]).map(mapProjectModelBindingRow);
}

export async function getProjectModelBinding(
  bindingId: string,
  projectId: string
): Promise<ProjectModelBindingRecord | null> {
  await ensureProjectModelBindingsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, project_id AS "projectId", provider_type AS "providerType",
           model_id AS "modelId", enabled, binding_kind AS "bindingKind",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM project_model_bindings
    WHERE id = ${bindingId} AND project_id = ${projectId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapProjectModelBindingRow(rows[0] as Record<string, unknown>);
}

/**
 * Insert or update binding; on conflict re-enables, updates binding_kind, and bumps updated_at (idempotent add).
 */
export async function upsertProjectModelBinding(
  projectId: string,
  canonicalProviderType: string,
  modelId: string,
  bindingKind: ProjectModelBindingKind = "execution"
): Promise<ProjectModelBindingRecord> {
  await ensureProjectModelBindingsSchema();
  const sql = getSql();
  const now = Date.now();
  const newId = crypto.randomUUID();
  const rows = await sql`
    INSERT INTO project_model_bindings (id, project_id, provider_type, model_id, enabled, binding_kind, created_at, updated_at)
    VALUES (${newId}, ${projectId}, ${canonicalProviderType}, ${modelId}, true, ${bindingKind}, ${now}, ${now})
    ON CONFLICT (project_id, provider_type, model_id) DO UPDATE SET
      enabled = true,
      binding_kind = ${bindingKind},
      updated_at = ${now}
    RETURNING id, project_id AS "projectId", provider_type AS "providerType",
      model_id AS "modelId", enabled, binding_kind AS "bindingKind",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  return mapProjectModelBindingRow(rows[0] as Record<string, unknown>);
}

export async function updateProjectModelBindingEnabled(
  bindingId: string,
  projectId: string,
  enabled: boolean
): Promise<ProjectModelBindingRecord | null> {
  await ensureProjectModelBindingsSchema();
  const sql = getSql();
  const now = Date.now();
  const rows = await sql`
    UPDATE project_model_bindings
    SET enabled = ${enabled}, updated_at = ${now}
    WHERE id = ${bindingId} AND project_id = ${projectId}
    RETURNING id, project_id AS "projectId", provider_type AS "providerType",
      model_id AS "modelId", enabled, binding_kind AS "bindingKind",
      created_at AS "createdAt", updated_at AS "updatedAt"
  `;
  if (rows.length === 0) return null;
  return mapProjectModelBindingRow(rows[0] as Record<string, unknown>);
}

export async function deleteProjectModelBinding(bindingId: string, projectId: string): Promise<boolean> {
  await ensureProjectModelBindingsSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM project_model_bindings
    WHERE id = ${bindingId} AND project_id = ${projectId}
    RETURNING id
  `;
  return Array.isArray(rows) && rows.length > 0;
}

/** Replace all bindings for a project (declarative sync). */
export async function replaceProjectModelBindings(
  projectId: string,
  items: {
    canonicalProviderType: string;
    modelId: string;
    enabled: boolean;
    bindingKind?: ProjectModelBindingKind;
  }[]
): Promise<ProjectModelBindingRecord[]> {
  await ensureProjectModelBindingsSchema();
  const sql = getSql();
  await sql`DELETE FROM project_model_bindings WHERE project_id = ${projectId}`;
  const now = Date.now();
  const out: ProjectModelBindingRecord[] = [];
  for (const it of items) {
    const id = crypto.randomUUID();
    const kind: ProjectModelBindingKind = it.bindingKind === "registry" ? "registry" : "execution";
    const rows = await sql`
      INSERT INTO project_model_bindings (id, project_id, provider_type, model_id, enabled, binding_kind, created_at, updated_at)
      VALUES (${id}, ${projectId}, ${it.canonicalProviderType}, ${it.modelId}, ${it.enabled}, ${kind}, ${now}, ${now})
      RETURNING id, project_id AS "projectId", provider_type AS "providerType",
        model_id AS "modelId", enabled, binding_kind AS "bindingKind",
        created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    out.push(mapProjectModelBindingRow(rows[0] as Record<string, unknown>));
  }
  return out;
}

export type CatalogModelObservationRecord = {
  catalogProviderId: string;
  providerModelId: string;
  deprecatedReportCount: number;
  retiredReportCount: number;
  firstReportedAt: number | null;
  lastReportedAt: number | null;
};

/** Upsert aggregated crowd observation for a (provider, provider model id) pair. */
export async function upsertCatalogModelObservation(params: {
  catalogProviderId: string;
  providerModelId: string;
  signal: "deprecated" | "retired";
  workspaceId: string | null;
  providerHttpStatus?: number | null;
  providerErrorCode?: string | null;
}): Promise<void> {
  const sql = getSql();
  const now = Date.now();
  const incDep = params.signal === "deprecated" ? 1 : 0;
  const incRet = params.signal === "retired" ? 1 : 0;
  const code =
    typeof params.providerErrorCode === "string" ? params.providerErrorCode.trim().slice(0, 128) : null;
  const http =
    typeof params.providerHttpStatus === "number" && Number.isFinite(params.providerHttpStatus)
      ? Math.trunc(params.providerHttpStatus)
      : null;

  const isMissingSchema = (e: unknown): boolean => {
    const code = (e as { code?: unknown } | null)?.code;
    return code === "42P01" || code === "42703";
  };
  try {
    await sql`
      INSERT INTO catalog_model_observations (
        catalog_provider_id,
        provider_model_id,
        deprecated_report_count,
        retired_report_count,
        first_reported_at,
        last_reported_at,
        last_report_workspace_id,
        last_provider_http_status,
        last_provider_error_code
      ) VALUES (
        ${params.catalogProviderId},
        ${params.providerModelId},
        ${incDep},
        ${incRet},
        ${now},
        ${now},
        ${params.workspaceId},
        ${http},
        ${code}
      )
      ON CONFLICT (catalog_provider_id, provider_model_id) DO UPDATE SET
        deprecated_report_count = catalog_model_observations.deprecated_report_count + ${incDep},
        retired_report_count = catalog_model_observations.retired_report_count + ${incRet},
        first_reported_at = COALESCE(catalog_model_observations.first_reported_at, EXCLUDED.first_reported_at),
        last_reported_at = EXCLUDED.last_reported_at,
        last_report_workspace_id = EXCLUDED.last_report_workspace_id,
        last_provider_http_status = EXCLUDED.last_provider_http_status,
        last_provider_error_code = EXCLUDED.last_provider_error_code
    `;
  } catch (e) {
    // If the observation table doesn't exist yet in this environment, treat as no-op.
    if (isMissingSchema(e)) return;
    throw e;
  }
}

/** Load crowd observations for catalog merge (keyed by `providerId\\tproviderModelId`). */
export async function listCatalogModelObservationsForPairs(
  pairs: { catalogProviderId: string; providerModelId: string }[]
): Promise<Map<string, CatalogModelObservationRecord>> {
  const sql = getSql();
  const unique = Array.from(
    new Map(
      pairs
        .map((p) => ({
          catalogProviderId: p.catalogProviderId.trim(),
          providerModelId: p.providerModelId.trim(),
        }))
        .filter((p) => p.catalogProviderId.length > 0 && p.providerModelId.length > 0)
        .map((p) => [`${p.catalogProviderId}\t${p.providerModelId}`, p] as const)
    ).values()
  );
  if (unique.length === 0) return new Map();

  const keys = unique.map((p) => `${p.catalogProviderId}\t${p.providerModelId}`);
  // Degrade gracefully when migrations haven't been applied yet (common in older envs).
  // This keeps public catalog read paths working even if `catalog_model_observations` is missing.
  const isMissingSchema = (e: unknown): boolean => {
    const code = (e as { code?: unknown } | null)?.code;
    return code === "42P01" || code === "42703";
  };

  let rows: unknown[] = [];
  try {
    rows = await sql`
      SELECT catalog_provider_id AS "catalogProviderId",
             provider_model_id AS "providerModelId",
             deprecated_report_count AS "deprecatedReportCount",
             retired_report_count AS "retiredReportCount",
             first_reported_at AS "firstReportedAt",
             last_reported_at AS "lastReportedAt"
      FROM catalog_model_observations
      WHERE (catalog_provider_id || E'\t' || provider_model_id) = ANY(${keys})
    `;
  } catch (e) {
    if (isMissingSchema(e)) return new Map();
    throw e;
  }

  const out = new Map<string, CatalogModelObservationRecord>();
  for (const r of rows as Record<string, unknown>[]) {
    const cp = r.catalogProviderId as string;
    const pm = r.providerModelId as string;
    out.set(`${cp}\t${pm}`, {
      catalogProviderId: cp,
      providerModelId: pm,
      deprecatedReportCount: Number(r.deprecatedReportCount ?? 0),
      retiredReportCount: Number(r.retiredReportCount ?? 0),
      firstReportedAt: r.firstReportedAt != null ? Number(r.firstReportedAt) : null,
      lastReportedAt: r.lastReportedAt != null ? Number(r.lastReportedAt) : null,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Routes (project/environment-scoped; first-class backend objects)
// ---------------------------------------------------------------------------

let ensuredIngestionRoutingSchema: Promise<void> | null = null;

/**
 * Self-heal for older environments where migrations 012/013 were not applied yet.
 * Keeps runtime routing endpoints operational instead of failing with undefined-column errors.
 */
async function ensureIngestionRoutingSchema(): Promise<void> {
  if (ensuredIngestionRoutingSchema) return ensuredIngestionRoutingSchema;
  ensuredIngestionRoutingSchema = (async () => {
    const sql = getSql();
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS enabled BOOLEAN DEFAULT true`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS published_version INTEGER DEFAULT 1`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS stage TEXT`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS workload TEXT`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS updated_via TEXT`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS updated_by TEXT`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS change_summary TEXT`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS content_hash TEXT`;
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS label TEXT`;
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS switch_criteria JSONB`;
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS retry_policy JSONB`;
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS cost_policy JSONB`;
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS notes TEXT`;
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS created_at BIGINT`;
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
    await sql`
      UPDATE route_steps
      SET created_at = COALESCE(created_at, EXTRACT(EPOCH FROM now())::BIGINT * 1000),
          updated_at = COALESCE(updated_at, EXTRACT(EPOCH FROM now())::BIGINT * 1000)
      WHERE created_at IS NULL OR updated_at IS NULL
    `;
    await sql`ALTER TABLE route_steps ALTER COLUMN created_at SET NOT NULL`;
    await sql`ALTER TABLE route_steps ALTER COLUMN updated_at SET NOT NULL`;
    await sql`ALTER TABLE policies ADD COLUMN IF NOT EXISTS updated_at BIGINT`;
    await sql`ALTER TABLE policies ADD COLUMN IF NOT EXISTS updated_via TEXT`;
    await sql`ALTER TABLE policies ADD COLUMN IF NOT EXISTS updated_by TEXT`;
    await sql`ALTER TABLE policies ADD COLUMN IF NOT EXISTS change_summary TEXT`;
    await sql`ALTER TABLE policies ADD COLUMN IF NOT EXISTS content_hash TEXT`;
    await sql`
      UPDATE routes
      SET
        updated_via = COALESCE(updated_via, 'system'),
        updated_by = COALESCE(updated_by, created_by, 'system'),
        change_summary = COALESCE(change_summary, 'Backfilled provenance defaults'),
        content_hash = COALESCE(content_hash, md5(COALESCE(id, '') || ':' || COALESCE(updated_at::text, '0')))
      WHERE updated_via IS NULL
         OR updated_by IS NULL
         OR change_summary IS NULL
         OR content_hash IS NULL
    `;
    await sql`
      UPDATE policies
      SET updated_at = COALESCE(updated_at, created_at)
      WHERE updated_at IS NULL
    `;
    await sql`
      UPDATE policies
      SET
        updated_via = COALESCE(updated_via, 'system'),
        updated_by = COALESCE(updated_by, created_by, 'system'),
        change_summary = COALESCE(change_summary, 'Backfilled provenance defaults'),
        content_hash = COALESCE(content_hash, md5(COALESCE(id, '') || ':' || COALESCE(updated_at::text, '0')))
      WHERE updated_via IS NULL
         OR updated_by IS NULL
         OR change_summary IS NULL
         OR content_hash IS NULL
    `;
    await sql`ALTER TABLE policies ALTER COLUMN updated_at SET NOT NULL`;
    await sql`
      CREATE TABLE IF NOT EXISTS route_version_events (
        id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT,
        actor_type TEXT,
        summary TEXT,
        route_snapshot JSONB,
        steps_snapshot JSONB,
        metadata JSONB,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_route_version_events_route_created
      ON route_version_events(route_id, created_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_route_version_events_project_route_version
      ON route_version_events(project_id, route_id, version)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS policy_version_events (
        id TEXT PRIMARY KEY,
        policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        version INTEGER NOT NULL,
        action TEXT NOT NULL,
        actor_id TEXT,
        actor_type TEXT,
        summary TEXT,
        policy_snapshot JSONB,
        metadata JSONB,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_policy_version_events_policy_created
      ON policy_version_events(policy_id, created_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_policy_version_events_workspace_policy_version
      ON policy_version_events(workspace_id, policy_id, version)
    `;
  })();
  return ensuredIngestionRoutingSchema;
}

export type RouteRecord = {
  id: string;
  projectId: string;
  environmentId: string;
  name: string;
  description: string | null;
  defaultModelId: string | null;
  billingMode: string | null;
  routeMode: string | null;
  /**
   * Ingestion control-plane fields (optional / additive).
   * When null, this route behaves like a legacy "generic" route.
   */
  stage?: string | null;
  workload?: string | null;
  /** Whether this route is enabled in the control plane. */
  enabled?: boolean;
  /** Draft/publish lifecycle placeholders (not yet full step snapshot versioning). */
  version?: number;
  publishedVersion?: number;
  status: string;
  createdBy: string | null;
  updatedVia?: string | null;
  updatedBy?: string | null;
  changeSummary?: string | null;
  contentHash?: string | null;
  createdAt: number;
  updatedAt: number;
};

export type RouteStepRecord = {
  id: string;
  routeId: string;
  orderIndex: number;
  providerPreference: string | null;
  modelId: string | null;
  /** Optional label for mixer-panel UIs. */
  label?: string | null;
  /** Switch criteria contract (stored JSON). */
  switchCriteria?: Record<string, unknown> | null;
  /** Retry policy contract (stored JSON). */
  retryPolicy?: Record<string, unknown> | null;
  /** Cost policy contract (stored JSON). */
  costPolicy?: Record<string, unknown> | null;
  conditionBlock: Record<string, unknown> | null;
  fallbackOn: string | null;
  timeoutMs: number | null;
  /** Optional notes field for operator UX. */
  notes?: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
};

const ROUTE_DEFAULT_STATUS = "active";
function stableContentHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");
}

/** List routes for a project; optional filter by environmentId. */
export async function listRoutes(
  projectId: string,
  userId: string,
  options?: { environmentId?: string; workload?: string; stage?: string }
): Promise<RouteRecord[]> {
  await ensureIngestionRoutingSchema();
  const project = await getProject(projectId, userId);
  if (!project) return [];
  const sql = getSql();
  const envFilter = options?.environmentId;
  const workloadFilter = options?.workload;
  const stageFilter = options?.stage;

  // The SQL template tag supports parameter interpolation, but we keep the query as simple as possible
  // by branching on which filters exist.
  let rows;
  if (envFilter && workloadFilter && stageFilter) {
    rows = await sql`
      SELECT id, project_id AS "projectId", environment_id AS "environmentId", name, description,
             default_model_id AS "defaultModelId", billing_mode AS "billingMode", route_mode AS "routeMode",
             stage, workload, enabled, version, published_version AS "publishedVersion",
             status, created_by AS "createdBy", updated_via AS "updatedVia", updated_by AS "updatedBy",
             change_summary AS "changeSummary", content_hash AS "contentHash",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM routes
      WHERE project_id = ${projectId} AND environment_id = ${envFilter} AND workload = ${workloadFilter} AND stage = ${stageFilter}
      ORDER BY created_at DESC
    `;
  } else if (envFilter && workloadFilter) {
    rows = await sql`
      SELECT id, project_id AS "projectId", environment_id AS "environmentId", name, description,
             default_model_id AS "defaultModelId", billing_mode AS "billingMode", route_mode AS "routeMode",
             stage, workload, enabled, version, published_version AS "publishedVersion",
             status, created_by AS "createdBy", updated_via AS "updatedVia", updated_by AS "updatedBy",
             change_summary AS "changeSummary", content_hash AS "contentHash",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM routes
      WHERE project_id = ${projectId} AND environment_id = ${envFilter} AND workload = ${workloadFilter}
      ORDER BY created_at DESC
    `;
  } else if (envFilter && stageFilter) {
    rows = await sql`
      SELECT id, project_id AS "projectId", environment_id AS "environmentId", name, description,
             default_model_id AS "defaultModelId", billing_mode AS "billingMode", route_mode AS "routeMode",
             stage, workload, enabled, version, published_version AS "publishedVersion",
             status, created_by AS "createdBy", updated_via AS "updatedVia", updated_by AS "updatedBy",
             change_summary AS "changeSummary", content_hash AS "contentHash",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM routes
      WHERE project_id = ${projectId} AND environment_id = ${envFilter} AND stage = ${stageFilter}
      ORDER BY created_at DESC
    `;
  } else if (envFilter) {
    rows = await sql`
      SELECT id, project_id AS "projectId", environment_id AS "environmentId", name, description,
             default_model_id AS "defaultModelId", billing_mode AS "billingMode", route_mode AS "routeMode",
             stage, workload, enabled, version, published_version AS "publishedVersion",
             status, created_by AS "createdBy", updated_via AS "updatedVia", updated_by AS "updatedBy",
             change_summary AS "changeSummary", content_hash AS "contentHash",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM routes
      WHERE project_id = ${projectId} AND environment_id = ${envFilter}
      ORDER BY created_at DESC
    `;
  } else {
    rows = await sql`
      SELECT id, project_id AS "projectId", environment_id AS "environmentId", name, description,
             default_model_id AS "defaultModelId", billing_mode AS "billingMode", route_mode AS "routeMode",
             stage, workload, enabled, version, published_version AS "publishedVersion",
             status, created_by AS "createdBy", updated_via AS "updatedVia", updated_by AS "updatedBy",
             change_summary AS "changeSummary", content_hash AS "contentHash",
             created_at AS "createdAt", updated_at AS "updatedAt"
      FROM routes
      WHERE project_id = ${projectId}
      ORDER BY created_at DESC
    `;
  }
  return rows.map((r) => mapRouteRow(r)) as RouteRecord[];
}

/** Get one route; returns null if not in project. */
export async function getRoute(id: string, projectId: string, userId: string): Promise<RouteRecord | null> {
  await ensureIngestionRoutingSchema();
  const project = await getProject(projectId, userId);
  if (!project) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT id, project_id AS "projectId", environment_id AS "environmentId", name, description,
           default_model_id AS "defaultModelId", billing_mode AS "billingMode", route_mode AS "routeMode",
           stage, workload, enabled, version, published_version AS "publishedVersion",
           status, created_by AS "createdBy", updated_via AS "updatedVia", updated_by AS "updatedBy",
           change_summary AS "changeSummary", content_hash AS "contentHash",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM routes
    WHERE id = ${id} AND project_id = ${projectId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapRouteRow(rows[0]) as RouteRecord;
}

function mapRouteRow(r: Record<string, unknown>): RouteRecord {
  return {
    id: r.id as string,
    projectId: r.projectId as string,
    environmentId: r.environmentId as string,
    name: r.name as string,
    description: (r.description as string) ?? null,
    defaultModelId: (r.defaultModelId as string) ?? null,
    billingMode: (r.billingMode as string) ?? null,
    routeMode: (r.routeMode as string) ?? null,
    stage: (r.stage as string) ?? null,
    workload: (r.workload as string) ?? null,
    enabled: r.enabled !== false,
    version: typeof r.version === "number" ? r.version : Number(r.version ?? 1),
    publishedVersion:
      typeof r.publishedVersion === "number" ? r.publishedVersion : Number(r.publishedVersion ?? 1),
    status: (r.status as string) ?? ROUTE_DEFAULT_STATUS,
    createdBy: (r.createdBy as string) ?? null,
    updatedVia: (r.updatedVia as string) ?? null,
    updatedBy: (r.updatedBy as string) ?? null,
    changeSummary: (r.changeSummary as string) ?? null,
    contentHash: (r.contentHash as string) ?? null,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt),
  };
}

/** Create route. Environment must belong to project; caller must own project. */
export async function createRoute(params: {
  projectId: string;
  environmentId: string;
  name: string;
  description?: string;
  defaultModelId?: string | null;
  billingMode?: string | null;
  routeMode?: string | null;
  stage?: string | null;
  workload?: string | null;
  enabled?: boolean;
  version?: number;
  publishedVersion?: number;
  updatedVia?: string | null;
  changeSummary?: string | null;
  userId: string;
}): Promise<RouteRecord | null> {
  await ensureIngestionRoutingSchema();
  const project = await getProject(params.projectId, params.userId);
  if (!project) return null;
  const env = await getEnvironmentInProject(params.environmentId, params.projectId);
  if (!env) return null;
  const sql = getSql();
  const id = crypto.randomUUID();
  const now = Date.now();
  const name = params.name?.trim() || "Unnamed route";
  const contentHash = stableContentHash({
    name,
    description: params.description?.trim() || null,
    defaultModelId: params.defaultModelId ?? null,
    billingMode: params.billingMode ?? null,
    routeMode: params.routeMode ?? null,
    stage: params.stage ?? null,
    workload: params.workload ?? null,
    enabled: params.enabled ?? true,
    version: params.version ?? 1,
    publishedVersion: params.publishedVersion ?? 1,
  });
  await sql`
    INSERT INTO routes (
      id, project_id, environment_id, name, description, default_model_id, billing_mode, route_mode,
      stage, workload, enabled, version, published_version,
      updated_via, updated_by, change_summary, content_hash,
      status, created_by, created_at, updated_at
    )
    VALUES (
      ${id}, ${params.projectId}, ${params.environmentId}, ${name},
      ${params.description?.trim() || null},
      ${params.defaultModelId ?? null},
      ${params.billingMode ?? null},
      ${params.routeMode ?? null},
      ${params.stage ?? null},
      ${params.workload ?? null},
      ${params.enabled ?? true},
      ${params.version ?? 1},
      ${params.publishedVersion ?? 1},
      ${params.updatedVia ?? "api"},
      ${params.userId},
      ${params.changeSummary ?? "Route created"},
      ${contentHash},
      ${ROUTE_DEFAULT_STATUS},
      ${params.userId}, ${now}, ${now}
    )
  `;
  return getRoute(id, params.projectId, params.userId);
}

/** Update route. */
export async function updateRoute(
  id: string,
  projectId: string,
  userId: string,
  updates: {
    name?: string;
    description?: string | null;
    defaultModelId?: string | null;
    billingMode?: string | null;
    routeMode?: string | null;
    stage?: string | null;
    workload?: string | null;
    enabled?: boolean;
    version?: number;
    publishedVersion?: number;
    status?: string;
    updatedVia?: string | null;
    updatedBy?: string | null;
    changeSummary?: string | null;
  }
): Promise<RouteRecord | null> {
  await ensureIngestionRoutingSchema();
  const existing = await getRoute(id, projectId, userId);
  if (!existing) return null;
  const sql = getSql();
  const name = updates.name !== undefined ? (updates.name.trim() || existing.name) : existing.name;
  const description = updates.description !== undefined ? (updates.description?.trim() || null) : existing.description;
  const defaultModelId = updates.defaultModelId !== undefined ? updates.defaultModelId : existing.defaultModelId;
  const billingMode = updates.billingMode !== undefined ? updates.billingMode : existing.billingMode;
  const routeMode = updates.routeMode !== undefined ? updates.routeMode : existing.routeMode;
  const stage = updates.stage !== undefined ? updates.stage : existing.stage;
  const workload = updates.workload !== undefined ? updates.workload : existing.workload;
  const enabled = updates.enabled !== undefined ? updates.enabled : (existing.enabled ?? true);
  const version = updates.version !== undefined ? updates.version : (existing.version ?? 1);
  const publishedVersion =
    updates.publishedVersion !== undefined ? updates.publishedVersion : (existing.publishedVersion ?? 1);
  const status = updates.status ?? existing.status;
  const now = Date.now();
  const contentHash = stableContentHash({
    name,
    description,
    defaultModelId,
    billingMode,
    routeMode,
    stage,
    workload,
    enabled,
    version,
    publishedVersion,
    status,
  });
  await sql`
    UPDATE routes
    SET name = ${name},
        description = ${description},
        default_model_id = ${defaultModelId},
        billing_mode = ${billingMode},
        route_mode = ${routeMode},
        stage = ${stage},
        workload = ${workload},
        enabled = ${enabled},
        version = ${version},
        published_version = ${publishedVersion},
        status = ${status},
        updated_via = ${updates.updatedVia ?? "api"},
        updated_by = ${updates.updatedBy ?? userId},
        change_summary = ${updates.changeSummary ?? "Route updated"},
        content_hash = ${contentHash},
        updated_at = ${now}
    WHERE id = ${id} AND project_id = ${projectId}
  `;
  return getRoute(id, projectId, userId);
}

/** Delete route (cascade deletes steps). Caller must have project access. */
export async function deleteRoute(id: string, projectId: string, userId: string): Promise<boolean> {
  const project = await getProject(projectId, userId);
  if (!project) return false;
  const sql = getSql();
  const rows = await sql`
    DELETE FROM routes WHERE id = ${id} AND project_id = ${projectId}
    RETURNING id
  `;
  return Array.isArray(rows) && rows.length > 0;
}

/** List steps for a route (caller must have access to route's project). */
export async function listRouteSteps(routeId: string, projectId: string, userId: string): Promise<RouteStepRecord[]> {
  await ensureIngestionRoutingSchema();
  const route = await getRoute(routeId, projectId, userId);
  if (!route) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT id, route_id AS "routeId", order_index AS "orderIndex", provider_preference AS "providerPreference",
           model_id AS "modelId", condition_block AS "conditionBlock", fallback_on AS "fallbackOn",
           timeout_ms AS "timeoutMs", enabled,
           label, switch_criteria AS "switchCriteria", retry_policy AS "retryPolicy", cost_policy AS "costPolicy",
           notes,
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM route_steps
    WHERE route_id = ${routeId}
    ORDER BY order_index ASC
  `;
  return rows.map((r) => mapRouteStepRow(r)) as RouteStepRecord[];
}

function mapRouteStepRow(r: Record<string, unknown>): RouteStepRecord {
  const createdAt = Number(r.createdAt ?? 0);
  const updatedAt = Number(r.updatedAt ?? 0);
  return {
    id: r.id as string,
    routeId: r.routeId as string,
    orderIndex: Number(r.orderIndex),
    providerPreference: (r.providerPreference as string) ?? null,
    modelId: (r.modelId as string) ?? null,
    label: (r.label as string) ?? null,
    switchCriteria: (r.switchCriteria as Record<string, unknown>) ?? null,
    retryPolicy: (r.retryPolicy as Record<string, unknown>) ?? null,
    costPolicy: (r.costPolicy as Record<string, unknown>) ?? null,
    conditionBlock: (r.conditionBlock as Record<string, unknown>) ?? null,
    fallbackOn: (r.fallbackOn as string) ?? null,
    timeoutMs: r.timeoutMs != null ? Number(r.timeoutMs) : null,
    notes: (r.notes as string) ?? null,
    enabled: r.enabled !== false,
    createdAt: new Date(createdAt).toISOString(),
    updatedAt: new Date(updatedAt).toISOString(),
  };
}

/** Create route step (fallback behaviour: fallbackOn string; orderIndex for ordering). */
export async function createRouteStep(params: {
  routeId: string;
  projectId: string;
  userId: string;
  orderIndex: number;
  providerPreference?: string | null;
  modelId?: string | null;
  label?: string | null;
  switchCriteria?: Record<string, unknown> | null;
  retryPolicy?: Record<string, unknown> | null;
  costPolicy?: Record<string, unknown> | null;
  conditionBlock?: Record<string, unknown> | null;
  fallbackOn?: string | null;
  timeoutMs?: number | null;
  notes?: string | null;
  enabled?: boolean;
}): Promise<RouteStepRecord | null> {
  await ensureIngestionRoutingSchema();
  const route = await getRoute(params.routeId, params.projectId, params.userId);
  if (!route) return null;
  const sql = getSql();
  const id = crypto.randomUUID();
  const enabled = params.enabled !== false;
  const now = Date.now();
  await sql`
    INSERT INTO route_steps (
      id, route_id, order_index, provider_preference, model_id,
      condition_block, fallback_on, timeout_ms,
      label, switch_criteria, retry_policy, cost_policy, notes,
      enabled, created_at, updated_at
    )
    VALUES (
      ${id}, ${params.routeId}, ${params.orderIndex},
      ${params.providerPreference ?? null}, ${params.modelId ?? null},
      ${params.conditionBlock ? JSON.stringify(params.conditionBlock) : null}, ${params.fallbackOn ?? null}, ${params.timeoutMs ?? null},
      ${params.label ?? null},
      ${params.switchCriteria ? JSON.stringify(params.switchCriteria) : null},
      ${params.retryPolicy ? JSON.stringify(params.retryPolicy) : null},
      ${params.costPolicy ? JSON.stringify(params.costPolicy) : null},
      ${params.notes ?? null},
      ${enabled}, ${now}, ${now}
    )
  `;
  const rows = await sql`
    SELECT id, route_id AS "routeId", order_index AS "orderIndex", provider_preference AS "providerPreference",
           model_id AS "modelId", condition_block AS "conditionBlock", fallback_on AS "fallbackOn",
           timeout_ms AS "timeoutMs", enabled,
           label, switch_criteria AS "switchCriteria", retry_policy AS "retryPolicy", cost_policy AS "costPolicy",
           notes,
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM route_steps WHERE id = ${id}
  `;
  if (rows.length === 0) return null;
  return mapRouteStepRow(rows[0]) as RouteStepRecord;
}

/** Update route step. */
export async function updateRouteStep(
  stepId: string,
  routeId: string,
  projectId: string,
  userId: string,
  updates: Partial<{
    orderIndex: number;
    providerPreference: string | null;
    modelId: string | null;
    label: string | null;
    switchCriteria: Record<string, unknown> | null;
    retryPolicy: Record<string, unknown> | null;
    costPolicy: Record<string, unknown> | null;
    conditionBlock: Record<string, unknown> | null;
    fallbackOn: string | null;
    timeoutMs: number | null;
    notes: string | null;
    enabled: boolean;
  }>
): Promise<RouteStepRecord | null> {
  await ensureIngestionRoutingSchema();
  const steps = await listRouteSteps(routeId, projectId, userId);
  const step = steps.find((s) => s.id === stepId);
  if (!step) return null;
  const sql = getSql();
  const orderIndex = updates.orderIndex !== undefined ? updates.orderIndex : step.orderIndex;
  const providerPreference = updates.providerPreference !== undefined ? updates.providerPreference : step.providerPreference;
  const modelId = updates.modelId !== undefined ? updates.modelId : step.modelId;
  const label = updates.label !== undefined ? updates.label : step.label;
  const switchCriteria = updates.switchCriteria !== undefined ? updates.switchCriteria : step.switchCriteria;
  const retryPolicy = updates.retryPolicy !== undefined ? updates.retryPolicy : step.retryPolicy;
  const costPolicy = updates.costPolicy !== undefined ? updates.costPolicy : step.costPolicy;
  const conditionBlock = updates.conditionBlock !== undefined ? updates.conditionBlock : step.conditionBlock;
  const fallbackOn = updates.fallbackOn !== undefined ? updates.fallbackOn : step.fallbackOn;
  const timeoutMs = updates.timeoutMs !== undefined ? updates.timeoutMs : step.timeoutMs;
  const notes = updates.notes !== undefined ? updates.notes : step.notes;
  const enabled = updates.enabled !== undefined ? updates.enabled : step.enabled;
  const now = Date.now();
  await sql`
    UPDATE route_steps
    SET order_index = ${orderIndex},
        provider_preference = ${providerPreference},
        model_id = ${modelId},
        label = ${label},
        switch_criteria = ${switchCriteria != null ? JSON.stringify(switchCriteria) : null},
        retry_policy = ${retryPolicy != null ? JSON.stringify(retryPolicy) : null},
        cost_policy = ${costPolicy != null ? JSON.stringify(costPolicy) : null},
        notes = ${notes},
        condition_block = ${conditionBlock != null ? JSON.stringify(conditionBlock) : null},
        fallback_on = ${fallbackOn},
        timeout_ms = ${timeoutMs},
        enabled = ${enabled},
        updated_at = ${now}
    WHERE id = ${stepId} AND route_id = ${routeId}
  `;
  const rows = await sql`
    SELECT id, route_id AS "routeId", order_index AS "orderIndex", provider_preference AS "providerPreference",
           model_id AS "modelId", condition_block AS "conditionBlock", fallback_on AS "fallbackOn",
           timeout_ms AS "timeoutMs", enabled,
           label, switch_criteria AS "switchCriteria", retry_policy AS "retryPolicy", cost_policy AS "costPolicy",
           notes,
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM route_steps WHERE id = ${stepId}
  `;
  if (rows.length === 0) return null;
  return mapRouteStepRow(rows[0]) as RouteStepRecord;
}

/** Delete route step. */
export async function deleteRouteStep(
  stepId: string,
  routeId: string,
  projectId: string,
  userId: string
): Promise<boolean> {
  const route = await getRoute(routeId, projectId, userId);
  if (!route) return false;
  const sql = getSql();
  const rows = await sql`
    DELETE FROM route_steps WHERE id = ${stepId} AND route_id = ${routeId}
    RETURNING id
  `;
  return Array.isArray(rows) && rows.length > 0;
}

/** Get route with steps for resolution/logging (caller must have project access). */
export async function getRouteWithSteps(
  routeId: string,
  projectId: string,
  userId: string
): Promise<{ route: RouteRecord; steps: RouteStepRecord[] } | null> {
  const route = await getRoute(routeId, projectId, userId);
  if (!route) return null;
  const steps = await listRouteSteps(routeId, projectId, userId);
  return { route, steps };
}

export type RouteVersionEventRecord = {
  id: string;
  routeId: string;
  projectId: string;
  version: number;
  action: "publish" | "rollback";
  actorId: string | null;
  actorType: string | null;
  summary: string | null;
  routeSnapshot: Record<string, unknown> | null;
  stepsSnapshot: Record<string, unknown>[] | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
};

export async function insertRouteVersionEvent(params: {
  routeId: string;
  projectId: string;
  version: number;
  action: "publish" | "rollback";
  actorId?: string | null;
  actorType?: string | null;
  summary?: string | null;
  routeSnapshot?: Record<string, unknown> | null;
  stepsSnapshot?: Record<string, unknown>[] | null;
  metadata?: Record<string, unknown> | null;
}): Promise<RouteVersionEventRecord> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await sql`
    INSERT INTO route_version_events (
      id, route_id, project_id, version, action, actor_id, actor_type, summary,
      route_snapshot, steps_snapshot, metadata, created_at
    )
    VALUES (
      ${id}, ${params.routeId}, ${params.projectId}, ${params.version}, ${params.action},
      ${params.actorId ?? null}, ${params.actorType ?? null}, ${params.summary ?? null},
      ${params.routeSnapshot ? JSON.stringify(params.routeSnapshot) : null},
      ${params.stepsSnapshot ? JSON.stringify(params.stepsSnapshot) : null},
      ${params.metadata ? JSON.stringify(params.metadata) : null},
      ${createdAt}
    )
  `;
  const rows = await sql`
    SELECT id, route_id AS "routeId", project_id AS "projectId", version, action, actor_id AS "actorId",
           actor_type AS "actorType", summary, route_snapshot AS "routeSnapshot",
           steps_snapshot AS "stepsSnapshot", metadata, created_at AS "createdAt"
    FROM route_version_events
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] as RouteVersionEventRecord;
}

export async function listRouteVersionEvents(
  routeId: string,
  projectId: string,
  userId: string,
  limit = 50
): Promise<RouteVersionEventRecord[]> {
  await ensureIngestionRoutingSchema();
  const route = await getRoute(routeId, projectId, userId);
  if (!route) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT id, route_id AS "routeId", project_id AS "projectId", version, action, actor_id AS "actorId",
           actor_type AS "actorType", summary, route_snapshot AS "routeSnapshot",
           steps_snapshot AS "stepsSnapshot", metadata, created_at AS "createdAt"
    FROM route_version_events
    WHERE route_id = ${routeId} AND project_id = ${projectId}
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(200, limit))}
  `;
  return rows as RouteVersionEventRecord[];
}

export async function getRouteVersionEventByVersion(
  routeId: string,
  projectId: string,
  userId: string,
  version: number
): Promise<RouteVersionEventRecord | null> {
  await ensureIngestionRoutingSchema();
  const route = await getRoute(routeId, projectId, userId);
  if (!route) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT id, route_id AS "routeId", project_id AS "projectId", version, action, actor_id AS "actorId",
           actor_type AS "actorType", summary, route_snapshot AS "routeSnapshot",
           steps_snapshot AS "stepsSnapshot", metadata, created_at AS "createdAt"
    FROM route_version_events
    WHERE route_id = ${routeId} AND project_id = ${projectId} AND version = ${version}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows.length ? (rows[0] as RouteVersionEventRecord) : null;
}

export async function replaceRouteStepsFromSnapshot(params: {
  routeId: string;
  projectId: string;
  userId: string;
  stepsSnapshot: Record<string, unknown>[];
}): Promise<RouteStepRecord[] | null> {
  await ensureIngestionRoutingSchema();
  const route = await getRoute(params.routeId, params.projectId, params.userId);
  if (!route) return null;
  const sql = getSql();
  await sql`DELETE FROM route_steps WHERE route_id = ${params.routeId}`;
  for (const raw of params.stepsSnapshot) {
    const id = typeof raw.id === "string" ? raw.id : crypto.randomUUID();
    const orderIndex = Number(raw.orderIndex ?? 0);
    const enabled = raw.enabled !== false;
    const now = Date.now();
    await sql`
      INSERT INTO route_steps (
        id, route_id, order_index, provider_preference, model_id, condition_block, fallback_on,
        timeout_ms, enabled, label, switch_criteria, retry_policy, cost_policy, notes, created_at, updated_at
      )
      VALUES (
        ${id}, ${params.routeId}, ${orderIndex},
        ${typeof raw.providerPreference === "string" ? raw.providerPreference : null},
        ${typeof raw.modelId === "string" ? raw.modelId : null},
        ${raw.conditionBlock ? JSON.stringify(raw.conditionBlock) : null},
        ${typeof raw.fallbackOn === "string" ? raw.fallbackOn : null},
        ${typeof raw.timeoutMs === "number" ? raw.timeoutMs : null},
        ${enabled},
        ${typeof raw.label === "string" ? raw.label : null},
        ${raw.switchCriteria ? JSON.stringify(raw.switchCriteria) : null},
        ${raw.retryPolicy ? JSON.stringify(raw.retryPolicy) : null},
        ${raw.costPolicy ? JSON.stringify(raw.costPolicy) : null},
        ${typeof raw.notes === "string" ? raw.notes : null},
        ${now},
        ${now}
      )
    `;
  }
  return listRouteSteps(params.routeId, params.projectId, params.userId);
}

// ---------------------------------------------------------------------------
// Policies (workspace-scoped; explicit rule shapes)
// ---------------------------------------------------------------------------

export type PolicyRecord = {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  status: string;
  ruleDefinition: Record<string, unknown> | null;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  updatedVia: string | null;
  updatedBy: string | null;
  changeSummary: string | null;
  contentHash: string | null;
};

export type PolicyVersionEventRecord = {
  id: string;
  policyId: string;
  workspaceId: string;
  version: number;
  action: "publish" | "rollback" | "update";
  actorId: string | null;
  actorType: string | null;
  summary: string | null;
  policySnapshot: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
};

export type PolicyBindingRecord = {
  id: string;
  policyId: string;
  targetType: string;
  targetId: string;
  createdAt: number;
};

/** Rule shapes: modelIds or providerTypes arrays; budget/token use limit (placeholder). */
export type PolicyRuleShape =
  | { modelIds?: string[] }
  | { providerTypes?: string[] }
  | { limit?: number };

const POLICY_DEFAULT_STATUS = "active";

/** List policies for workspace. */
export async function listPolicies(workspaceId: string): Promise<PolicyRecord[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", name, type, status, rule_definition AS "ruleDefinition",
           created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt",
           updated_via AS "updatedVia", updated_by AS "updatedBy", change_summary AS "changeSummary",
           content_hash AS "contentHash"
    FROM policies
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    name: r.name,
    type: r.type,
    status: r.status ?? POLICY_DEFAULT_STATUS,
    ruleDefinition: r.ruleDefinition ?? null,
    createdBy: r.createdBy ?? null,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt ?? r.createdAt),
    updatedVia: r.updatedVia ?? null,
    updatedBy: r.updatedBy ?? null,
    changeSummary: r.changeSummary ?? null,
    contentHash: r.contentHash ?? null,
  })) as PolicyRecord[];
}

/** Get one policy. */
export async function getPolicy(id: string, workspaceId: string): Promise<PolicyRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", name, type, status, rule_definition AS "ruleDefinition",
           created_by AS "createdBy", created_at AS "createdAt", updated_at AS "updatedAt",
           updated_via AS "updatedVia", updated_by AS "updatedBy", change_summary AS "changeSummary",
           content_hash AS "contentHash"
    FROM policies
    WHERE id = ${id} AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    workspaceId: r.workspaceId,
    name: r.name,
    type: r.type,
    status: r.status ?? POLICY_DEFAULT_STATUS,
    ruleDefinition: r.ruleDefinition ?? null,
    createdBy: r.createdBy ?? null,
    createdAt: Number(r.createdAt),
    updatedAt: Number(r.updatedAt ?? r.createdAt),
    updatedVia: r.updatedVia ?? null,
    updatedBy: r.updatedBy ?? null,
    changeSummary: r.changeSummary ?? null,
    contentHash: r.contentHash ?? null,
  } as PolicyRecord;
}

/** Create policy. */
export async function createPolicy(params: {
  workspaceId: string;
  name: string;
  type: string;
  ruleDefinition?: Record<string, unknown> | null;
  createdBy?: string;
  actorId: string;
  actorType: string;
  updatedVia?: string;
  changeSummary?: string;
}): Promise<PolicyRecord> {
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const status = POLICY_DEFAULT_STATUS;
  const name = params.name?.trim() || "Unnamed policy";
  const contentHash = stableContentHash({
    name,
    type: params.type,
    status,
    ruleDefinition: params.ruleDefinition ?? null,
  });
  await sql`
    INSERT INTO policies (
      id, workspace_id, name, type, status, rule_definition, created_by, created_at,
      updated_at, updated_via, updated_by, change_summary, content_hash
    )
    VALUES (${id}, ${params.workspaceId}, ${name}, ${params.type}, ${status},
            ${params.ruleDefinition ? JSON.stringify(params.ruleDefinition) : null}, ${params.createdBy ?? null}, ${createdAt},
            ${createdAt}, ${params.updatedVia ?? "api"}, ${params.actorId},
            ${params.changeSummary ?? "Policy created"}, ${contentHash})
  `;
  try {
    await insertAuditEvent({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorType: params.actorType,
      eventType: "policy_created",
      targetType: "policy",
      targetId: id,
      summary: `Policy created: ${name}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("[audit] policy create:", msg.slice(0, 80));
  }
  const out = await getPolicy(id, params.workspaceId);
  if (!out) throw new Error("Policy not found after insert");
  return out;
}

/** Update policy. */
export async function updatePolicy(
  id: string,
  workspaceId: string,
  updates: {
    name?: string;
    type?: string;
    status?: string;
    ruleDefinition?: Record<string, unknown> | null;
    updatedVia?: string | null;
    updatedBy?: string | null;
    changeSummary?: string | null;
  }
): Promise<PolicyRecord | null> {
  const existing = await getPolicy(id, workspaceId);
  if (!existing) return null;
  const sql = getSql();
  const name = updates.name !== undefined ? (updates.name.trim() || existing.name) : existing.name;
  const type = updates.type ?? existing.type;
  const status = updates.status ?? existing.status;
  const ruleDefinition = updates.ruleDefinition !== undefined ? updates.ruleDefinition : existing.ruleDefinition;
  const now = Date.now();
  const contentHash = stableContentHash({ name, type, status, ruleDefinition });
  await sql`
    UPDATE policies
    SET name = ${name},
        type = ${type},
        status = ${status},
        rule_definition = ${ruleDefinition ? JSON.stringify(ruleDefinition) : null},
        updated_at = ${now},
        updated_via = ${updates.updatedVia ?? "api"},
        updated_by = ${updates.updatedBy ?? null},
        change_summary = ${updates.changeSummary ?? "Policy updated"},
        content_hash = ${contentHash}
    WHERE id = ${id} AND workspace_id = ${workspaceId}
  `;
  return getPolicy(id, workspaceId);
}

export async function listPolicyVersionEvents(
  policyId: string,
  workspaceId: string,
  limit = 50
): Promise<PolicyVersionEventRecord[]> {
  await ensureIngestionRoutingSchema();
  const policy = await getPolicy(policyId, workspaceId);
  if (!policy) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT id, policy_id AS "policyId", workspace_id AS "workspaceId", version, action,
           actor_id AS "actorId", actor_type AS "actorType", summary,
           policy_snapshot AS "policySnapshot", metadata, created_at AS "createdAt"
    FROM policy_version_events
    WHERE policy_id = ${policyId} AND workspace_id = ${workspaceId}
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(200, limit))}
  `;
  return rows as PolicyVersionEventRecord[];
}

export async function getPolicyVersionEventByVersion(
  policyId: string,
  workspaceId: string,
  version: number
): Promise<PolicyVersionEventRecord | null> {
  await ensureIngestionRoutingSchema();
  const policy = await getPolicy(policyId, workspaceId);
  if (!policy) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT id, policy_id AS "policyId", workspace_id AS "workspaceId", version, action,
           actor_id AS "actorId", actor_type AS "actorType", summary,
           policy_snapshot AS "policySnapshot", metadata, created_at AS "createdAt"
    FROM policy_version_events
    WHERE policy_id = ${policyId} AND workspace_id = ${workspaceId} AND version = ${version}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows.length ? (rows[0] as PolicyVersionEventRecord) : null;
}

export async function insertPolicyVersionEvent(params: {
  policyId: string;
  workspaceId: string;
  version: number;
  action: "publish" | "rollback" | "update";
  actorId?: string | null;
  actorType?: string | null;
  summary?: string | null;
  policySnapshot?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
}): Promise<PolicyVersionEventRecord> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await sql`
    INSERT INTO policy_version_events (
      id, policy_id, workspace_id, version, action, actor_id, actor_type, summary,
      policy_snapshot, metadata, created_at
    )
    VALUES (
      ${id}, ${params.policyId}, ${params.workspaceId}, ${params.version}, ${params.action},
      ${params.actorId ?? null}, ${params.actorType ?? null}, ${params.summary ?? null},
      ${params.policySnapshot ? JSON.stringify(params.policySnapshot) : null},
      ${params.metadata ? JSON.stringify(params.metadata) : null},
      ${createdAt}
    )
  `;
  const rows = await sql`
    SELECT id, policy_id AS "policyId", workspace_id AS "workspaceId", version, action,
           actor_id AS "actorId", actor_type AS "actorType", summary,
           policy_snapshot AS "policySnapshot", metadata, created_at AS "createdAt"
    FROM policy_version_events
    WHERE id = ${id}
    LIMIT 1
  `;
  return rows[0] as PolicyVersionEventRecord;
}

/** Delete policy (cascade deletes bindings). */
export async function deletePolicy(id: string, workspaceId: string): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM policies WHERE id = ${id} AND workspace_id = ${workspaceId}
    RETURNING id
  `;
  return Array.isArray(rows) && rows.length > 0;
}

/** List bindings for a policy. */
export async function listPolicyBindings(policyId: string, workspaceId: string): Promise<PolicyBindingRecord[]> {
  const policy = await getPolicy(policyId, workspaceId);
  if (!policy) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT id, policy_id AS "policyId", target_type AS "targetType", target_id AS "targetId", created_at AS "createdAt"
    FROM policy_bindings
    WHERE policy_id = ${policyId}
    ORDER BY created_at ASC
  `;
  return rows.map((r) => ({
    id: r.id,
    policyId: r.policyId,
    targetType: r.targetType,
    targetId: r.targetId,
    createdAt: Number(r.createdAt),
  })) as PolicyBindingRecord[];
}

/** List bindings for a target (e.g. all policies bound to a project). */
export async function listPolicyBindingsByTarget(
  targetType: string,
  targetId: string,
  workspaceId: string
): Promise<(PolicyBindingRecord & { policy?: PolicyRecord })[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT pb.id, pb.policy_id AS "policyId", pb.target_type AS "targetType", pb.target_id AS "targetId", pb.created_at AS "createdAt",
           p.workspace_id AS "pWorkspaceId", p.name AS "pName", p.type AS "pType", p.status AS "pStatus", p.rule_definition AS "pRuleDefinition", p.created_by AS "pCreatedBy", p.created_at AS "pCreatedAt"
    FROM policy_bindings pb
    INNER JOIN policies p ON pb.policy_id = p.id
    WHERE pb.target_type = ${targetType} AND pb.target_id = ${targetId} AND p.workspace_id = ${workspaceId}
    ORDER BY pb.created_at ASC
  `;
  return rows.map((r) => {
    const binding = {
      id: r.id,
      policyId: r.policyId,
      targetType: r.targetType,
      targetId: r.targetId,
      createdAt: Number(r.createdAt),
    } as PolicyBindingRecord;
    const policy = {
      id: r.policyId,
      workspaceId: r.pWorkspaceId,
      name: r.pName,
      type: r.pType,
      status: r.pStatus ?? POLICY_DEFAULT_STATUS,
      ruleDefinition: r.pRuleDefinition ?? null,
      createdBy: r.pCreatedBy ?? null,
      createdAt: Number(r.pCreatedAt),
    } as PolicyRecord;
    return { ...binding, policy };
  });
}

/** Create policy binding. */
export async function createPolicyBinding(params: {
  policyId: string;
  targetType: string;
  targetId: string;
  workspaceId: string;
}): Promise<PolicyBindingRecord | null> {
  const policy = await getPolicy(params.policyId, params.workspaceId);
  if (!policy) return null;
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await sql`
    INSERT INTO policy_bindings (id, policy_id, target_type, target_id, created_at)
    VALUES (${id}, ${params.policyId}, ${params.targetType}, ${params.targetId}, ${createdAt})
  `;
  const rows = await sql`
    SELECT id, policy_id AS "policyId", target_type AS "targetType", target_id AS "targetId", created_at AS "createdAt"
    FROM policy_bindings WHERE id = ${id}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, policyId: r.policyId, targetType: r.targetType, targetId: r.targetId, createdAt: Number(r.createdAt) } as PolicyBindingRecord;
}

/** Delete policy binding. */
export async function deletePolicyBinding(
  bindingId: string,
  policyId: string,
  workspaceId: string
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM policy_bindings pb
    USING policies p
    WHERE pb.id = ${bindingId} AND pb.policy_id = ${policyId} AND p.id = pb.policy_id AND p.workspace_id = ${workspaceId}
    RETURNING pb.id
  `;
  return Array.isArray(rows) && rows.length > 0;
}

// ---------------------------------------------------------------------------
// Usage totals for policy caps (budget_cap, token_cap)
// ---------------------------------------------------------------------------

export type UsageTotalsForScope = { totalCost: number; totalTokens: number };

/** Sum cost and tokens from request_logs for a binding scope and time range. Used by budget_cap/token_cap. */
export async function getUsageTotalsForScope(
  workspaceId: string,
  targetType: string,
  targetId: string,
  since: number,
  until: number
): Promise<UsageTotalsForScope> {
  const sql = getSql();
  const scopeCond =
    targetType === "workspace"
      ? sql`workspace_id = ${targetId}`
      : targetType === "project"
        ? sql`workspace_id = ${workspaceId} AND project_id = ${targetId}`
        : targetType === "environment"
          ? sql`workspace_id = ${workspaceId} AND environment_id = ${targetId}`
          : targetType === "route"
            ? sql`workspace_id = ${workspaceId} AND route_id = ${targetId}`
            : sql`workspace_id = ${workspaceId} AND 1 = 0`;
  const rows = await sql`
    SELECT
      COALESCE(SUM(estimated_cost), 0)::real AS "totalCost",
      (COALESCE(SUM(input_tokens), 0) + COALESCE(SUM(output_tokens), 0))::bigint AS "totalTokens"
    FROM request_logs
    WHERE ${scopeCond} AND created_at >= ${since} AND created_at <= ${until}
  `;
  const r = (Array.isArray(rows) ? rows[0] : rows) as { totalCost: number; totalTokens: string } | undefined;
  return {
    totalCost: r?.totalCost != null ? Number(r.totalCost) : 0,
    totalTokens: r?.totalTokens != null ? Number(r.totalTokens) : 0,
  };
}

// ---------------------------------------------------------------------------
// Policy evaluation (simple, explicit; for route/request validation)
// ---------------------------------------------------------------------------

export type PolicyEvaluationContext = {
  workspaceId: string;
  projectId?: string;
  environmentId?: string;
  routeId?: string;
  modelId?: string;
  providerType?: string;
  /** Pass from catalog for deprecated_model_block. */
  modelLifecycleState?: string;
};

export type PolicyViolation = {
  policyId: string;
  policyName: string;
  type: string;
  message: string;
};

/** Evaluate policies bound to the given context. Returns violations; empty array means allowed. */
export async function evaluatePolicies(context: PolicyEvaluationContext): Promise<PolicyViolation[]> {
  const sql = getSql();
  const targets: { targetType: string; targetId: string }[] = [
    { targetType: "workspace", targetId: context.workspaceId },
  ];
  if (context.projectId) targets.push({ targetType: "project", targetId: context.projectId });
  if (context.environmentId) targets.push({ targetType: "environment", targetId: context.environmentId });
  if (context.routeId) targets.push({ targetType: "route", targetId: context.routeId });

  type BindingHit = { policyId: string; targetType: string; targetId: string };
  const bindingHits: BindingHit[] = [];
  for (const t of targets) {
    const rows = await sql`
      SELECT pb.policy_id AS "policyId", pb.target_type AS "targetType", pb.target_id AS "targetId"
      FROM policy_bindings pb
      INNER JOIN policies p ON pb.policy_id = p.id
      WHERE pb.target_type = ${t.targetType} AND pb.target_id = ${t.targetId}
        AND p.workspace_id = ${context.workspaceId} AND (p.status IS NULL OR p.status = 'active')
    `;
    for (const r of rows as { policyId: string; targetType: string; targetId: string }[]) {
      bindingHits.push({ policyId: r.policyId, targetType: r.targetType, targetId: r.targetId });
    }
  }
  const policyIds = [...new Set(bindingHits.map((b) => b.policyId))];
  if (policyIds.length === 0) return [];

  const policies = await sql`
    SELECT id, name, type, rule_definition AS "ruleDefinition"
    FROM policies
    WHERE id = ANY(${policyIds})
  `;

  const violations: PolicyViolation[] = [];
  for (const p of policies as { id: string; name: string; type: string; ruleDefinition: unknown }[]) {
    const rule = (p.ruleDefinition as Record<string, unknown>) ?? {};
    if (p.type === "model_allowlist") {
      const modelIds = (rule.modelIds as string[]) ?? [];
      if (modelIds.length > 0 && context.modelId && !modelIds.includes(context.modelId)) {
        violations.push({
          policyId: p.id,
          policyName: p.name,
          type: p.type,
          message: `Model ${context.modelId} is not in allowlist`,
        });
      }
    } else if (p.type === "model_denylist") {
      const modelIds = (rule.modelIds as string[]) ?? [];
      if (context.modelId && modelIds.includes(context.modelId)) {
        violations.push({
          policyId: p.id,
          policyName: p.name,
          type: p.type,
          message: `Model ${context.modelId} is denylisted`,
        });
      }
    } else if (p.type === "provider_allowlist") {
      const providerTypes = (rule.providerTypes as string[]) ?? [];
      if (providerTypes.length > 0 && context.providerType && !providerTypes.includes(context.providerType)) {
        violations.push({
          policyId: p.id,
          policyName: p.name,
          type: p.type,
          message: `Provider ${context.providerType} is not in allowlist`,
        });
      }
    } else if (p.type === "provider_denylist") {
      const providerTypes = (rule.providerTypes as string[]) ?? [];
      if (context.providerType && providerTypes.includes(context.providerType)) {
        violations.push({
          policyId: p.id,
          policyName: p.name,
          type: p.type,
          message: `Provider ${context.providerType} is denylisted`,
        });
      }
    } else if (p.type === "deprecated_model_block") {
      if (context.modelLifecycleState === "deprecated" || context.modelLifecycleState === "retired") {
        violations.push({
          policyId: p.id,
          policyName: p.name,
          type: p.type,
          message: `Deprecated or retired models are blocked`,
        });
      }
    } else if (p.type === "budget_cap" || p.type === "token_cap") {
      const limit = typeof rule.limit === "number" && rule.limit >= 0 ? rule.limit : undefined;
      if (limit === undefined) continue;

      const now = Date.now();
      const monthStart = new Date(now);
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const since = monthStart.getTime();
      const until = now;

      const bindingsForPolicy = bindingHits.filter((b) => b.policyId === p.id);
      for (const b of bindingsForPolicy) {
        const { totalCost, totalTokens } = await getUsageTotalsForScope(
          context.workspaceId,
          b.targetType,
          b.targetId,
          since,
          until
        );
        if (p.type === "budget_cap") {
          if (totalCost >= limit) {
            violations.push({
              policyId: p.id,
              policyName: p.name,
              type: p.type,
              message: `Budget cap exceeded: ${totalCost.toFixed(2)} >= ${limit} (limit)`,
            });
          }
        } else {
          if (totalTokens >= limit) {
            violations.push({
              policyId: p.id,
              policyName: p.name,
              type: p.type,
              message: `Token cap exceeded: ${totalTokens} >= ${limit} (limit)`,
            });
          }
        }
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Request logs (execution path: route resolution → provider/model → log)
// ---------------------------------------------------------------------------

export type RequestLogParams = {
  workspaceId: string;
  projectId: string;
  environmentId: string;
  providerType: string;
  requestStatus: string;
  latencyMs: number;
  routeId?: string | null;
  gatewayKeyId?: string | null;
  finalModelId?: string | null;
  providerModelVariantId?: string | null;
  errorCode?: string | null;
  fallbackCount?: number | null;
  ttftMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  cachedTokens?: number | null;
  estimatedCost?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type RequestLogRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  environmentId: string;
  routeId: string | null;
  gatewayKeyId: string | null;
  providerType: string;
  finalModelId: string | null;
  requestStatus: string;
  latencyMs: number;
  ttftMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  estimatedCost: number | null;
  fallbackCount: number | null;
  errorCode: string | null;
  createdAt: number;
};

/** Insert a request log row. Used after route resolution and/or proxy. */
export async function insertRequestLog(params: RequestLogParams): Promise<void> {
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await sql`
    INSERT INTO request_logs (
      id, workspace_id, project_id, environment_id, route_id, gateway_key_id,
      provider_type, provider_model_variant_id, final_model_id, request_status,
      latency_ms, ttft_ms, input_tokens, output_tokens, cached_tokens, estimated_cost,
      fallback_count, error_code, created_at, metadata
    )
    VALUES (
      ${id}, ${params.workspaceId}, ${params.projectId}, ${params.environmentId},
      ${params.routeId ?? null}, ${params.gatewayKeyId ?? null},
      ${params.providerType}, ${params.providerModelVariantId ?? null}, ${params.finalModelId ?? null},
      ${params.requestStatus}, ${params.latencyMs},
      ${params.ttftMs ?? null}, ${params.inputTokens ?? null}, ${params.outputTokens ?? null},
      ${params.cachedTokens ?? null}, ${params.estimatedCost ?? null},
      ${params.fallbackCount ?? null}, ${params.errorCode ?? null}, ${createdAt},
      ${params.metadata ? JSON.stringify(params.metadata) : null}
    )
  `;
}

export type ListRequestLogsFilters = {
  limit?: number;
  since?: number;
  until?: number;
  projectId?: string;
  routeId?: string;
};

/** List request logs for a workspace (or project). For frontend consumption. */
export async function listRequestLogs(
  workspaceId: string,
  options: ListRequestLogsFilters = {}
): Promise<RequestLogRecord[]> {
  const { limit = 50, since, until, projectId, routeId } = options;
  const sql = getSql();
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", project_id AS "projectId", environment_id AS "environmentId",
           route_id AS "routeId", gateway_key_id AS "gatewayKeyId", provider_type AS "providerType",
           final_model_id AS "finalModelId", request_status AS "requestStatus", latency_ms AS "latencyMs",
           ttft_ms AS "ttftMs", input_tokens AS "inputTokens", output_tokens AS "outputTokens",
           cached_tokens AS "cachedTokens", estimated_cost AS "estimatedCost",
           fallback_count AS "fallbackCount", error_code AS "errorCode", created_at AS "createdAt"
    FROM request_logs
    WHERE workspace_id = ${workspaceId}
      ${since != null ? sql`AND created_at >= ${since}` : sql``}
      ${until != null ? sql`AND created_at <= ${until}` : sql``}
      ${projectId != null ? sql`AND project_id = ${projectId}` : sql``}
      ${routeId != null ? sql`AND route_id = ${routeId}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    workspaceId: r.workspaceId,
    projectId: r.projectId,
    environmentId: r.environmentId,
    routeId: r.routeId ?? null,
    gatewayKeyId: r.gatewayKeyId ?? null,
    providerType: r.providerType,
    finalModelId: r.finalModelId ?? null,
    requestStatus: r.requestStatus,
    latencyMs: Number(r.latencyMs),
    ttftMs: r.ttftMs != null ? Number(r.ttftMs) : null,
    inputTokens: r.inputTokens != null ? Number(r.inputTokens) : null,
    outputTokens: r.outputTokens != null ? Number(r.outputTokens) : null,
    cachedTokens: r.cachedTokens != null ? Number(r.cachedTokens) : null,
    estimatedCost: r.estimatedCost != null ? Number(r.estimatedCost) : null,
    fallbackCount: r.fallbackCount != null ? Number(r.fallbackCount) : null,
    errorCode: r.errorCode ?? null,
    createdAt: Number(r.createdAt),
  })) as RequestLogRecord[];
}

// ---------------------------------------------------------------------------
// Usage aggregates (grouped summaries: project, route, provider, model, key)
// ---------------------------------------------------------------------------

export type UsageAggregateRecord = {
  id: string;
  granularity: string;
  periodStart: number;
  periodEnd: number;
  workspaceId: string | null;
  projectId: string | null;
  environmentId: string | null;
  routeId: string | null;
  gatewayKeyId: string | null;
  providerType: string | null;
  modelId: string | null;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number | null;
  estimatedCost: number | null;
  avgLatencyMs: number | null;
  errorRate: number | null;
  fallbackRate: number | null;
};

export type ListUsageAggregatesFilters = {
  limit?: number;
  periodStart?: number;
  periodEnd?: number;
  projectId?: string;
  routeId?: string;
  providerType?: string;
  modelId?: string;
  gatewayKeyId?: string;
  granularity?: string;
};

/** List usage aggregates for a workspace. For frontend consumption. */
export async function listUsageAggregates(
  workspaceId: string,
  options: ListUsageAggregatesFilters = {}
): Promise<UsageAggregateRecord[]> {
  const {
    limit = 100,
    periodStart,
    periodEnd,
    projectId,
    routeId,
    providerType,
    modelId,
    gatewayKeyId,
    granularity,
  } = options;
  const sql = getSql();
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const rows = await sql`
    SELECT id, granularity, period_start AS "periodStart", period_end AS "periodEnd",
           workspace_id AS "workspaceId", project_id AS "projectId", environment_id AS "environmentId",
           route_id AS "routeId", gateway_key_id AS "gatewayKeyId", provider_type AS "providerType",
           model_id AS "modelId", request_count AS "requestCount", input_tokens AS "inputTokens",
           output_tokens AS "outputTokens", cached_tokens AS "cachedTokens", estimated_cost AS "estimatedCost",
           avg_latency_ms AS "avgLatencyMs", error_rate AS "errorRate", fallback_rate AS "fallbackRate"
    FROM usage_aggregates
    WHERE workspace_id = ${workspaceId}
      ${periodStart != null ? sql`AND period_end >= ${periodStart}` : sql``}
      ${periodEnd != null ? sql`AND period_start <= ${periodEnd}` : sql``}
      ${projectId != null ? sql`AND project_id = ${projectId}` : sql``}
      ${routeId != null ? sql`AND route_id = ${routeId}` : sql``}
      ${providerType != null ? sql`AND provider_type = ${providerType}` : sql``}
      ${modelId != null ? sql`AND model_id = ${modelId}` : sql``}
      ${gatewayKeyId != null ? sql`AND gateway_key_id = ${gatewayKeyId}` : sql``}
      ${granularity != null ? sql`AND granularity = ${granularity}` : sql``}
    ORDER BY period_start DESC, project_id, route_id, provider_type, model_id
    LIMIT ${safeLimit}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    granularity: r.granularity,
    periodStart: Number(r.periodStart),
    periodEnd: Number(r.periodEnd),
    workspaceId: r.workspaceId ?? null,
    projectId: r.projectId ?? null,
    environmentId: r.environmentId ?? null,
    routeId: r.routeId ?? null,
    gatewayKeyId: r.gatewayKeyId ?? null,
    providerType: r.providerType ?? null,
    modelId: r.modelId ?? null,
    requestCount: Number(r.requestCount),
    inputTokens: Number(r.inputTokens),
    outputTokens: Number(r.outputTokens),
    cachedTokens: r.cachedTokens != null ? Number(r.cachedTokens) : null,
    estimatedCost: r.estimatedCost != null ? Number(r.estimatedCost) : null,
    avgLatencyMs: r.avgLatencyMs != null ? Number(r.avgLatencyMs) : null,
    errorRate: r.errorRate != null ? Number(r.errorRate) : null,
    fallbackRate: r.fallbackRate != null ? Number(r.fallbackRate) : null,
  })) as UsageAggregateRecord[];
}

export type InsertUsageAggregateParams = {
  granularity: string;
  periodStart: number;
  periodEnd: number;
  workspaceId?: string | null;
  projectId?: string | null;
  environmentId?: string | null;
  routeId?: string | null;
  gatewayKeyId?: string | null;
  providerType?: string | null;
  modelId?: string | null;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number | null;
  estimatedCost?: number | null;
  avgLatencyMs?: number | null;
  errorRate?: number | null;
  fallbackRate?: number | null;
};

/** Insert a usage aggregate row (e.g. from a batch job that groups request_logs). */
export async function insertUsageAggregate(params: InsertUsageAggregateParams): Promise<void> {
  const sql = getSql();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO usage_aggregates (
      id, granularity, period_start, period_end, workspace_id, project_id, environment_id,
      route_id, gateway_key_id, provider_type, model_id,
      request_count, input_tokens, output_tokens, cached_tokens, estimated_cost,
      avg_latency_ms, error_rate, fallback_rate
    )
    VALUES (
      ${id}, ${params.granularity}, ${params.periodStart}, ${params.periodEnd},
      ${params.workspaceId ?? null}, ${params.projectId ?? null}, ${params.environmentId ?? null},
      ${params.routeId ?? null}, ${params.gatewayKeyId ?? null}, ${params.providerType ?? null}, ${params.modelId ?? null},
      ${params.requestCount}, ${params.inputTokens}, ${params.outputTokens},
      ${params.cachedTokens ?? 0}, ${params.estimatedCost ?? null},
      ${params.avgLatencyMs ?? null}, ${params.errorRate ?? null}, ${params.fallbackRate ?? null}
    )
  `;
}

/** Aggregate request_logs on the fly for a time range. Use when pre-aggregated usage_aggregates are not yet populated. */
export async function aggregateRequestLogsToUsage(
  workspaceId: string,
  options: { since: number; until: number; projectId?: string }
): Promise<UsageAggregateRecord[]> {
  const { since, until, projectId } = options;
  const sql = getSql();
  const projectFilter = projectId != null ? sql`AND project_id = ${projectId}` : sql``;
  const rows = await sql`
    SELECT
      project_id AS "projectId", route_id AS "routeId", gateway_key_id AS "gatewayKeyId",
      provider_type AS "providerType", final_model_id AS "modelId",
      COUNT(*)::bigint AS "requestCount",
      (COUNT(*) FILTER (WHERE request_status NOT IN ('resolved', 'ok'))::float / NULLIF(COUNT(*), 0))::real AS "errorRate",
      COALESCE(SUM(input_tokens), 0)::bigint AS "inputTokens",
      COALESCE(SUM(output_tokens), 0)::bigint AS "outputTokens",
      COALESCE(SUM(cached_tokens), 0)::bigint AS "cachedTokens",
      SUM(estimated_cost)::real AS "estimatedCost",
      AVG(latency_ms)::real AS "avgLatencyMs"
    FROM request_logs
    WHERE workspace_id = ${workspaceId} AND created_at >= ${since} AND created_at <= ${until}
      ${projectFilter}
    GROUP BY project_id, route_id, gateway_key_id, provider_type, final_model_id
    ORDER BY project_id, route_id, provider_type, final_model_id
    LIMIT 500
  `;
  return rows.map((r: Record<string, unknown>, i: number) => ({
    id: `onfly-${since}-${until}-${i}`,
    granularity: "ad_hoc",
    periodStart: since,
    periodEnd: until,
    workspaceId,
    projectId: r.projectId ?? null,
    environmentId: null,
    routeId: r.routeId ?? null,
    gatewayKeyId: r.gatewayKeyId ?? null,
    providerType: r.providerType ?? null,
    modelId: r.modelId ?? null,
    requestCount: Number(r.requestCount),
    inputTokens: Number(r.inputTokens),
    outputTokens: Number(r.outputTokens),
    cachedTokens: Number(r.cachedTokens) || null,
    estimatedCost: r.estimatedCost != null ? Number(r.estimatedCost) : null,
    avgLatencyMs: r.avgLatencyMs != null ? Number(r.avgLatencyMs) : null,
    errorRate: r.errorRate != null ? Number(r.errorRate) : null,
    fallbackRate: null,
  })) as UsageAggregateRecord[];
}
