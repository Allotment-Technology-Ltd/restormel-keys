/**
 * Neon (Postgres) storage: workspaces, projects, environments, api_keys (Gateway keys).
 * No raw Gateway keys stored; prefix + hash only. See security-baseline.
 * Schema: 001_initial, 002_better_auth, 003_workspaces_and_environments.
 *
 * Stage 1.7 — deploy-time migrations:
 * Runtime DDL ensure* functions are gated by CONNECT_RUNTIME_DDL.
 *   CONNECT_RUNTIME_DDL=1 (default in dev): ensure* functions run DDL as before.
 *   CONNECT_RUNTIME_DDL=0 (default in production via NODE_ENV=production):
 *     ensure* functions skip DDL and instead verify the schema_migrations
 *     high-water-mark once per boot, throwing loudly if the schema is behind.
 * See scripts/apply-migrations.mts for the CI runner.
 */
import { env } from "$env/dynamic/private";
import { neon } from "@neondatabase/serverless";
import { randomBytes, createHash } from "crypto";
import {
  decryptProviderSecret,
  encryptProviderSecret,
  secretDisplaySuffix,
} from "$lib/server/credential-crypto";
import { resolveModuleFlagsSync } from "$lib/server/module-flags";
import { normalizeConnectIngestStages } from "@restormel/connect-core";
import { reconcileConnectIngestJobStagesForApi } from "$lib/connect/ingest-progress-ui";
import {
  buildProductionG2SampleJob,
  parseStoredProductionQualityReport,
  summarizeG2Aggregate,
} from "$lib/server/connect/ingest-quality-gates-data";

// ---------------------------------------------------------------------------
// Stage 1.7 — Runtime DDL gate
// ---------------------------------------------------------------------------
//
// runtimeDdlEnabled() returns true when the ensure* functions should run DDL.
// In production (NODE_ENV=production or CONNECT_RUNTIME_DDL=0) the ensures are
// no-ops and schemaBootAssert() fires instead (once per process, lazy).
//
// Override: set CONNECT_RUNTIME_DDL=1 to force-enable DDL in production (e.g.
// for a one-time recovery), or CONNECT_RUNTIME_DDL=0 to test prod mode locally.

function runtimeDdlEnabled(): boolean {
  const override = process.env.CONNECT_RUNTIME_DDL;
  if (override === "1") return true;
  if (override === "0") return false;
  // Default: ON in dev, OFF in production.
  return process.env.NODE_ENV !== "production";
}

/**
 * The highest migration filename that must be present in schema_migrations for
 * the current codebase to work correctly.  Update this constant whenever a new
 * migration adds tables/columns that neon.ts functions depend on at runtime.
 *
 * The assertion fires once per process boot when runtimeDdlEnabled() is false.
 */
const REQUIRED_MIGRATION = "059_schema_migrations_tracking.sql";

let schemaBootAsserted: Promise<void> | null = null;

/**
 * Assert that the production schema is up to date with REQUIRED_MIGRATION.
 * Runs at most once per process; throws loudly if the high-water mark is behind
 * so that the health-check fails and the deploy does not go live with a stale DB.
 */
async function assertSchemaUpToDate(): Promise<void> {
  if (schemaBootAsserted) return schemaBootAsserted;
  schemaBootAsserted = (async () => {
    const sql = getSql();
    let rows: { filename: string }[];
    try {
      rows = (await sql`
        SELECT filename FROM schema_migrations
        ORDER BY filename DESC
        LIMIT 1
      `) as { filename: string }[];
    } catch {
      throw new Error(
        `[deploy-time-migrations] schema_migrations table does not exist. ` +
          `Run the migration runner (pnpm --filter dashboard run migrate) before starting production. ` +
          `Required: ${REQUIRED_MIGRATION}`,
      );
    }
    const hwm = rows[0]?.filename ?? "";
    if (hwm < REQUIRED_MIGRATION) {
      throw new Error(
        `[deploy-time-migrations] Schema is behind. ` +
          `High-water mark: "${hwm || "(none)"}". ` +
          `Required: "${REQUIRED_MIGRATION}". ` +
          `Run: pnpm --filter dashboard run migrate`,
      );
    }
  })();
  return schemaBootAsserted;
}

/** Reset the cached boot assertion (test helper only). */
export function _resetSchemaBootAssertForTesting(): void {
  schemaBootAsserted = null;
}

// ---------------------------------------------------------------------------

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
  /** Auto-provisioned Restormel Testing project (one per workspace convention). */
  isRestormelTesting?: boolean;
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

export function getSql() {
  const url = env.DATABASE_URL;
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

export async function findWorkspaceByPaddleSubscriptionId(subscriptionId: string): Promise<Workspace | null> {
  const id = subscriptionId.trim();
  if (!id) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, slug, owner_user_id AS "ownerUserId", created_at AS "createdAt", plan,
           plan_expires_at AS "planExpiresAt"
    FROM workspaces
    WHERE paddle_subscription_id = ${id}
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

export async function findWorkspaceByPaddleCustomerId(customerId: string): Promise<Workspace | null> {
  const id = customerId.trim();
  if (!id) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, slug, owner_user_id AS "ownerUserId", created_at AS "createdAt", plan,
           plan_expires_at AS "planExpiresAt"
    FROM workspaces
    WHERE paddle_customer_id = ${id}
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

export async function applyPaddleLifecycleUpdate(params: {
  workspaceId: string;
  plan: "free" | "pro";
  paddleCustomerId?: string | null;
  paddleTransactionId?: string | null;
  paddleSubscriptionId?: string | null;
  paddleSubscriptionStatus?: string | null;
  markPlanEndedNow?: boolean;
}): Promise<void> {
  const sql = getSql();
  const now = Date.now();
  const planEndedAt = params.markPlanEndedNow ? now : null;
  await sql`
    UPDATE workspaces
    SET plan = ${params.plan},
        plan_updated_at = ${now},
        plan_expires_at = ${params.plan === "pro" ? null : null},
        plan_ended_at = ${params.plan === "pro" ? null : planEndedAt},
        paddle_customer_id = COALESCE(${params.paddleCustomerId ?? null}, paddle_customer_id),
        paddle_transaction_id = COALESCE(${params.paddleTransactionId ?? null}, paddle_transaction_id),
        paddle_subscription_id = COALESCE(${params.paddleSubscriptionId ?? null}, paddle_subscription_id),
        paddle_subscription_status = COALESCE(${params.paddleSubscriptionStatus ?? null}, paddle_subscription_status)
    WHERE id = ${params.workspaceId}
  `;
}

/** List projects for user (ownership via user_id; projects belong to user's workspace). */
function mapProjectRow(r: {
  id: string;
  name: string;
  userId: string;
  workspaceId: string | null;
  createdAt: number | bigint;
  isRestormelTesting?: boolean | null;
}): Project {
  return {
    id: r.id,
    name: r.name,
    userId: r.userId,
    workspaceId: r.workspaceId ?? null,
    createdAt: Number(r.createdAt),
    isRestormelTesting: r.isRestormelTesting === true,
  };
}

export async function listProjects(userId: string): Promise<Project[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt",
           COALESCE(is_restormel_testing, false) AS "isRestormelTesting"
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) =>
    mapProjectRow(
      r as {
        id: string;
        name: string;
        userId: string;
        workspaceId: string | null;
        createdAt: number | bigint;
        isRestormelTesting?: boolean | null;
      },
    ),
  );
}

/** List projects in a workspace (for Management key scope). */
export async function listProjectsByWorkspace(workspaceId: string): Promise<Project[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt",
           COALESCE(is_restormel_testing, false) AS "isRestormelTesting"
    FROM projects
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) =>
    mapProjectRow(
      r as {
        id: string;
        name: string;
        userId: string;
        workspaceId: string | null;
        createdAt: number | bigint;
        isRestormelTesting?: boolean | null;
      },
    ),
  );
}

/** Get project if it belongs to the given workspace (for Management key scope). */
export async function getProjectInWorkspace(projectId: string, workspaceId: string): Promise<Project | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt",
           COALESCE(is_restormel_testing, false) AS "isRestormelTesting"
    FROM projects
    WHERE id = ${projectId} AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return mapProjectRow(
    r as {
      id: string;
      name: string;
      userId: string;
      workspaceId: string | null;
      createdAt: number | bigint;
      isRestormelTesting?: boolean | null;
    },
  );
}

/** Create project under user's default workspace; seeds environments per module flags. */
export async function createProject(userId: string, name: string): Promise<Project> {
  const sql = getSql();
  const workspace = await getOrCreateDefaultWorkspace(userId);
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const projectName = name || "Unnamed project";
  const flags = resolveModuleFlagsSync();
  await sql`
    INSERT INTO projects (id, name, user_id, workspace_id, created_at)
    VALUES (${id}, ${projectName}, ${userId}, ${workspace.id}, ${createdAt})
  `;
  const envCreatedAt = Date.now();
  if (flags.environments) {
    await sql`
      INSERT INTO environments (id, project_id, name, type, created_at)
      VALUES
        (${crypto.randomUUID()}, ${id}, 'Development', 'dev', ${envCreatedAt}),
        (${crypto.randomUUID()}, ${id}, 'Production', 'prod', ${envCreatedAt})
    `;
  } else {
    const prodEnvId = crypto.randomUUID();
    await sql`
      INSERT INTO environments (id, project_id, name, type, created_at)
      VALUES (${prodEnvId}, ${id}, 'Production', 'prod', ${envCreatedAt})
    `;
    await sql`
      UPDATE projects SET default_environment_id = ${prodEnvId} WHERE id = ${id}
    `;
  }
  return {
    id,
    name: projectName,
    userId,
    workspaceId: workspace.id,
    createdAt,
    isRestormelTesting: false,
  };
}

const RESTORMEL_TESTING_PROJECT_NAME = "Restormel Testing";

/** Ensures a workspace-scoped Restormel Testing project exists (dev/prod envs, flagged row). Idempotent. */
export async function ensureRestormelTestingProject(userId: string): Promise<Project> {
  const sql = getSql();
  const workspace = await getOrCreateDefaultWorkspace(userId);
  const existing = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt",
           COALESCE(is_restormel_testing, false) AS "isRestormelTesting"
    FROM projects
    WHERE workspace_id = ${workspace.id} AND COALESCE(is_restormel_testing, false) = true
    LIMIT 1
  `;
  if (existing.length > 0) {
    const p = await getProject((existing[0] as { id: string }).id, userId);
    if (p) return p;
  }
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const envCreatedAt = Date.now();
  await sql`
    INSERT INTO projects (id, name, user_id, workspace_id, created_at, is_restormel_testing)
    VALUES (${id}, ${RESTORMEL_TESTING_PROJECT_NAME}, ${userId}, ${workspace.id}, ${createdAt}, true)
  `;
  await sql`
    INSERT INTO environments (id, project_id, name, type, created_at)
    VALUES
      (${crypto.randomUUID()}, ${id}, 'Development', 'dev', ${envCreatedAt}),
      (${crypto.randomUUID()}, ${id}, 'Production', 'prod', ${envCreatedAt})
  `;
  const out = await getProject(id, userId);
  if (!out) throw new Error("Restormel Testing project not found after create");
  return out;
}

/** Get project; returns null if not found or not owner */
export async function getProject(projectId: string, userId: string): Promise<Project | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt",
           COALESCE(is_restormel_testing, false) AS "isRestormelTesting"
    FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return mapProjectRow(
    r as {
      id: string;
      name: string;
      userId: string;
      workspaceId: string | null;
      createdAt: number | bigint;
      isRestormelTesting?: boolean | null;
    },
  );
}

/** Get project by id regardless of owner (use only after auth scope checks). */
export async function getProjectById(projectId: string): Promise<Project | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", workspace_id AS "workspaceId", created_at AS "createdAt",
           COALESCE(is_restormel_testing, false) AS "isRestormelTesting"
    FROM projects
    WHERE id = ${projectId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return mapProjectRow(
    r as {
      id: string;
      name: string;
      userId: string;
      workspaceId: string | null;
      createdAt: number | bigint;
      isRestormelTesting?: boolean | null;
    },
  );
}

/** List environments for a project (caller must own project). */
export type ProjectWithEnvironments = {
  id: string;
  name: string;
  environments: { id: string; name: string; type: string }[];
};

/** Single query: projects + environments for dashboard layout (avoids N+1 listEnvironments). */
export async function listProjectsWithEnvironments(userId: string): Promise<ProjectWithEnvironments[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      p.id AS "projectId",
      p.name AS "projectName",
      p.created_at AS "projectCreatedAt",
      e.id AS "envId",
      e.name AS "envName",
      e.type AS "envType"
    FROM projects p
    LEFT JOIN environments e ON e.project_id = p.id
    WHERE p.user_id = ${userId}
    ORDER BY p.created_at DESC, e.type ASC
  `;
  const byProject = new Map<string, ProjectWithEnvironments>();
  for (const row of rows) {
    const r = row as {
      projectId: string;
      projectName: string;
      envId: string | null;
      envName: string | null;
      envType: string | null;
    };
    let entry = byProject.get(r.projectId);
    if (!entry) {
      entry = { id: r.projectId, name: r.projectName, environments: [] };
      byProject.set(r.projectId, entry);
    }
    if (r.envId && r.envName && r.envType) {
      entry.environments.push({ id: r.envId, name: r.envName, type: r.envType });
    }
  }
  return [...byProject.values()];
}

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

/** Resolve canonical environment for resolve API when `environmentId` omitted (environments module off). */
export async function getProjectDefaultEnvironmentId(
  projectId: string,
  userId: string
): Promise<string | null> {
  const project = await getProject(projectId, userId);
  if (!project) return null;
  const sql = getSql();
  const rows = await sql`
    SELECT default_environment_id AS "defaultEnvironmentId"
    FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
    LIMIT 1
  `;
  const fromColumn = (rows[0] as { defaultEnvironmentId?: string | null } | undefined)?.defaultEnvironmentId;
  if (fromColumn) return fromColumn;
  const envs = await listEnvironments(projectId, userId);
  const prod = envs.find((e) => e.type?.toLowerCase() === "prod");
  return prod?.id ?? envs[0]?.id ?? null;
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

/** Return total Gateway keys in a workspace (fast path for dashboard summaries). */
export async function countApiKeysByWorkspace(workspaceId: string): Promise<number> {
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::bigint AS "total"
    FROM api_keys k
    INNER JOIN projects p ON p.id = k.project_id
    WHERE p.workspace_id = ${workspaceId}
  `;
  const total = (rows?.[0] as { total?: string | number } | undefined)?.total;
  return Number(total ?? 0);
}

/**
 * Create Gateway key. Returns { rawKey, keyPrefix, keyId } once; caller must show rawKey to user. Store only prefix + hash in api_keys.
 */
export async function createApiKey(
  projectId: string,
  userId: string
): Promise<{ rawKey: string; keyPrefix: string; keyId: string } | null> {
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
  return { rawKey, keyPrefix, keyId: id };
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
  /** Legacy non-secret label only; never an API key. */
  credentialRef: string | null;
  createdBy: string | null;
  createdAt: number;
  lastVerifiedAt: number | null;
  metadata: Record<string, unknown> | null;
  region: string | null;
  /** True when ciphertext columns are set (encryption version greater than 0). */
  hasEncryptedCredential?: boolean;
  /** e.g. "openai ••••abcd" for UI; never the raw secret. */
  credentialMasked?: string | null;
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

function mapProviderIntegrationPublic(r: Record<string, unknown>): ProviderIntegrationRecord {
  const encVer = Number(r.credentialEncryptionVersion ?? 0);
  const hasEnc = encVer > 0 && Boolean(r.credentialCiphertext);
  const suffix = (r.secretDisplaySuffix as string | null | undefined) ?? null;
  const masked =
    hasEnc && suffix
      ? `${String(r.providerType)} ••••${suffix}`
      : hasEnc
        ? `${String(r.providerType)} (saved)`
        : null;
  return {
    id: r.id as string,
    workspaceId: r.workspaceId as string,
    providerType: r.providerType as string,
    displayName: (r.displayName as string | null) ?? null,
    status: (r.status as string) ?? PROVIDER_INTEGRATION_DEFAULT_STATUS,
    verificationStatus: (r.verificationStatus as string | null) ?? null,
    credentialRef: hasEnc ? null : ((r.credentialRef as string | null) ?? null),
    createdBy: (r.createdBy as string | null) ?? null,
    createdAt: Number(r.createdAt),
    lastVerifiedAt: r.lastVerifiedAt != null ? Number(r.lastVerifiedAt) : null,
    metadata: (r.metadata as Record<string, unknown> | null) ?? null,
    region: (r.region as string | null) ?? null,
    hasEncryptedCredential: hasEnc,
    credentialMasked: masked,
  };
}

/** List provider integrations for a workspace. */
export async function listProviderIntegrations(workspaceId: string): Promise<ProviderIntegrationRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", provider_type AS "providerType", display_name AS "displayName",
           status, verification_status AS "verificationStatus", credential_ref AS "credentialRef",
           created_by AS "createdBy", created_at AS "createdAt", last_verified_at AS "lastVerifiedAt",
           metadata, region,
           credential_ciphertext AS "credentialCiphertext",
           credential_encryption_version AS "credentialEncryptionVersion",
           secret_display_suffix AS "secretDisplaySuffix"
    FROM provider_integrations
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => mapProviderIntegrationPublic(r as Record<string, unknown>));
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
           metadata, region,
           credential_ciphertext AS "credentialCiphertext",
           credential_encryption_version AS "credentialEncryptionVersion",
           secret_display_suffix AS "secretDisplaySuffix"
    FROM provider_integrations
    WHERE id = ${id} AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapProviderIntegrationPublic(rows[0] as Record<string, unknown>);
}

/** Create provider integration. Use apiKey for encrypted at-rest storage; credentialRef for non-secret labels only. */
export async function createProviderIntegration(params: {
  workspaceId: string;
  providerType: string;
  displayName?: string;
  credentialRef?: string;
  /** Raw provider API key; encrypted with RESTORMEL_CREDENTIALS_ENCRYPTION_KEY. */
  apiKey?: string;
  createdBy?: string;
  actorId: string;
  actorType: string;
}): Promise<ProviderIntegrationRecord> {
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const status = PROVIDER_INTEGRATION_DEFAULT_STATUS;
  const displayName = params.displayName?.trim() || null;
  let credentialRef: string | null = params.credentialRef?.trim() || null;
  let ciphertext: string | null = null;
  let iv: string | null = null;
  let authTag: string | null = null;
  let encVersion = 0;
  let secretSuffix: string | null = null;

  if (params.apiKey !== undefined && params.apiKey.trim() !== "") {
    const enc = encryptProviderSecret(params.apiKey.trim());
    if (!enc.ok) {
      throw new Error(enc.error);
    }
    ciphertext = enc.payload.ciphertextB64;
    iv = enc.payload.ivB64;
    authTag = enc.payload.authTagB64;
    encVersion = enc.payload.encryptionVersion;
    secretSuffix = secretDisplaySuffix(params.apiKey.trim());
    credentialRef = null;
  }

  await sql`
    INSERT INTO provider_integrations (id, workspace_id, provider_type, display_name, status, credential_ref, created_by, created_at,
      credential_ciphertext, credential_iv, credential_auth_tag, credential_encryption_version, secret_display_suffix)
    VALUES (${id}, ${params.workspaceId}, ${params.providerType}, ${displayName}, ${status}, ${credentialRef}, ${params.createdBy ?? null}, ${createdAt},
      ${ciphertext}, ${iv}, ${authTag}, ${encVersion}, ${secretSuffix})
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

/** Internal: load ciphertext row for decrypt (resolve path). Not for API responses. */
export async function getProviderIntegrationSecretRow(
  id: string,
  workspaceId: string
): Promise<{
  providerType: string;
  credentialCiphertext: string | null;
  credentialIv: string | null;
  credentialAuthTag: string | null;
  credentialEncryptionVersion: number;
} | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT provider_type AS "providerType",
           credential_ciphertext AS "credentialCiphertext",
           credential_iv AS "credentialIv",
           credential_auth_tag AS "credentialAuthTag",
           COALESCE(credential_encryption_version, 0) AS "credentialEncryptionVersion"
    FROM provider_integrations
    WHERE id = ${id} AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const r = rows[0] as Record<string, unknown>;
  return {
    providerType: r.providerType as string,
    credentialCiphertext: (r.credentialCiphertext as string | null) ?? null,
    credentialIv: (r.credentialIv as string | null) ?? null,
    credentialAuthTag: (r.credentialAuthTag as string | null) ?? null,
    credentialEncryptionVersion: Number(r.credentialEncryptionVersion ?? 0),
  };
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
    if (!runtimeDdlEnabled()) {
      await assertSchemaUpToDate();
      return;
    }
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
  /**
   * When false (default), exclude rows past `retirement_date` and (unless `lifecycleState` is set)
   * rows whose lifecycle is deprecated/retired. Operators pass true for full catalog slices.
   */
  includeUnhealthy?: boolean;
};

/** List models (catalog). Optional filter by lifecycleState, family; pagination via limit/offset. */
export async function listModels(filters: ListModelsFilters = {}): Promise<ModelRecord[]> {
  const sql = getSql();
  const { lifecycleState, family, limit = 100, offset = 0, includeUnhealthy = false } = filters;
  const safeLimit = Math.min(Math.max(1, limit), 500);
  const safeOffset = Math.max(0, offset);
  const nowMs = Date.now();

  if (lifecycleState != null && lifecycleState !== "" && family != null && family !== "") {
    const rows = includeUnhealthy
      ? await sql`
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
    `
      : await sql`
      SELECT id, canonical_name AS "canonicalName", family, lifecycle_state AS "lifecycleState",
             description, modalities, capabilities, context_window AS "contextWindow",
             max_output_tokens AS "maxOutputTokens", supports_tools AS "supportsTools",
             supports_structured_output AS "supportsStructuredOutput", supports_mcp AS "supportsMcp",
             editorial_summary AS "editorialSummary", strengths, weaknesses, recommended_for AS "recommendedFor",
             avoid_for AS "avoidFor", deprecation_date AS "deprecationDate", retirement_date AS "retirementDate",
             replacement_model_id AS "replacementModelId", source_last_verified_at AS "sourceLastVerifiedAt"
      FROM models
      WHERE lifecycle_state = ${lifecycleState} AND family = ${family}
        AND (retirement_date IS NULL OR retirement_date > ${nowMs})
      ORDER BY canonical_name ASC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    return (rows as Record<string, unknown>[]).map(mapModelRow);
  }
  if (lifecycleState != null && lifecycleState !== "") {
    const rows = includeUnhealthy
      ? await sql`
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
    `
      : await sql`
      SELECT id, canonical_name AS "canonicalName", family, lifecycle_state AS "lifecycleState",
             description, modalities, capabilities, context_window AS "contextWindow",
             max_output_tokens AS "maxOutputTokens", supports_tools AS "supportsTools",
             supports_structured_output AS "supportsStructuredOutput", supports_mcp AS "supportsMcp",
             editorial_summary AS "editorialSummary", strengths, weaknesses, recommended_for AS "recommendedFor",
             avoid_for AS "avoidFor", deprecation_date AS "deprecationDate", retirement_date AS "retirementDate",
             replacement_model_id AS "replacementModelId", source_last_verified_at AS "sourceLastVerifiedAt"
      FROM models
      WHERE lifecycle_state = ${lifecycleState}
        AND (retirement_date IS NULL OR retirement_date > ${nowMs})
      ORDER BY canonical_name ASC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    return (rows as Record<string, unknown>[]).map(mapModelRow);
  }
  if (family != null && family !== "") {
    const rows = includeUnhealthy
      ? await sql`
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
    `
      : await sql`
      SELECT id, canonical_name AS "canonicalName", family, lifecycle_state AS "lifecycleState",
             description, modalities, capabilities, context_window AS "contextWindow",
             max_output_tokens AS "maxOutputTokens", supports_tools AS "supportsTools",
             supports_structured_output AS "supportsStructuredOutput", supports_mcp AS "supportsMcp",
             editorial_summary AS "editorialSummary", strengths, weaknesses, recommended_for AS "recommendedFor",
             avoid_for AS "avoidFor", deprecation_date AS "deprecationDate", retirement_date AS "retirementDate",
             replacement_model_id AS "replacementModelId", source_last_verified_at AS "sourceLastVerifiedAt"
      FROM models
      WHERE family = ${family}
        AND (retirement_date IS NULL OR retirement_date > ${nowMs})
        AND (lifecycle_state IS NULL OR LOWER(TRIM(lifecycle_state)) NOT IN ('deprecated', 'retired'))
      ORDER BY canonical_name ASC
      LIMIT ${safeLimit} OFFSET ${safeOffset}
    `;
    return (rows as Record<string, unknown>[]).map(mapModelRow);
  }
  const rows = includeUnhealthy
    ? await sql`
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
  `
    : await sql`
    SELECT id, canonical_name AS "canonicalName", family, lifecycle_state AS "lifecycleState",
           description, modalities, capabilities, context_window AS "contextWindow",
           max_output_tokens AS "maxOutputTokens", supports_tools AS "supportsTools",
           supports_structured_output AS "supportsStructuredOutput", supports_mcp AS "supportsMcp",
           editorial_summary AS "editorialSummary", strengths, weaknesses, recommended_for AS "recommendedFor",
           avoid_for AS "avoidFor", deprecation_date AS "deprecationDate", retirement_date AS "retirementDate",
           replacement_model_id AS "replacementModelId", source_last_verified_at AS "sourceLastVerifiedAt"
    FROM models
    WHERE (retirement_date IS NULL OR retirement_date > ${nowMs})
      AND (lifecycle_state IS NULL OR LOWER(TRIM(lifecycle_state)) NOT IN ('deprecated', 'retired'))
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
    if (!runtimeDdlEnabled()) {
      await assertSchemaUpToDate();
      return;
    }
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
    await sql`
      ALTER TABLE project_model_bindings ADD COLUMN IF NOT EXISTS keys_logical_ref TEXT
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
  /** Maps ref:restormel-keys:… for Testing resolve. */
  keysLogicalRef?: string | null;
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
    keysLogicalRef: (r.keysLogicalRef as string | null | undefined) ?? null,
  };
}

/** List all bindings for a project (enabled and disabled). */
export async function listProjectModelBindings(projectId: string): Promise<ProjectModelBindingRecord[]> {
  await ensureProjectModelBindingsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, project_id AS "projectId", provider_type AS "providerType",
           model_id AS "modelId", enabled, binding_kind AS "bindingKind",
           created_at AS "createdAt", updated_at AS "updatedAt",
           keys_logical_ref AS "keysLogicalRef"
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
           created_at AS "createdAt", updated_at AS "updatedAt",
           keys_logical_ref AS "keysLogicalRef"
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
  bindingKind: ProjectModelBindingKind = "execution",
  keysLogicalRef?: string | null
): Promise<ProjectModelBindingRecord> {
  await ensureProjectModelBindingsSchema();
  const sql = getSql();
  const now = Date.now();
  const newId = crypto.randomUUID();
  const lr = keysLogicalRef?.trim() || null;
  const rows = await sql`
    INSERT INTO project_model_bindings (id, project_id, provider_type, model_id, enabled, binding_kind, created_at, updated_at, keys_logical_ref)
    VALUES (${newId}, ${projectId}, ${canonicalProviderType}, ${modelId}, true, ${bindingKind}, ${now}, ${now}, ${lr})
    ON CONFLICT (project_id, provider_type, model_id) DO UPDATE SET
      enabled = true,
      binding_kind = ${bindingKind},
      keys_logical_ref = COALESCE(EXCLUDED.keys_logical_ref, project_model_bindings.keys_logical_ref),
      updated_at = ${now}
    RETURNING id, project_id AS "projectId", provider_type AS "providerType",
      model_id AS "modelId", enabled, binding_kind AS "bindingKind",
      created_at AS "createdAt", updated_at AS "updatedAt",
      keys_logical_ref AS "keysLogicalRef"
  `;
  return mapProjectModelBindingRow(rows[0] as Record<string, unknown>);
}

/** Lookup by Restormel Testing logical ref (e.g. ref:restormel-keys:llm/primary). */
export async function getProjectModelBindingByLogicalRef(
  projectId: string,
  keysLogicalRef: string
): Promise<ProjectModelBindingRecord | null> {
  await ensureProjectModelBindingsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, project_id AS "projectId", provider_type AS "providerType",
           model_id AS "modelId", enabled, binding_kind AS "bindingKind",
           created_at AS "createdAt", updated_at AS "updatedAt",
           keys_logical_ref AS "keysLogicalRef"
    FROM project_model_bindings
    WHERE project_id = ${projectId} AND keys_logical_ref = ${keysLogicalRef} AND enabled = true
    LIMIT 1
  `;
  if (rows.length === 0) return null;
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
 *
 * Stage 1.7: when CONNECT_RUNTIME_DDL=0 (production default), this function skips all DDL
 * and verifies the schema_migrations high-water-mark instead.  See runtimeDdlEnabled().
 */
export async function ensureIngestionRoutingSchema(): Promise<void> {
  if (ensuredIngestionRoutingSchema) return ensuredIngestionRoutingSchema;
  ensuredIngestionRoutingSchema = (async () => {
    if (!runtimeDdlEnabled()) {
      await assertSchemaUpToDate();
      return;
    }
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
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS model_pool JSONB`;
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS parallel_group_id TEXT`;
    await sql`ALTER TABLE route_steps ADD COLUMN IF NOT EXISTS parallel_branch_role TEXT`;
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
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS entry_step_id TEXT`;
    await sql`ALTER TABLE routes ADD COLUMN IF NOT EXISTS flow_layout JSONB`;
    await sql`
      CREATE TABLE IF NOT EXISTS route_step_edges (
        id TEXT PRIMARY KEY,
        route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
        from_step_id TEXT NOT NULL REFERENCES route_steps(id) ON DELETE CASCADE,
        to_step_id TEXT NOT NULL REFERENCES route_steps(id) ON DELETE CASCADE,
        priority INTEGER NOT NULL DEFAULT 0,
        label TEXT,
        created_at BIGINT NOT NULL,
        CONSTRAINT route_step_edges_unique_transition UNIQUE (route_id, from_step_id, to_step_id)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_route_step_edges_route_from
      ON route_step_edges(route_id, from_step_id)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS hosted_runtime_jobs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        route_id TEXT NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        environment_id TEXT NOT NULL,
        status TEXT NOT NULL,
        request_summary JSONB NOT NULL,
        result_summary JSONB,
        error_code TEXT,
        error_message TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        CONSTRAINT hosted_runtime_jobs_status_check CHECK (
          status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')
        )
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_hosted_runtime_jobs_project_created
      ON hosted_runtime_jobs (project_id, created_at DESC)
    `;
    await sql`ALTER TABLE hosted_runtime_jobs ADD COLUMN IF NOT EXISTS idempotency_key_hash TEXT`;
    await sql`ALTER TABLE hosted_runtime_jobs ADD COLUMN IF NOT EXISTS cancel_requested_at BIGINT`;
    await sql`ALTER TABLE hosted_runtime_jobs ADD COLUMN IF NOT EXISTS merge_strategy TEXT`;
    await sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hosted_runtime_jobs_idempotency
      ON hosted_runtime_jobs (project_id, user_id, idempotency_key_hash)
      WHERE idempotency_key_hash IS NOT NULL
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_hosted_runtime_jobs_queued
      ON hosted_runtime_jobs (status, created_at)
      WHERE status = 'queued'
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_ingest_jobs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        label TEXT,
        current_stage TEXT,
        stages JSONB NOT NULL DEFAULT '[]'::jsonb,
        sources JSONB NOT NULL,
        stop_after_stage TEXT,
        error TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        CONSTRAINT knowledge_ingest_jobs_status_check CHECK (
          status IN ('pending', 'running', 'completed', 'failed', 'cancelled')
        )
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_jobs_workspace_updated
      ON knowledge_ingest_jobs (workspace_id, updated_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_jobs_workspace_status
      ON knowledge_ingest_jobs (workspace_id, status)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_jobs_pending
      ON knowledge_ingest_jobs (status, created_at)
      WHERE status = 'pending'
    `;
    await sql`ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS pipeline_profile_id TEXT`;
    await sql`ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS domain_pack_id TEXT`;
    await sql`ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS graph_target_id TEXT`;
    await sql`ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS current_action TEXT`;
    await sql`ALTER TABLE knowledge_ingest_jobs ADD COLUMN IF NOT EXISTS progress JSONB`;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_ingest_job_logs (
        id BIGSERIAL PRIMARY KEY,
        job_id TEXT NOT NULL REFERENCES knowledge_ingest_jobs(id) ON DELETE CASCADE,
        line TEXT NOT NULL,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_ingest_job_logs_job_seq
      ON knowledge_ingest_job_logs (job_id, id)
    `;
    // Readiness runs: a named pass that takes a cohort (the next N unlinked ideas)
    // through link → embed → validate, with durable per-step status + quality rollup.
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_readiness_runs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        domain_pack_id TEXT,
        label TEXT NOT NULL,
        size_target INTEGER NOT NULL,
        size_actual INTEGER,
        status TEXT NOT NULL DEFAULT 'draft',
        link_job_id TEXT,
        embed_job_id TEXT,
        validate_job_id TEXT,
        quality_summary JSONB,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        CONSTRAINT knowledge_readiness_runs_status_check CHECK (
          status IN ('draft', 'linking', 'linked', 'embedding', 'embedded', 'validating', 'complete', 'archived')
        )
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_readiness_runs_workspace_updated
      ON knowledge_readiness_runs (workspace_id, updated_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_readiness_runs_workspace_status
      ON knowledge_readiness_runs (workspace_id, status)
    `;
    // Cohort membership (store-neutral: units may live in Postgres or Surreal).
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_readiness_run_units (
        run_id TEXT NOT NULL REFERENCES knowledge_readiness_runs(id) ON DELETE CASCADE,
        unit_id TEXT NOT NULL,
        PRIMARY KEY (run_id, unit_id)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_readiness_run_units_unit
      ON knowledge_readiness_run_units (unit_id)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_graph_targets (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'surreal',
        endpoint TEXT NOT NULL,
        namespace TEXT NOT NULL,
        database TEXT NOT NULL,
        username TEXT,
        secret_ciphertext TEXT,
        secret_iv TEXT,
        secret_auth_tag TEXT,
        secret_encryption_version INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'untested',
        last_tested_at BIGINT,
        last_error TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        CONSTRAINT knowledge_graph_targets_status_check CHECK (status IN ('untested', 'ok', 'error')),
        CONSTRAINT knowledge_graph_targets_workspace_unique UNIQUE (workspace_id)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_domain_packs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        ontology JSONB NOT NULL,
        prompts JSONB NOT NULL DEFAULT '{}'::jsonb,
        graph_schema JSONB NOT NULL,
        passage_profile JSONB NOT NULL,
        entity_linking JSONB,
        embedding JSONB NOT NULL,
        is_builtin BOOLEAN NOT NULL DEFAULT false,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL,
        CONSTRAINT knowledge_domain_packs_workspace_slug_unique UNIQUE (workspace_id, slug)
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_domain_packs_workspace
      ON knowledge_domain_packs (workspace_id, updated_at DESC)
    `;
    await sql`ALTER TABLE knowledge_domain_packs ADD COLUMN IF NOT EXISTS quality_preset TEXT NOT NULL DEFAULT 'production'`;
    await sql`ALTER TABLE knowledge_domain_packs ADD COLUMN IF NOT EXISTS cross_model_validation BOOLEAN NOT NULL DEFAULT true`;
    await sql`ALTER TABLE knowledge_domain_packs ADD COLUMN IF NOT EXISTS archetype TEXT`;
    await sql`ALTER TABLE knowledge_domain_packs ADD COLUMN IF NOT EXISTS prompt_template_version INTEGER NOT NULL DEFAULT 1`;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_pipeline_profiles (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        domain_pack_id TEXT NOT NULL REFERENCES knowledge_domain_packs(id) ON DELETE CASCADE,
        graph_target_id TEXT REFERENCES knowledge_graph_targets(id) ON DELETE SET NULL,
        default_stop_after_stage TEXT,
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_pipeline_profiles_workspace
      ON knowledge_pipeline_profiles (workspace_id, updated_at DESC)
    `;
    await sql`ALTER TABLE knowledge_graph_targets ADD COLUMN IF NOT EXISTS use_dashboard_database BOOLEAN NOT NULL DEFAULT false`;
    await sql`ALTER TABLE knowledge_graph_targets ALTER COLUMN endpoint DROP NOT NULL`;
    await sql`ALTER TABLE knowledge_graph_targets ALTER COLUMN namespace DROP NOT NULL`;
    await sql`ALTER TABLE knowledge_graph_targets ALTER COLUMN database DROP NOT NULL`;
    // Graph Library: allow many saved graphs per workspace (one active at a time).
    await sql`ALTER TABLE knowledge_graph_targets DROP CONSTRAINT IF EXISTS knowledge_graph_targets_workspace_unique`;
    await sql`ALTER TABLE knowledge_graph_targets ADD COLUMN IF NOT EXISTS label TEXT`;
    await sql`ALTER TABLE knowledge_graph_targets ADD COLUMN IF NOT EXISTS default_domain_pack_id TEXT REFERENCES knowledge_domain_packs(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE knowledge_graph_targets ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_targets_workspace
      ON knowledge_graph_targets (workspace_id, updated_at DESC)
    `;
    // Cache of computed graph stats per saved graph — avoids re-scanning a large BYO
    // store on every Connect tab load (full count() scans took minutes on big graphs).
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_graph_stats_cache (
        workspace_id TEXT NOT NULL,
        graph_target_id TEXT NOT NULL,
        stats JSONB NOT NULL,
        domain_pack_id TEXT,
        computed_at BIGINT NOT NULL,
        PRIMARY KEY (workspace_id, graph_target_id)
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_graph_sources (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        domain_pack_id TEXT,
        job_id TEXT,
        title TEXT,
        url TEXT,
        text_preview TEXT,
        source_kind TEXT,
        payload JSONB,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_sources_workspace
      ON knowledge_graph_sources (workspace_id, created_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_graph_units (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        domain_pack_id TEXT,
        source_id TEXT,
        unit_type TEXT,
        domain TEXT,
        text TEXT NOT NULL,
        embedding JSONB,
        payload JSONB,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_units_workspace
      ON knowledge_graph_units (workspace_id, created_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_graph_relations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        domain_pack_id TEXT,
        from_unit_id TEXT NOT NULL,
        to_unit_id TEXT NOT NULL,
        relation_type TEXT NOT NULL,
        payload JSONB,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_relations_workspace
      ON knowledge_graph_relations (workspace_id, created_at DESC)
    `;
    // Hot-path indexes (dev mirror of migrations/057): unit-scoped relation deletes
    // (remediation drops) scanned the whole workspace relation set without these.
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_relations_from_unit
      ON knowledge_graph_relations (from_unit_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_relations_to_unit
      ON knowledge_graph_relations (to_unit_id)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_graph_groups (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        domain_pack_id TEXT,
        name TEXT,
        summary TEXT,
        payload JSONB,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_groups_workspace
      ON knowledge_graph_groups (workspace_id, created_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_graph_group_members (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        group_id TEXT NOT NULL REFERENCES knowledge_graph_groups(id) ON DELETE CASCADE,
        unit_id TEXT NOT NULL REFERENCES knowledge_graph_units(id) ON DELETE CASCADE,
        role TEXT,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_graph_group_members_group ON knowledge_graph_group_members (group_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_knowledge_graph_group_members_unit ON knowledge_graph_group_members (unit_id)`;
    await sql`ALTER TABLE knowledge_graph_units ADD COLUMN IF NOT EXISTS validation_status TEXT`;
    await sql`ALTER TABLE knowledge_graph_units ADD COLUMN IF NOT EXISTS validation_note TEXT`;
    await sql`ALTER TABLE knowledge_graph_units ADD COLUMN IF NOT EXISTS source_chunk_index INTEGER`;
    // Hot-path indexes (dev mirror of migrations/058): per-workspace validation
    // aggregates/scans (stats, triage, re-validation scope) and source-grouped reads.
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_units_workspace_validation
      ON knowledge_graph_units (workspace_id, validation_status)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_units_source
      ON knowledge_graph_units (source_id)
    `;
    // Stage 3.2 incremental re-ingest (migrations/059): stable source identity + content
    // version hash so unchanged documents are skipped and changed ones diff their claims.
    await sql`ALTER TABLE knowledge_graph_sources ADD COLUMN IF NOT EXISTS source_key TEXT`;
    await sql`ALTER TABLE knowledge_graph_sources ADD COLUMN IF NOT EXISTS content_hash TEXT`;
    await sql`ALTER TABLE knowledge_graph_sources ADD COLUMN IF NOT EXISTS last_seen_at BIGINT`;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_graph_sources_source_key
      ON knowledge_graph_sources (workspace_id, source_key, created_at DESC)
      WHERE source_key IS NOT NULL
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_review_signals (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        unit_id TEXT,
        ai_status TEXT,
        ai_flag_reason TEXT,
        human_status TEXT NOT NULL,
        human_note TEXT,
        ai_flag_theme TEXT,
        human_note_theme TEXT,
        verdict_delta TEXT NOT NULL,
        action_type TEXT NOT NULL,
        domain_pack_id TEXT,
        pack_archetype TEXT,
        pack_slug TEXT,
        quality_preset TEXT,
        schema_mode TEXT,
        unit_type TEXT,
        source_kind TEXT,
        ingest_job_id TEXT,
        time_since_ingest_complete_ms BIGINT,
        created_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_review_signals_archetype_delta
      ON knowledge_review_signals (pack_archetype, verdict_delta, created_at DESC)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_review_signals_ingest_job
      ON knowledge_review_signals (ingest_job_id, created_at DESC)
    `;
    await sql`ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb`;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_ingest_quality_runs (
        id TEXT PRIMARY KEY,
        window_days INTEGER NOT NULL,
        status TEXT NOT NULL,
        fired JSONB NOT NULL DEFAULT '[]'::jsonb,
        brief_markdown TEXT,
        applied_actions JSONB,
        created_by_user_id TEXT,
        created_at BIGINT NOT NULL,
        applied_at BIGINT,
        CONSTRAINT knowledge_ingest_quality_runs_status_check CHECK (
          status IN ('evaluated', 'applied', 'failed')
        )
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_ingest_quality_runs_created
      ON knowledge_ingest_quality_runs (created_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_source_documents (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        source_kind TEXT NOT NULL,
        name TEXT NOT NULL,
        mime TEXT,
        url TEXT,
        text TEXT,
        char_count INTEGER NOT NULL DEFAULT 0,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'parsed',
        error TEXT,
        parser_provider TEXT,
        created_at BIGINT NOT NULL,
        CONSTRAINT knowledge_source_documents_status_check CHECK (status IN ('parsed', 'failed', 'pending'))
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_source_documents_workspace
      ON knowledge_source_documents (workspace_id, created_at DESC)
    `;
    await sql`ALTER TABLE knowledge_source_documents ADD COLUMN IF NOT EXISTS provenance JSONB`;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_sources (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        label TEXT,
        config JSONB,
        secret_ciphertext TEXT,
        secret_iv TEXT,
        secret_auth_tag TEXT,
        secret_encryption_version INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'untested',
        created_at BIGINT NOT NULL,
        updated_at BIGINT NOT NULL
      )
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_knowledge_sources_workspace
      ON knowledge_sources (workspace_id, updated_at DESC)
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS knowledge_stage_models (
        workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
        config JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at BIGINT NOT NULL
      )
    `;
  })();
  return ensuredIngestionRoutingSchema;
}

/** Read per-stage routing config for a workspace (null when unset). */
export async function getConnectStageRoutingConfig(workspaceId: string): Promise<unknown> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`SELECT config FROM knowledge_stage_models WHERE workspace_id = ${workspaceId} LIMIT 1`;
  if (rows.length === 0) return null;
  return (rows[0] as { config?: unknown }).config ?? null;
}

export async function upsertConnectStageRoutingConfig(workspaceId: string, config: unknown): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const json = JSON.stringify(config ?? {});
  await sql`
    INSERT INTO knowledge_stage_models (workspace_id, config, updated_at)
    VALUES (${workspaceId}, ${json}::jsonb, ${now})
    ON CONFLICT (workspace_id) DO UPDATE SET config = ${json}::jsonb, updated_at = ${now}
  `;
}

/** @deprecated Legacy model-id chains — returns arrays only when config uses old shape. */
export async function getConnectStageModels(workspaceId: string): Promise<Record<string, string[]>> {
  const cfg = await getConnectStageRoutingConfig(workspaceId);
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return {};
  const rec = cfg as Record<string, unknown>;
  if (typeof rec.project_id === "string") return {};
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(rec)) {
    if (Array.isArray(v) && v.every((x) => typeof x === "string")) out[k] = v as string[];
  }
  return out;
}

/** @deprecated Use upsertConnectStageRoutingConfig */
export async function upsertConnectStageModels(workspaceId: string, config: Record<string, string[]>): Promise<void> {
  await upsertConnectStageRoutingConfig(workspaceId, config);
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
  /** Option B: first step in the control-plane graph; linear orderIndex used when edges are empty. */
  entryStepId?: string | null;
  /** Visual editor layout (node positions); JSON blob. */
  flowLayout?: Record<string, unknown> | null;
};

export type RouteStepEdgeRecord = {
  id: string;
  routeId: string;
  fromStepId: string;
  toStepId: string;
  priority: number;
  label: string | null;
  createdAt: number;
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
  /** Phase F: optional model pool JSON (`model_pool` column). */
  modelPool?: Record<string, unknown> | null;
  /** Optional parallel execution group id (metadata; v1 resolver stays linear). */
  parallelGroupId?: string | null;
  /** Optional branch role within a parallel group (e.g. fan_out, fan_in). */
  parallelBranchRole?: string | null;
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
             entry_step_id AS "entryStepId", flow_layout AS "flowLayout",
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
             entry_step_id AS "entryStepId", flow_layout AS "flowLayout",
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
             entry_step_id AS "entryStepId", flow_layout AS "flowLayout",
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
             entry_step_id AS "entryStepId", flow_layout AS "flowLayout",
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
             entry_step_id AS "entryStepId", flow_layout AS "flowLayout",
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

/** List control-plane edges for a route (empty when no graph). */
export async function listRouteStepEdges(
  routeId: string,
  projectId: string,
  userId: string
): Promise<RouteStepEdgeRecord[]> {
  await ensureIngestionRoutingSchema();
  const route = await getRoute(routeId, projectId, userId);
  if (!route) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT id, route_id AS "routeId", from_step_id AS "fromStepId", to_step_id AS "toStepId",
           priority, label, created_at AS "createdAt"
    FROM route_step_edges
    WHERE route_id = ${routeId}
    ORDER BY from_step_id ASC, priority ASC, to_step_id ASC
  `;
  return rows.map((r) => ({
    id: r.id as string,
    routeId: r.routeId as string,
    fromStepId: r.fromStepId as string,
    toStepId: r.toStepId as string,
    priority: Number(r.priority ?? 0),
    label: (r.label as string) ?? null,
    createdAt: Number(r.createdAt),
  })) as RouteStepEdgeRecord[];
}

/** Replace all edges for a route (transactional). Validates step ids belong to the route. */
export async function replaceRouteStepEdges(
  routeId: string,
  projectId: string,
  userId: string,
  edges: Array<{ fromStepId: string; toStepId: string; priority?: number; label?: string | null }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  await ensureIngestionRoutingSchema();
  const route = await getRoute(routeId, projectId, userId);
  if (!route) return { ok: false, error: "route_not_found" };
  const steps = await listRouteSteps(routeId, projectId, userId);
  const stepIds = new Set(steps.map((s) => s.id));
  for (const e of edges) {
    if (!stepIds.has(e.fromStepId) || !stepIds.has(e.toStepId)) {
      return { ok: false, error: "edge_step_not_in_route" };
    }
    if (e.fromStepId === e.toStepId) {
      return { ok: false, error: "edge_self_loop" };
    }
  }
  const sql = getSql();
  const now = Date.now();
  await sql`DELETE FROM route_step_edges WHERE route_id = ${routeId}`;
  for (const e of edges) {
    const id = crypto.randomUUID();
    const pri = typeof e.priority === "number" && Number.isFinite(e.priority) ? e.priority : 0;
    await sql`
      INSERT INTO route_step_edges (id, route_id, from_step_id, to_step_id, priority, label, created_at)
      VALUES (${id}, ${routeId}, ${e.fromStepId}, ${e.toStepId}, ${pri}, ${e.label ?? null}, ${now})
    `;
  }
  return { ok: true };
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
           stage, workload, enabled, version,            published_version AS "publishedVersion",
           entry_step_id AS "entryStepId", flow_layout AS "flowLayout",
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
    entryStepId: (r.entryStepId as string) ?? null,
    flowLayout: r.flowLayout != null ? (r.flowLayout as Record<string, unknown>) : null,
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
    entryStepId?: string | null;
    flowLayout?: Record<string, unknown> | null;
  }
): Promise<RouteRecord | null> {
  await ensureIngestionRoutingSchema();
  const existing = await getRoute(id, projectId, userId);
  if (!existing) return null;
  if (updates.entryStepId !== undefined && updates.entryStepId !== null) {
    const st = await listRouteSteps(id, projectId, userId);
    if (!st.some((s) => s.id === updates.entryStepId)) return null;
  }
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
  const entryStepId = updates.entryStepId !== undefined ? updates.entryStepId : (existing.entryStepId ?? null);
  const flowLayout = updates.flowLayout !== undefined ? updates.flowLayout : (existing.flowLayout ?? null);
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
    entryStepId,
    flowLayout,
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
        entry_step_id = ${entryStepId},
        flow_layout = ${flowLayout != null ? JSON.stringify(flowLayout) : null},
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
           notes, model_pool AS "modelPool", parallel_group_id AS "parallelGroupId",
           parallel_branch_role AS "parallelBranchRole",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM route_steps
    WHERE route_id = ${routeId}
    ORDER BY order_index ASC
  `;
  return rows.map((r) => mapRouteStepRow(r)) as RouteStepRecord[];
}

/** List all route steps for a project in one query (ordered by route, then orderIndex). */
export async function listRouteStepsByProject(projectId: string, userId: string): Promise<RouteStepRecord[]> {
  await ensureIngestionRoutingSchema();
  const project = await getProject(projectId, userId);
  if (!project) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT rs.id, rs.route_id AS "routeId", rs.order_index AS "orderIndex", rs.provider_preference AS "providerPreference",
           rs.model_id AS "modelId", rs.condition_block AS "conditionBlock", rs.fallback_on AS "fallbackOn",
           rs.timeout_ms AS "timeoutMs", rs.enabled,
           rs.label, rs.switch_criteria AS "switchCriteria", rs.retry_policy AS "retryPolicy", rs.cost_policy AS "costPolicy",
           rs.notes, rs.model_pool AS "modelPool", rs.parallel_group_id AS "parallelGroupId",
           rs.parallel_branch_role AS "parallelBranchRole",
           rs.created_at AS "createdAt", rs.updated_at AS "updatedAt"
    FROM route_steps rs
    INNER JOIN routes r ON r.id = rs.route_id
    WHERE r.project_id = ${projectId}
    ORDER BY rs.route_id ASC, rs.order_index ASC
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
    modelPool: (r.modelPool as Record<string, unknown>) ?? null,
    parallelGroupId: (r.parallelGroupId as string) ?? null,
    parallelBranchRole: (r.parallelBranchRole as string) ?? null,
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
  modelPool?: Record<string, unknown> | null;
  parallelGroupId?: string | null;
  parallelBranchRole?: string | null;
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
      model_pool, parallel_group_id, parallel_branch_role,
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
      ${params.modelPool ? JSON.stringify(params.modelPool) : null},
      ${params.parallelGroupId ?? null},
      ${params.parallelBranchRole ?? null},
      ${enabled}, ${now}, ${now}
    )
  `;
  const rows = await sql`
    SELECT id, route_id AS "routeId", order_index AS "orderIndex", provider_preference AS "providerPreference",
           model_id AS "modelId", condition_block AS "conditionBlock", fallback_on AS "fallbackOn",
           timeout_ms AS "timeoutMs", enabled,
           label, switch_criteria AS "switchCriteria", retry_policy AS "retryPolicy", cost_policy AS "costPolicy",
           notes, model_pool AS "modelPool", parallel_group_id AS "parallelGroupId",
           parallel_branch_role AS "parallelBranchRole",
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
    modelPool: Record<string, unknown> | null;
    parallelGroupId: string | null;
    parallelBranchRole: string | null;
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
  const modelPool = updates.modelPool !== undefined ? updates.modelPool : step.modelPool;
  const parallelGroupId =
    updates.parallelGroupId !== undefined ? updates.parallelGroupId : step.parallelGroupId;
  const parallelBranchRole =
    updates.parallelBranchRole !== undefined ? updates.parallelBranchRole : step.parallelBranchRole;
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
        model_pool = ${modelPool != null ? JSON.stringify(modelPool) : null},
        parallel_group_id = ${parallelGroupId},
        parallel_branch_role = ${parallelBranchRole},
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
           notes, model_pool AS "modelPool", parallel_group_id AS "parallelGroupId",
           parallel_branch_role AS "parallelBranchRole",
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
        timeout_ms, enabled, label, switch_criteria, retry_policy, cost_policy, notes,
        model_pool, parallel_group_id, parallel_branch_role,
        created_at, updated_at
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
        ${raw.modelPool && typeof raw.modelPool === "object" ? JSON.stringify(raw.modelPool) : null},
        ${typeof raw.parallelGroupId === "string" ? raw.parallelGroupId : null},
        ${typeof raw.parallelBranchRole === "string" ? raw.parallelBranchRole : null},
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

/** List all bindings for policies in a workspace in one query. */
export async function listPolicyBindingsForWorkspace(workspaceId: string): Promise<PolicyBindingRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT pb.id, pb.policy_id AS "policyId", pb.target_type AS "targetType", pb.target_id AS "targetId", pb.created_at AS "createdAt"
    FROM policy_bindings pb
    INNER JOIN policies p ON pb.policy_id = p.id
    WHERE p.workspace_id = ${workspaceId}
    ORDER BY pb.created_at ASC
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

/**
 * If non-null, POST /bindings should reject (duplicate or conflicting route vs model scope).
 * Same policy may not bind twice to the same target, and may not bind to both `route` and any
 * `route_step` on that route.
 */
export async function getPolicyBindingConflictMessage(params: {
  policyId: string;
  targetType: string;
  targetId: string;
  workspaceId: string;
}): Promise<string | null> {
  const { policyId, targetType, targetId, workspaceId } = params;
  const sql = getSql();

  const dup = await sql`
    SELECT 1 AS ok
    FROM policy_bindings pb
    INNER JOIN policies p ON p.id = pb.policy_id
    WHERE p.workspace_id = ${workspaceId}
      AND pb.policy_id = ${policyId}
      AND pb.target_type = ${targetType}
      AND pb.target_id = ${targetId}
    LIMIT 1
  `;
  if (dup.length > 0) {
    return "This guard rail is already attached at this scope.";
  }

  if (targetType === "route_step") {
    const routeRows = await sql`
      SELECT rs.route_id AS "routeId"
      FROM route_steps rs
      INNER JOIN routes r ON r.id = rs.route_id
      INNER JOIN projects pr ON pr.id = r.project_id
      WHERE rs.id = ${targetId}
        AND pr.workspace_id = ${workspaceId}
      LIMIT 1
    `;
    const routeId = routeRows[0]?.routeId as string | undefined;
    if (!routeId) {
      return "That model is not in this workspace or no longer exists.";
    }
    const onRoute = await sql`
      SELECT 1 AS ok
      FROM policy_bindings pb
      INNER JOIN policies p ON p.id = pb.policy_id
      WHERE p.workspace_id = ${workspaceId}
        AND pb.policy_id = ${policyId}
        AND pb.target_type = 'route'
        AND pb.target_id = ${routeId}
      LIMIT 1
    `;
    if (onRoute.length > 0) {
      return "This guard rail is already attached to the entire route. Remove it there first, or pick a different guard rail.";
    }
  }

  if (targetType === "route") {
    const routeOk = await sql`
      SELECT 1 AS ok
      FROM routes r
      INNER JOIN projects pr ON pr.id = r.project_id
      WHERE r.id = ${targetId}
        AND pr.workspace_id = ${workspaceId}
      LIMIT 1
    `;
    if (routeOk.length === 0) return null;

    const onStep = await sql`
      SELECT 1 AS ok
      FROM policy_bindings pb
      INNER JOIN policies p ON p.id = pb.policy_id
      WHERE p.workspace_id = ${workspaceId}
        AND pb.policy_id = ${policyId}
        AND pb.target_type = 'route_step'
        AND pb.target_id IN (SELECT id FROM route_steps WHERE route_id = ${targetId})
      LIMIT 1
    `;
    if (onStep.length > 0) {
      return "This guard rail is already attached to a model in this route. Remove those bindings first, or pick a different guard rail.";
    }
  }

  return null;
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
            : targetType === "route_step"
              ? sql`workspace_id = ${workspaceId} AND COALESCE(metadata->>'routeStepId','') = ${targetId}`
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
  /** When evaluating at step granularity (Option B / per-step policy bindings). */
  routeStepId?: string;
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
  if (context.routeStepId) targets.push({ targetType: "route_step", targetId: context.routeStepId });

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

/** Daily request counts (UTC calendar days) for usage charts. */
export async function getRequestLogCountsByUtcDay(
  workspaceId: string,
  since: number,
  until: number,
  projectId?: string | null,
): Promise<{ day: string; count: number }[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT
      to_char(timezone('UTC', to_timestamp(created_at / 1000.0)), 'YYYY-MM-DD') AS day,
      COUNT(*)::bigint AS cnt
    FROM request_logs
    WHERE workspace_id = ${workspaceId}
      AND created_at >= ${since}
      AND created_at <= ${until}
      ${projectId != null && projectId !== "" ? sql`AND project_id = ${projectId}` : sql``}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r: Record<string, unknown>) => ({
    day: String(r.day),
    count: Number(r.cnt) || 0,
  }));
}

/** Sum estimated_cost (USD) by resolved model id for bar charts. */
export async function getEstimatedCostUsdByModel(
  workspaceId: string,
  since: number,
  until: number,
  limit = 12,
  projectId?: string | null,
): Promise<{ model: string; costUsd: number }[]> {
  const sql = getSql();
  const safeLimit = Math.min(Math.max(1, limit), 24);
  const rows = await sql`
    SELECT
      COALESCE(NULLIF(btrim(COALESCE(final_model_id, '')), ''), 'unknown') AS model,
      COALESCE(SUM(estimated_cost), 0)::float8 AS cost_usd
    FROM request_logs
    WHERE workspace_id = ${workspaceId}
      AND created_at >= ${since}
      AND created_at <= ${until}
      ${projectId != null && projectId !== "" ? sql`AND project_id = ${projectId}` : sql``}
    GROUP BY 1
    ORDER BY cost_usd DESC NULLS LAST
    LIMIT ${safeLimit}
  `;
  return rows.map((r: Record<string, unknown>) => ({
    model: String(r.model),
    costUsd: Number(r.cost_usd) || 0,
  }));
}

// --- Workspace webhooks (outbound; MVP: policy.published) ---

export type WorkspaceWebhookRecord = {
  id: string;
  workspaceId: string;
  url: string;
  eventTypes: string[];
  disabled: boolean;
  createdAt: number;
};

type WebhookSecretRow = {
  id: string;
  workspaceId: string;
  url: string;
  eventTypes: string[];
  disabled: boolean;
  createdAt: number;
  signingSecretCiphertext: string | null;
  signingSecretIv: string | null;
  signingSecretAuthTag: string | null;
  signingSecretEncryptionVersion: number;
};

export async function listWorkspaceWebhooks(workspaceId: string): Promise<WorkspaceWebhookRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", url,
           event_types AS "eventTypes", disabled, created_at AS "createdAt"
    FROM workspace_webhooks
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return (rows as Record<string, unknown>[]).map((r) => {
    const et = r.eventTypes;
    let eventTypes: string[] = [];
    if (Array.isArray(et)) {
      eventTypes = et.map(String);
    } else if (typeof et === "string") {
      try {
        const p = JSON.parse(et) as unknown;
        if (Array.isArray(p)) eventTypes = p.map(String);
      } catch {
        eventTypes = [];
      }
    }
    return {
      id: String(r.id),
      workspaceId: String(r.workspaceId),
      url: String(r.url),
      eventTypes,
      disabled: Boolean(r.disabled),
      createdAt: Number(r.createdAt) || 0,
    };
  });
}

export async function createWorkspaceWebhook(params: {
  workspaceId: string;
  url: string;
  eventTypes?: string[];
  signingSecretPlaintext: string;
}): Promise<
  | { ok: true; record: WorkspaceWebhookRecord; signingSecretPlaintext: string }
  | { ok: false; error: string }
> {
  const enc = encryptProviderSecret(params.signingSecretPlaintext);
  if (!enc.ok) {
    return { ok: false, error: enc.error };
  }
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const types = params.eventTypes?.length ? params.eventTypes : ["policy.published"];
  const typesJson = JSON.stringify(types);
  const p = enc.payload;
  await sql`
    INSERT INTO workspace_webhooks (
      id, workspace_id, url, event_types,
      signing_secret_ciphertext, signing_secret_iv, signing_secret_auth_tag, signing_secret_encryption_version,
      disabled, created_at
    )
    VALUES (
      ${id}, ${params.workspaceId}, ${params.url}, ${typesJson},
      ${p.ciphertextB64}, ${p.ivB64}, ${p.authTagB64}, ${p.encryptionVersion},
      FALSE, ${createdAt}
    )
  `;
  return {
    ok: true,
    record: {
      id,
      workspaceId: params.workspaceId,
      url: params.url,
      eventTypes: types,
      disabled: false,
      createdAt,
    },
    signingSecretPlaintext: params.signingSecretPlaintext,
  };
}

export async function deleteWorkspaceWebhook(
  workspaceId: string,
  webhookId: string,
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM workspace_webhooks
    WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    RETURNING id
  `;
  return (rows as { id: string }[]).length > 0;
}

/** Internal: load webhooks subscribed to `eventType` with decryptable signing secrets. */
export async function listWorkspaceWebhooksForDelivery(
  workspaceId: string,
  eventType: string,
): Promise<{ id: string; url: string; signingSecretPlaintext: string }[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", url, event_types AS "eventTypes", disabled, created_at AS "createdAt",
           signing_secret_ciphertext AS "signingSecretCiphertext",
           signing_secret_iv AS "signingSecretIv",
           signing_secret_auth_tag AS "signingSecretAuthTag",
           signing_secret_encryption_version AS "signingSecretEncryptionVersion"
    FROM workspace_webhooks
    WHERE workspace_id = ${workspaceId} AND disabled = FALSE
  `;
  const out: { id: string; url: string; signingSecretPlaintext: string }[] = [];
  for (const raw of rows as WebhookSecretRow[]) {
    const r = raw;
    let types: string[] = [];
    const et = r.eventTypes as unknown;
    if (Array.isArray(et)) types = et.map(String);
    else if (typeof et === "string") {
      try {
        const p = JSON.parse(et) as unknown;
        if (Array.isArray(p)) types = p.map(String);
      } catch {
        types = [];
      }
    }
    if (!types.includes(eventType)) continue;
    const dec = decryptProviderSecret({
      credentialCiphertext: r.signingSecretCiphertext,
      credentialIv: r.signingSecretIv,
      credentialAuthTag: r.signingSecretAuthTag,
      encryptionVersion: r.signingSecretEncryptionVersion,
    });
    if (!dec.ok) continue;
    out.push({ id: r.id, url: r.url, signingSecretPlaintext: dec.secret });
  }
  return out;
}

// --- Connect ingest webhooks (public /connect/v1/webhooks; I1) ---

export type ConnectWebhookRecord = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  url: string;
  events: string[];
  qualityThreshold: number | null;
  active: boolean;
  createdAt: number;
};

function parseJsonStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") {
    try {
      const p = JSON.parse(value) as unknown;
      if (Array.isArray(p)) return p.map(String);
    } catch {
      return [];
    }
  }
  return [];
}

function mapConnectWebhookRow(r: Record<string, unknown>): ConnectWebhookRecord {
  return {
    id: String(r.id),
    workspaceId: String(r.workspaceId ?? r.workspace_id),
    projectId: r.projectId != null ? String(r.projectId) : null,
    url: String(r.url),
    events: parseJsonStringArray(r.events),
    qualityThreshold: r.qualityThreshold != null ? Number(r.qualityThreshold) : null,
    active: Boolean(r.active),
    createdAt: Number(r.createdAt) || 0,
  };
}

export async function createConnectWebhook(params: {
  workspaceId: string;
  projectId?: string | null;
  url: string;
  events: string[];
  qualityThreshold?: number | null;
  signingSecretPlaintext: string;
}): Promise<{ ok: true; record: ConnectWebhookRecord } | { ok: false; error: string }> {
  const enc = encryptProviderSecret(params.signingSecretPlaintext);
  if (!enc.ok) return { ok: false, error: enc.error };
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const eventsJson = JSON.stringify(params.events.length ? params.events : ["job.completed"]);
  const p = enc.payload;
  await sql`
    INSERT INTO connect_webhooks (
      id, workspace_id, project_id, url, events, quality_threshold,
      signing_secret_ciphertext, signing_secret_iv, signing_secret_auth_tag, signing_secret_encryption_version,
      active, created_at
    )
    VALUES (
      ${id}, ${params.workspaceId}, ${params.projectId ?? null}, ${params.url}, ${eventsJson},
      ${params.qualityThreshold ?? null},
      ${p.ciphertextB64}, ${p.ivB64}, ${p.authTagB64}, ${p.encryptionVersion},
      TRUE, ${createdAt}
    )
  `;
  return {
    ok: true,
    record: {
      id,
      workspaceId: params.workspaceId,
      projectId: params.projectId ?? null,
      url: params.url,
      events: params.events,
      qualityThreshold: params.qualityThreshold ?? null,
      active: true,
      createdAt,
    },
  };
}

export async function listConnectWebhooks(workspaceId: string): Promise<ConnectWebhookRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", project_id AS "projectId", url, events,
           quality_threshold AS "qualityThreshold", active, created_at AS "createdAt"
    FROM connect_webhooks
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return (rows as Record<string, unknown>[]).map(mapConnectWebhookRow);
}

export async function getConnectWebhook(
  workspaceId: string,
  webhookId: string,
): Promise<ConnectWebhookRecord | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", project_id AS "projectId", url, events,
           quality_threshold AS "qualityThreshold", active, created_at AS "createdAt"
    FROM connect_webhooks
    WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    LIMIT 1
  `;
  const row = (rows as Record<string, unknown>[])[0];
  return row ? mapConnectWebhookRow(row) : null;
}

export async function deleteConnectWebhook(
  workspaceId: string,
  webhookId: string,
): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`
    DELETE FROM connect_webhooks
    WHERE id = ${webhookId} AND workspace_id = ${workspaceId}
    RETURNING id
  `;
  return (rows as { id: string }[]).length > 0;
}

/** Internal: active webhooks for `workspaceId` subscribed to `event`, with decrypted secrets. */
export async function listConnectWebhooksForDelivery(
  workspaceId: string,
  event: string,
): Promise<
  { id: string; url: string; events: string[]; qualityThreshold: number | null; signingSecretPlaintext: string }[]
> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, url, events, quality_threshold AS "qualityThreshold",
           signing_secret_ciphertext AS "signingSecretCiphertext",
           signing_secret_iv AS "signingSecretIv",
           signing_secret_auth_tag AS "signingSecretAuthTag",
           signing_secret_encryption_version AS "signingSecretEncryptionVersion"
    FROM connect_webhooks
    WHERE workspace_id = ${workspaceId} AND active = TRUE
  `;
  const out: {
    id: string;
    url: string;
    events: string[];
    qualityThreshold: number | null;
    signingSecretPlaintext: string;
  }[] = [];
  for (const raw of rows as Record<string, unknown>[]) {
    const events = parseJsonStringArray(raw.events);
    if (!events.includes(event)) continue;
    const dec = decryptProviderSecret({
      credentialCiphertext: raw.signingSecretCiphertext as string | null,
      credentialIv: raw.signingSecretIv as string | null,
      credentialAuthTag: raw.signingSecretAuthTag as string | null,
      encryptionVersion: Number(raw.signingSecretEncryptionVersion ?? 0),
    });
    if (!dec.ok) continue;
    out.push({
      id: String(raw.id),
      url: String(raw.url),
      events,
      qualityThreshold: raw.qualityThreshold != null ? Number(raw.qualityThreshold) : null,
      signingSecretPlaintext: dec.secret,
    });
  }
  return out;
}

export async function recordConnectWebhookDelivery(params: {
  webhookId: string;
  workspaceId: string;
  jobId: string | null;
  event: string;
  attempt: number;
  ok: boolean;
  statusCode?: number | null;
  error?: string | null;
  durationMs?: number | null;
}): Promise<void> {
  try {
    const sql = getSql();
    await sql`
      INSERT INTO connect_webhook_deliveries (
        id, webhook_id, workspace_id, job_id, event, attempt, ok, status_code, error, duration_ms, created_at
      )
      VALUES (
        ${crypto.randomUUID()}, ${params.webhookId}, ${params.workspaceId}, ${params.jobId ?? null},
        ${params.event}, ${params.attempt}, ${params.ok}, ${params.statusCode ?? null},
        ${params.error ? params.error.slice(0, 2000) : null}, ${params.durationMs ?? null}, ${Date.now()}
      )
    `;
  } catch (e) {
    console.error("[connect-webhook] recordConnectWebhookDelivery failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Founders Circle applications (PII in payload — no raw logging)
// ---------------------------------------------------------------------------

export async function insertFoundersApplication(payload: unknown): Promise<string | null> {
  try {
    const sql = getSql();
    const id = `fca_${randomBytes(12).toString("hex")}`;
    const submittedAt = Date.now();
    const json = JSON.stringify(payload ?? null);
    await sql`
      INSERT INTO founders_applications (id, submitted_at_ms, payload)
      VALUES (${id}, ${submittedAt}, ${json})
    `;
    return id;
  } catch {
    console.error("[founders] insertFoundersApplication failed");
    return null;
  }
}

export async function countFoundersApplications(): Promise<number> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT count(*)::int AS c FROM founders_applications`;
    const r = rows[0] as { c: number } | undefined;
    return r?.c ?? 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Hosted runtime jobs (Phase 4 — POST …/runtime/jobs)
// ---------------------------------------------------------------------------

export type HostedRuntimeJobRecord = {
  id: string;
  projectId: string;
  routeId: string;
  userId: string;
  environmentId: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  requestSummary: unknown;
  resultSummary: unknown | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
  idempotencyKeyHash?: string | null;
  cancelRequestedAt?: number | null;
  mergeStrategy?: string | null;
};

/**
 * Stable idempotency key for POST …/runtime/jobs (same inputs → same job row).
 * Hash only; no message content in the hash input beyond what the client sends.
 */
export function hashHostedRuntimeIdempotencyKey(args: {
  projectId: string;
  routeId: string;
  userId: string;
  environmentId: string;
  idempotencyKey: string;
}): string {
  return createHash("sha256")
    .update(
      [
        args.projectId,
        args.routeId,
        args.userId,
        args.environmentId,
        args.idempotencyKey.trim(),
      ].join("|")
    )
    .digest("hex");
}

export async function findHostedRuntimeJobByIdempotencyKey(
  projectId: string,
  userId: string,
  hash: string
): Promise<HostedRuntimeJobRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      project_id AS "projectId",
      route_id AS "routeId",
      user_id AS "userId",
      environment_id AS "environmentId",
      status,
      request_summary AS "requestSummary",
      result_summary AS "resultSummary",
      error_code AS "errorCode",
      error_message AS "errorMessage",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      idempotency_key_hash AS "idempotencyKeyHash",
      cancel_requested_at AS "cancelRequestedAt",
      merge_strategy AS "mergeStrategy"
    FROM hosted_runtime_jobs
    WHERE project_id = ${projectId} AND user_id = ${userId} AND idempotency_key_hash = ${hash}
    LIMIT 1
  `;
  const r = rows[0] as HostedRuntimeJobRecord | undefined;
  return r ?? null;
}

export async function insertHostedRuntimeJob(params: {
  id: string;
  projectId: string;
  routeId: string;
  userId: string;
  environmentId: string;
  requestSummary: unknown;
  idempotencyKeyHash?: string | null;
  mergeStrategy?: string | null;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const reqJson = JSON.stringify(params.requestSummary ?? null);
  await sql`
    INSERT INTO hosted_runtime_jobs (
      id, project_id, route_id, user_id, environment_id, status,
      request_summary, result_summary, error_code, error_message, created_at, updated_at,
      idempotency_key_hash, cancel_requested_at, merge_strategy
    )
    VALUES (
      ${params.id},
      ${params.projectId},
      ${params.routeId},
      ${params.userId},
      ${params.environmentId},
      ${"queued"},
      ${reqJson},
      NULL,
      NULL,
      NULL,
      ${now},
      ${now},
      ${params.idempotencyKeyHash ?? null},
      NULL,
      ${params.mergeStrategy ?? null}
    )
  `;
}

export async function getHostedRuntimeJobForProject(
  jobId: string,
  projectId: string,
  userId: string
): Promise<HostedRuntimeJobRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      project_id AS "projectId",
      route_id AS "routeId",
      user_id AS "userId",
      environment_id AS "environmentId",
      status,
      request_summary AS "requestSummary",
      result_summary AS "resultSummary",
      error_code AS "errorCode",
      error_message AS "errorMessage",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      idempotency_key_hash AS "idempotencyKeyHash",
      cancel_requested_at AS "cancelRequestedAt",
      merge_strategy AS "mergeStrategy"
    FROM hosted_runtime_jobs
    WHERE id = ${jobId} AND project_id = ${projectId} AND user_id = ${userId}
    LIMIT 1
  `;
  const r = rows[0] as HostedRuntimeJobRecord | undefined;
  return r ?? null;
}

/** Worker: load job by id only (row-level security is caller trust). */
export async function getHostedRuntimeJobById(jobId: string): Promise<HostedRuntimeJobRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      id,
      project_id AS "projectId",
      route_id AS "routeId",
      user_id AS "userId",
      environment_id AS "environmentId",
      status,
      request_summary AS "requestSummary",
      result_summary AS "resultSummary",
      error_code AS "errorCode",
      error_message AS "errorMessage",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      idempotency_key_hash AS "idempotencyKeyHash",
      cancel_requested_at AS "cancelRequestedAt",
      merge_strategy AS "mergeStrategy"
    FROM hosted_runtime_jobs
    WHERE id = ${jobId}
    LIMIT 1
  `;
  const r = rows[0] as HostedRuntimeJobRecord | undefined;
  return r ?? null;
}

export async function setHostedRuntimeJobCancelRequested(
  jobId: string,
  projectId: string,
  userId: string
): Promise<boolean> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const rows = await sql`
    UPDATE hosted_runtime_jobs
    SET
      cancel_requested_at = ${now},
      updated_at = ${now},
      status = CASE
        WHEN status = 'queued' THEN 'cancelled'::text
        ELSE status
      END
    WHERE id = ${jobId} AND project_id = ${projectId} AND user_id = ${userId}
      AND status IN ('queued', 'processing')
    RETURNING id
  `;
  return rows.length > 0;
}

/** Claim next queued job for background worker (SKIP LOCKED). */
export async function claimNextQueuedHostedRuntimeJob(): Promise<HostedRuntimeJobRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const rows = await sql`
    WITH c AS (
      SELECT id
      FROM hosted_runtime_jobs
      WHERE status = 'queued' AND cancel_requested_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE hosted_runtime_jobs h
    SET status = 'processing', updated_at = ${now}
    FROM c
    WHERE h.id = c.id
    RETURNING
      h.id,
      h.project_id AS "projectId",
      h.route_id AS "routeId",
      h.user_id AS "userId",
      h.environment_id AS "environmentId",
      h.status,
      h.request_summary AS "requestSummary",
      h.result_summary AS "resultSummary",
      h.error_code AS "errorCode",
      h.error_message AS "errorMessage",
      h.created_at AS "createdAt",
      h.updated_at AS "updatedAt",
      h.idempotency_key_hash AS "idempotencyKeyHash",
      h.cancel_requested_at AS "cancelRequestedAt",
      h.merge_strategy AS "mergeStrategy"
  `;
  const r = rows[0] as HostedRuntimeJobRecord | undefined;
  return r ?? null;
}

export async function updateHostedRuntimeJobById(params: {
  id: string;
  projectId: string;
  userId: string;
  status: HostedRuntimeJobRecord["status"];
  resultSummary?: unknown | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): Promise<boolean> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();

  if (params.status === "completed" && params.resultSummary !== undefined) {
    const rows = await sql`
      UPDATE hosted_runtime_jobs
      SET
        status = ${params.status},
        updated_at = ${now},
        result_summary = ${JSON.stringify(params.resultSummary)},
        error_code = NULL,
        error_message = NULL
      WHERE id = ${params.id} AND project_id = ${params.projectId} AND user_id = ${params.userId}
      RETURNING id
    `;
    return rows.length > 0;
  }

  if (params.status === "failed" && params.errorCode) {
    const rows = await sql`
      UPDATE hosted_runtime_jobs
      SET
        status = ${params.status},
        updated_at = ${now},
        error_code = ${params.errorCode},
        error_message = ${params.errorMessage ?? null}
      WHERE id = ${params.id} AND project_id = ${params.projectId} AND user_id = ${params.userId}
      RETURNING id
    `;
    return rows.length > 0;
  }

  if (params.status === "cancelled") {
    const rows = await sql`
      UPDATE hosted_runtime_jobs
      SET status = ${params.status}, updated_at = ${now}
      WHERE id = ${params.id} AND project_id = ${params.projectId} AND user_id = ${params.userId}
      RETURNING id
    `;
    return rows.length > 0;
  }

  const rows = await sql`
    UPDATE hosted_runtime_jobs
    SET status = ${params.status}, updated_at = ${now}
    WHERE id = ${params.id} AND project_id = ${params.projectId} AND user_id = ${params.userId}
    RETURNING id
  `;
  return rows.length > 0;
}

export type ConnectIngestJobQualityReport = {
  preset?: string;
  ok_pct?: number;
  quarantine_count?: number;
  quarantine_pct?: number;
  weak_pct?: number;
  unsupported_pct?: number;
  pack_readiness_warnings?: string[];
  extraction_warning_count?: number;
  stub_warning?: string | null;
  kg_audit?: { trust_score?: number; total_issues?: number } | null;
  next_actions?: string[];
  /** Validation breakdown counts (retained for the public quality_report projection). */
  validation?: { ok: number; weak: number; unsupported: number; unvalidated: number };
  units?: number;
};

export type GraphRepairJobProgress = {
  job_kind: "graph_revalidate";
  mode: "validate" | "validate_and_remediate";
  phase: "loading" | "validating" | "remediating" | "storing" | "done";
  units_total: number;
  units_processed: number;
  sources_total: number;
  sources_done: number;
  batches_total?: number;
  batches_done?: number;
  remediation_units_total?: number;
  remediation_units_done?: number;
  repaired?: number;
  dropped?: number;
  skipped_no_source?: number;
  quarantine_before?: number;
  quarantine_after?: number;
  preview_only_sources?: number;
  sources_remediation_failed?: number;
  last_error?: string;
  last_error_at?: string;
  last_activity_at: string;
};

export type ConnectIngestJobProgress = {
  percent: number;
  processed: number;
  total: number;
  execution_mode?: "stub" | "full";
  quality_report?: ConnectIngestJobQualityReport;
  graph_repair?: GraphRepairJobProgress;
};

export type ConnectIngestJobRecord = {
  id: string;
  workspaceId: string;
  projectId: string | null;
  status: string;
  label: string | null;
  currentStage: string | null;
  currentAction: string | null;
  progress: ConnectIngestJobProgress | null;
  stages: unknown;
  sources: unknown;
  stopAfterStage: string | null;
  pipelineProfileId: string | null;
  domainPackId: string | null;
  graphTargetId: string | null;
  error: string | null;
  createdAt: number;
  updatedAt: number;
};

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

function parseConnectIngestJobQualityReport(raw: unknown): ConnectIngestJobQualityReport | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  const kgRaw = rec.kg_audit;
  let kg_audit: ConnectIngestJobQualityReport["kg_audit"];
  if (kgRaw && typeof kgRaw === "object" && !Array.isArray(kgRaw)) {
    const kg = kgRaw as Record<string, unknown>;
    kg_audit = {
      ...(typeof kg.trust_score === "number" ? { trust_score: kg.trust_score } : {}),
      ...(typeof kg.total_issues === "number" ? { total_issues: kg.total_issues } : {}),
    };
  }
  const nextRaw = rec.next_actions;
  const next_actions = Array.isArray(nextRaw)
    ? nextRaw.filter((item): item is string => typeof item === "string")
    : undefined;
  const readinessRaw = rec.pack_readiness_warnings;
  const pack_readiness_warnings = Array.isArray(readinessRaw)
    ? readinessRaw.filter((item): item is string => typeof item === "string")
    : undefined;
  const validationRaw = rec.validation;
  let validation: ConnectIngestJobQualityReport["validation"];
  if (validationRaw && typeof validationRaw === "object" && !Array.isArray(validationRaw)) {
    const vr = validationRaw as Record<string, unknown>;
    const num = (k: string) => (typeof vr[k] === "number" ? (vr[k] as number) : 0);
    validation = {
      ok: num("ok"),
      weak: num("weak"),
      unsupported: num("unsupported"),
      unvalidated: num("unvalidated"),
    };
  }
  const report: ConnectIngestJobQualityReport = {
    ...(typeof rec.preset === "string" ? { preset: rec.preset } : {}),
    ...(typeof rec.ok_pct === "number" ? { ok_pct: rec.ok_pct } : {}),
    ...(typeof rec.quarantine_count === "number" ? { quarantine_count: rec.quarantine_count } : {}),
    ...(typeof rec.quarantine_pct === "number" ? { quarantine_pct: rec.quarantine_pct } : {}),
    ...(typeof rec.weak_pct === "number" ? { weak_pct: rec.weak_pct } : {}),
    ...(typeof rec.unsupported_pct === "number" ? { unsupported_pct: rec.unsupported_pct } : {}),
    ...(pack_readiness_warnings && pack_readiness_warnings.length > 0
      ? { pack_readiness_warnings }
      : {}),
    ...(typeof rec.extraction_warning_count === "number"
      ? { extraction_warning_count: rec.extraction_warning_count }
      : {}),
    ...(rec.stub_warning === null || typeof rec.stub_warning === "string"
      ? { stub_warning: rec.stub_warning as string | null }
      : {}),
    ...(kg_audit && Object.keys(kg_audit).length > 0 ? { kg_audit } : {}),
    ...(next_actions && next_actions.length > 0 ? { next_actions } : {}),
    ...(validation ? { validation } : {}),
    ...(typeof rec.units === "number" ? { units: rec.units } : {}),
  };
  return Object.keys(report).length > 0 ? report : undefined;
}

/**
 * Project the internal quality report onto the public ConnectIngestQualityReport
 * contract (C2). `remediation_applied` is read from the job's remediating stage
 * status; `assessed_at` is the job's terminal update timestamp.
 */
export function toPublicConnectIngestQualityReport(
  report: ConnectIngestJobQualityReport | undefined,
  args: { stages: unknown; updatedAtMs: number },
): {
  trust_score: number;
  supported_count: number;
  weak_count: number;
  unsupported_count: number;
  total_count: number;
  remediation_applied: boolean;
  assessed_at: string;
} | null {
  if (!report) return null;
  const v = report.validation;
  const supported = v?.ok ?? 0;
  const weak = v?.weak ?? 0;
  const unsupported = v?.unsupported ?? 0;
  const unvalidated = v?.unvalidated ?? 0;
  const total = report.units ?? supported + weak + unsupported + unvalidated;
  const trust = report.kg_audit?.trust_score;
  const remediationApplied = Array.isArray(args.stages)
    ? args.stages.some(
        (s) =>
          s != null &&
          typeof s === "object" &&
          (s as Record<string, unknown>).stage === "remediating" &&
          (s as Record<string, unknown>).status === "completed",
      )
    : false;
  return {
    trust_score: typeof trust === "number" ? Math.min(100, Math.max(0, trust)) : 0,
    supported_count: supported,
    weak_count: weak,
    unsupported_count: unsupported,
    total_count: total,
    remediation_applied: remediationApplied,
    assessed_at: msToIso(args.updatedAtMs),
  };
}

function parseGraphRepairJobProgress(raw: unknown): GraphRepairJobProgress | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const rec = raw as Record<string, unknown>;
  if (rec.job_kind !== "graph_revalidate") return undefined;
  const mode = rec.mode === "validate" || rec.mode === "validate_and_remediate" ? rec.mode : null;
  const phase =
    rec.phase === "loading" ||
    rec.phase === "validating" ||
    rec.phase === "remediating" ||
    rec.phase === "storing" ||
    rec.phase === "done"
      ? rec.phase
      : null;
  const unitsTotal = Number(rec.units_total);
  const unitsProcessed = Number(rec.units_processed);
  const sourcesTotal = Number(rec.sources_total);
  const sourcesDone = Number(rec.sources_done);
  const lastActivity =
    typeof rec.last_activity_at === "string" && rec.last_activity_at.trim()
      ? rec.last_activity_at.trim()
      : null;
  if (
    !mode ||
    !phase ||
    !Number.isFinite(unitsTotal) ||
    !Number.isFinite(unitsProcessed) ||
    !Number.isFinite(sourcesTotal) ||
    !Number.isFinite(sourcesDone) ||
    !lastActivity
  ) {
    return undefined;
  }
  const numOpt = (key: string) => {
    const n = Number(rec[key]);
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : undefined;
  };
  return {
    job_kind: "graph_revalidate",
    mode,
    phase,
    units_total: Math.max(0, Math.round(unitsTotal)),
    units_processed: Math.max(0, Math.round(unitsProcessed)),
    sources_total: Math.max(1, Math.round(sourcesTotal)),
    sources_done: Math.max(0, Math.round(sourcesDone)),
    ...(numOpt("batches_total") != null ? { batches_total: numOpt("batches_total") } : {}),
    ...(numOpt("batches_done") != null ? { batches_done: numOpt("batches_done") } : {}),
    ...(numOpt("remediation_units_total") != null
      ? { remediation_units_total: numOpt("remediation_units_total") }
      : {}),
    ...(numOpt("remediation_units_done") != null
      ? { remediation_units_done: numOpt("remediation_units_done") }
      : {}),
    ...(numOpt("repaired") != null ? { repaired: numOpt("repaired") } : {}),
    ...(numOpt("dropped") != null ? { dropped: numOpt("dropped") } : {}),
    ...(numOpt("skipped_no_source") != null ? { skipped_no_source: numOpt("skipped_no_source") } : {}),
    ...(numOpt("quarantine_before") != null ? { quarantine_before: numOpt("quarantine_before") } : {}),
    ...(numOpt("quarantine_after") != null ? { quarantine_after: numOpt("quarantine_after") } : {}),
    ...(numOpt("preview_only_sources") != null
      ? { preview_only_sources: numOpt("preview_only_sources") }
      : {}),
    ...(numOpt("sources_remediation_failed") != null
      ? { sources_remediation_failed: numOpt("sources_remediation_failed") }
      : {}),
    ...(typeof rec.last_error === "string" && rec.last_error.trim()
      ? { last_error: rec.last_error.trim() }
      : {}),
    ...(typeof rec.last_error_at === "string" && rec.last_error_at.trim()
      ? { last_error_at: rec.last_error_at.trim() }
      : {}),
    last_activity_at: lastActivity,
  };
}

function parseConnectIngestJobProgress(raw: unknown): ConnectIngestJobProgress | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const percent = Number(rec.percent);
  const processed = Number(rec.processed);
  const total = Number(rec.total);
  if (!Number.isFinite(percent) || !Number.isFinite(processed) || !Number.isFinite(total)) {
    return null;
  }
  const quality_report = parseConnectIngestJobQualityReport(rec.quality_report);
  const graph_repair = parseGraphRepairJobProgress(rec.graph_repair);
  return {
    percent: Math.min(100, Math.max(0, Math.round(percent))),
    processed: Math.max(0, Math.round(processed)),
    total: Math.max(1, Math.round(total)),
    ...(rec.execution_mode === "stub" || rec.execution_mode === "full"
      ? { execution_mode: rec.execution_mode }
      : {}),
    ...(quality_report ? { quality_report } : {}),
    ...(graph_repair ? { graph_repair } : {}),
  };
}

export function connectIngestJobRecordToApi(
  row: ConnectIngestJobRecord,
  opts?: { includeSources?: boolean },
): {
  id: string;
  workspace_id: string;
  status: string;
  label?: string;
  created_at: string;
  updated_at: string;
  current_stage?: string;
  current_action?: string;
  progress?: ConnectIngestJobProgress;
  stages?: unknown;
  sources?: unknown;
  stop_after_stage?: string;
  pipeline_profile_id?: string;
  domain_pack_id?: string;
  graph_target_id?: string;
  quality_report?: ReturnType<typeof toPublicConnectIngestQualityReport>;
  error?: string;
} {
  const qualityReport = toPublicConnectIngestQualityReport(row.progress?.quality_report, {
    stages: row.stages,
    updatedAtMs: row.updatedAt,
  });
  return {
    id: row.id,
    workspace_id: row.workspaceId,
    status: row.status,
    ...(row.label ? { label: row.label } : {}),
    created_at: msToIso(row.createdAt),
    updated_at: msToIso(row.updatedAt),
    ...(row.currentStage ? { current_stage: row.currentStage } : {}),
    ...(row.currentAction ? { current_action: row.currentAction } : {}),
    ...(row.progress ? { progress: row.progress } : {}),
    stages: reconcileConnectIngestJobStagesForApi(normalizeConnectIngestStages(row.stages), {
      status: row.status,
      currentStage: row.currentStage,
      currentAction: row.currentAction,
    }),
    ...(opts?.includeSources && Array.isArray(row.sources) ? { sources: row.sources } : {}),
    ...(row.stopAfterStage ? { stop_after_stage: row.stopAfterStage } : {}),
    ...(row.pipelineProfileId ? { pipeline_profile_id: row.pipelineProfileId } : {}),
    ...(row.domainPackId ? { domain_pack_id: row.domainPackId } : {}),
    ...(row.graphTargetId ? { graph_target_id: row.graphTargetId } : {}),
    ...(qualityReport ? { quality_report: qualityReport } : {}),
    ...(row.error ? { error: row.error } : {}),
  };
}

function mapConnectIngestJobRow(row: Record<string, unknown>): ConnectIngestJobRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    projectId: row.project_id != null ? String(row.project_id) : null,
    status: String(row.status),
    label: row.label != null ? String(row.label) : null,
    currentStage: row.current_stage != null ? String(row.current_stage) : null,
    currentAction: row.current_action != null ? String(row.current_action) : null,
    progress: parseConnectIngestJobProgress(row.progress),
    stages: normalizeConnectIngestStages(row.stages),
    sources: row.sources,
    stopAfterStage: row.stop_after_stage != null ? String(row.stop_after_stage) : null,
    pipelineProfileId: row.pipeline_profile_id != null ? String(row.pipeline_profile_id) : null,
    domainPackId: row.domain_pack_id != null ? String(row.domain_pack_id) : null,
    graphTargetId: row.graph_target_id != null ? String(row.graph_target_id) : null,
    error: row.error != null ? String(row.error) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function insertConnectIngestJob(params: {
  id: string;
  workspaceId: string;
  projectId?: string | null;
  label?: string | null;
  stages: unknown;
  sources: unknown;
  stopAfterStage?: string | null;
  pipelineProfileId?: string | null;
  domainPackId?: string | null;
  graphTargetId?: string | null;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const stagesJson = JSON.stringify(params.stages ?? []);
  const sourcesJson = JSON.stringify(params.sources ?? []);
  await sql`
    INSERT INTO knowledge_ingest_jobs (
      id, workspace_id, project_id, status, label, current_stage, stages, sources,
      stop_after_stage, pipeline_profile_id, domain_pack_id, graph_target_id, error, created_at, updated_at
    )
    VALUES (
      ${params.id},
      ${params.workspaceId},
      ${params.projectId ?? null},
      ${"pending"},
      ${params.label ?? null},
      NULL,
      ${stagesJson}::jsonb,
      ${sourcesJson}::jsonb,
      ${params.stopAfterStage ?? null},
      ${params.pipelineProfileId ?? null},
      ${params.domainPackId ?? null},
      ${params.graphTargetId ?? null},
      NULL,
      ${now},
      ${now}
    )
  `;
}

export async function listConnectIngestJobsForWorkspace(params: {
  workspaceId: string;
  projectId?: string;
  /** Max rows to return (default 20, max 100). Fetch limit+1 to detect next page. */
  limit?: number;
  /** Opaque base64url cursor encoding `createdAt_iso|id` from the last row of the previous page. */
  cursor?: string;
}): Promise<ConnectIngestJobRecord[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);

  // Decode cursor into keyset components.
  let cursorCreatedAt: Date | null = null;
  let cursorId: string | null = null;
  if (params.cursor) {
    try {
      const decoded = Buffer.from(params.cursor, "base64url").toString("utf8");
      const sep = decoded.lastIndexOf("|");
      if (sep > 0) {
        cursorCreatedAt = new Date(decoded.slice(0, sep));
        cursorId = decoded.slice(sep + 1);
        if (isNaN(cursorCreatedAt.getTime()) || !cursorId) {
          cursorCreatedAt = null;
          cursorId = null;
        }
      }
    } catch {
      // invalid cursor — ignore and start from beginning
    }
  }

  const hasCursor = cursorCreatedAt !== null && cursorId !== null;
  // Fetch limit+1 so the handler can detect whether a next page exists.
  const fetchLimit = limit + 1;

  const rows = hasCursor
    ? params.projectId
      ? await sql`
          SELECT *
          FROM knowledge_ingest_jobs
          WHERE workspace_id = ${params.workspaceId}
            AND project_id = ${params.projectId}
            AND (
              created_at < ${cursorCreatedAt!}
              OR (created_at = ${cursorCreatedAt!} AND id < ${cursorId!})
            )
          ORDER BY created_at DESC, id DESC
          LIMIT ${fetchLimit}
        `
      : await sql`
          SELECT *
          FROM knowledge_ingest_jobs
          WHERE workspace_id = ${params.workspaceId}
            AND (
              created_at < ${cursorCreatedAt!}
              OR (created_at = ${cursorCreatedAt!} AND id < ${cursorId!})
            )
          ORDER BY created_at DESC, id DESC
          LIMIT ${fetchLimit}
        `
    : params.projectId
      ? await sql`
          SELECT *
          FROM knowledge_ingest_jobs
          WHERE workspace_id = ${params.workspaceId} AND project_id = ${params.projectId}
          ORDER BY created_at DESC, id DESC
          LIMIT ${fetchLimit}
        `
      : await sql`
          SELECT *
          FROM knowledge_ingest_jobs
          WHERE workspace_id = ${params.workspaceId}
          ORDER BY created_at DESC, id DESC
          LIMIT ${fetchLimit}
        `;
  return rows.map((row) => mapConnectIngestJobRow(row as Record<string, unknown>));
}

export async function countConnectIngestJobsForWorkspace(params: {
  workspaceId: string;
  projectId?: string;
}): Promise<number> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = params.projectId
    ? await sql`
        SELECT COUNT(*)::int AS n
        FROM knowledge_ingest_jobs
        WHERE workspace_id = ${params.workspaceId} AND project_id = ${params.projectId}
      `
    : await sql`
        SELECT COUNT(*)::int AS n
        FROM knowledge_ingest_jobs
        WHERE workspace_id = ${params.workspaceId}
      `;
  return (rows[0] as Record<string, unknown>)?.n as number ?? 0;
}

/** Returns the cached response for an idempotency key, or null if not found / expired. */
export async function getIdempotencyKey(params: {
  workspaceId: string;
  key: string;
}): Promise<{ status: number; body: Record<string, unknown> } | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT response_status, response_body
    FROM connect_ingest_idempotency_keys
    WHERE workspace_id = ${params.workspaceId}
      AND idempotency_key = ${params.key}
      AND expires_at > NOW()
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    status: row.response_status as number,
    body: row.response_body as Record<string, unknown>,
  };
}

/** Stores an idempotency key result with a 24-hour TTL. Upserts to handle races. */
export async function storeIdempotencyKey(params: {
  workspaceId: string;
  key: string;
  status: number;
  body: Record<string, unknown>;
}): Promise<void> {
  const sql = getSql();
  await sql`
    INSERT INTO connect_ingest_idempotency_keys
      (workspace_id, idempotency_key, response_status, response_body, expires_at)
    VALUES (
      ${params.workspaceId},
      ${params.key},
      ${params.status},
      ${JSON.stringify(params.body)},
      NOW() + INTERVAL '24 hours'
    )
    ON CONFLICT (workspace_id, idempotency_key) DO NOTHING
  `;
}

export async function getConnectIngestJobForWorkspace(params: {
  jobId: string;
  workspaceId: string;
  projectId?: string;
}): Promise<ConnectIngestJobRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = params.projectId
    ? await sql`
        SELECT *
        FROM knowledge_ingest_jobs
        WHERE id = ${params.jobId}
          AND workspace_id = ${params.workspaceId}
          AND project_id = ${params.projectId}
        LIMIT 1
      `
    : await sql`
        SELECT *
        FROM knowledge_ingest_jobs
        WHERE id = ${params.jobId} AND workspace_id = ${params.workspaceId}
        LIMIT 1
      `;
  if (rows.length === 0) return null;
  return mapConnectIngestJobRow(rows[0] as Record<string, unknown>);
}

export async function claimNextPendingConnectIngestJob(): Promise<ConnectIngestJobRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const rows = await sql`
    WITH c AS (
      SELECT id
      FROM knowledge_ingest_jobs
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE knowledge_ingest_jobs j
    SET status = 'running', updated_at = ${now}
    FROM c
    WHERE j.id = c.id
    RETURNING j.*
  `;
  if (rows.length === 0) return null;
  return mapConnectIngestJobRow(rows[0] as Record<string, unknown>);
}

export async function updateConnectIngestJobById(params: {
  id: string;
  status: string;
  /** Omit to leave `current_stage` unchanged; pass `null` to clear. */
  currentStage?: string | null;
  /** Omit to leave `current_action` unchanged. */
  currentAction?: string | null;
  progress?: ConnectIngestJobProgress | null;
  stages?: unknown;
  error?: string | null;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const stagesJson =
    params.stages !== undefined ? JSON.stringify(params.stages) : null;
  const progressJson =
    params.progress !== undefined
      ? params.progress != null
        ? JSON.stringify(params.progress)
        : null
      : undefined;
  const patchStage = params.currentStage !== undefined;
  const patchAction = params.currentAction !== undefined;

  if (progressJson !== undefined) {
    if (patchStage && patchAction) {
      await sql`
        UPDATE knowledge_ingest_jobs
        SET
          status = ${params.status},
          current_stage = ${params.currentStage},
          current_action = ${params.currentAction},
          progress = ${progressJson}::jsonb,
          stages = COALESCE(${stagesJson}::jsonb, stages),
          error = ${params.error ?? null},
          updated_at = ${now}
        WHERE id = ${params.id}
      `;
    } else if (patchStage) {
      await sql`
        UPDATE knowledge_ingest_jobs
        SET
          status = ${params.status},
          current_stage = ${params.currentStage},
          progress = ${progressJson}::jsonb,
          stages = COALESCE(${stagesJson}::jsonb, stages),
          error = ${params.error ?? null},
          updated_at = ${now}
        WHERE id = ${params.id}
      `;
    } else if (patchAction) {
      await sql`
        UPDATE knowledge_ingest_jobs
        SET
          status = ${params.status},
          current_action = ${params.currentAction},
          progress = ${progressJson}::jsonb,
          stages = COALESCE(${stagesJson}::jsonb, stages),
          error = ${params.error ?? null},
          updated_at = ${now}
        WHERE id = ${params.id}
      `;
    } else {
      await sql`
        UPDATE knowledge_ingest_jobs
        SET
          status = ${params.status},
          progress = ${progressJson}::jsonb,
          stages = COALESCE(${stagesJson}::jsonb, stages),
          error = ${params.error ?? null},
          updated_at = ${now}
        WHERE id = ${params.id}
      `;
    }
    return;
  }

  if (patchStage && patchAction) {
    await sql`
      UPDATE knowledge_ingest_jobs
      SET
        status = ${params.status},
        current_stage = ${params.currentStage},
        current_action = ${params.currentAction},
        stages = COALESCE(${stagesJson}::jsonb, stages),
        error = ${params.error ?? null},
        updated_at = ${now}
      WHERE id = ${params.id}
    `;
    return;
  }
  if (patchStage) {
    await sql`
      UPDATE knowledge_ingest_jobs
      SET
        status = ${params.status},
        current_stage = ${params.currentStage},
        stages = COALESCE(${stagesJson}::jsonb, stages),
        error = ${params.error ?? null},
        updated_at = ${now}
      WHERE id = ${params.id}
    `;
    return;
  }
  if (patchAction) {
    await sql`
      UPDATE knowledge_ingest_jobs
      SET
        status = ${params.status},
        current_action = ${params.currentAction},
        stages = COALESCE(${stagesJson}::jsonb, stages),
        error = ${params.error ?? null},
        updated_at = ${now}
      WHERE id = ${params.id}
    `;
    return;
  }

  await sql`
    UPDATE knowledge_ingest_jobs
    SET
      status = ${params.status},
      stages = COALESCE(${stagesJson}::jsonb, stages),
      error = ${params.error ?? null},
      updated_at = ${now}
    WHERE id = ${params.id}
  `;
}

export async function appendConnectIngestJobLog(params: {
  jobId: string;
  line: string;
}): Promise<number> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const rows = await sql`
    INSERT INTO knowledge_ingest_job_logs (job_id, line, created_at)
    VALUES (${params.jobId}, ${params.line.slice(0, 4000)}, ${now})
    RETURNING id
  `;
  return Number(rows[0]?.id ?? 0);
}

export async function listConnectIngestJobLogsSince(params: {
  jobId: string;
  sinceId?: number;
  limit?: number;
}): Promise<{ id: number; line: string; created_at: number }[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);
  const since = Math.max(0, params.sinceId ?? 0);
  const rows =
    since > 0
      ? await sql`
          SELECT id, line, created_at
          FROM knowledge_ingest_job_logs
          WHERE job_id = ${params.jobId} AND id > ${since}
          ORDER BY id ASC
          LIMIT ${limit}
        `
      : await sql`
          SELECT id, line, created_at
          FROM knowledge_ingest_job_logs
          WHERE job_id = ${params.jobId}
          ORDER BY id DESC
          LIMIT ${limit}
        `;
  const mapped = rows.map((row) => ({
    id: Number(row.id),
    line: String(row.line),
    created_at: Number(row.created_at),
  }));
  return since > 0 ? mapped : mapped.reverse();
}

export async function countConnectIngestJobLogs(jobId: string): Promise<number> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT COUNT(*)::int AS n FROM knowledge_ingest_job_logs WHERE job_id = ${jobId}
  `;
  return Number(rows[0]?.n ?? 0);
}

/** Cancel a workspace-scoped job if it is still pending or running. Returns true if a row changed. */
export async function cancelConnectIngestJobForWorkspace(params: {
  jobId: string;
  workspaceId: string;
  projectId?: string;
}): Promise<boolean> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const rows = params.projectId
    ? await sql`
        UPDATE knowledge_ingest_jobs
        SET status = 'cancelled', updated_at = ${now}
        WHERE id = ${params.jobId}
          AND workspace_id = ${params.workspaceId}
          AND project_id = ${params.projectId}
          AND status IN ('pending', 'running')
        RETURNING id
      `
    : await sql`
        UPDATE knowledge_ingest_jobs
        SET status = 'cancelled', updated_at = ${now}
        WHERE id = ${params.jobId}
          AND workspace_id = ${params.workspaceId}
          AND status IN ('pending', 'running')
        RETURNING id
      `;
  return rows.length > 0;
}

/** Hard-delete a workspace-scoped job. Returns true if a row was deleted. */
export async function deleteConnectIngestJobForWorkspace(params: {
  jobId: string;
  workspaceId: string;
}): Promise<boolean> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM knowledge_ingest_jobs
    WHERE id = ${params.jobId}
      AND workspace_id = ${params.workspaceId}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Bulk clean up a workspace's ingest job list.
 * - Cancels all pending/running jobs.
 * - Deletes jobs matching the given statuses.
 * Returns counts of cancelled and deleted rows.
 */
export async function bulkCleanupIngestJobsForWorkspace(params: {
  workspaceId: string;
  /** Statuses to delete (e.g. ['cancelled', 'failed', 'running']). */
  deleteStatuses: string[];
}): Promise<{ cancelled: number; deleted: number }> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();

  const cancelledRows = await sql`
    UPDATE knowledge_ingest_jobs
    SET status = 'cancelled', updated_at = ${now}
    WHERE workspace_id = ${params.workspaceId}
      AND status IN ('pending', 'running')
    RETURNING id
  `;

  const deletedRows = params.deleteStatuses.length > 0
    ? await sql`
        DELETE FROM knowledge_ingest_jobs
        WHERE workspace_id = ${params.workspaceId}
          AND status = ANY(${params.deleteStatuses}::text[])
        RETURNING id
      `
    : [];

  return { cancelled: cancelledRows.length, deleted: deletedRows.length };
}

// ─── Readiness runs (cohort passes through link → embed → validate) ──────────

export type ReadinessRunStatus =
  | "draft"
  | "linking"
  | "linked"
  | "embedding"
  | "embedded"
  | "validating"
  | "complete"
  | "archived";

export type ReadinessRunQualitySummary = {
  ok: number;
  weak: number;
  unsupported: number;
  unvalidated: number;
  okPct?: number;
};

export type ReadinessRunRecord = {
  id: string;
  workspaceId: string;
  domainPackId: string | null;
  label: string;
  sizeTarget: number;
  sizeActual: number | null;
  status: ReadinessRunStatus;
  linkJobId: string | null;
  embedJobId: string | null;
  validateJobId: string | null;
  qualitySummary: ReadinessRunQualitySummary | null;
  createdAt: number;
  updatedAt: number;
};

function mapReadinessRunRow(row: Record<string, unknown>): ReadinessRunRecord {
  const qualityRaw = row.quality_summary;
  let qualitySummary: ReadinessRunQualitySummary | null = null;
  if (qualityRaw && typeof qualityRaw === "object" && !Array.isArray(qualityRaw)) {
    const q = qualityRaw as Record<string, unknown>;
    const num = (k: string) => (typeof q[k] === "number" ? (q[k] as number) : 0);
    qualitySummary = {
      ok: num("ok"),
      weak: num("weak"),
      unsupported: num("unsupported"),
      unvalidated: num("unvalidated"),
      ...(typeof q.okPct === "number" ? { okPct: q.okPct } : {}),
    };
  }
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    domainPackId: row.domain_pack_id == null ? null : String(row.domain_pack_id),
    label: String(row.label),
    sizeTarget: Number(row.size_target),
    sizeActual: row.size_actual == null ? null : Number(row.size_actual),
    status: String(row.status) as ReadinessRunStatus,
    linkJobId: row.link_job_id == null ? null : String(row.link_job_id),
    embedJobId: row.embed_job_id == null ? null : String(row.embed_job_id),
    validateJobId: row.validate_job_id == null ? null : String(row.validate_job_id),
    qualitySummary,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function insertReadinessRun(params: {
  id: string;
  workspaceId: string;
  domainPackId?: string | null;
  label: string;
  sizeTarget: number;
}): Promise<ReadinessRunRecord> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const rows = await sql`
    INSERT INTO knowledge_readiness_runs (
      id, workspace_id, domain_pack_id, label, size_target, status, created_at, updated_at
    )
    VALUES (
      ${params.id}, ${params.workspaceId}, ${params.domainPackId ?? null},
      ${params.label}, ${params.sizeTarget}, ${"draft"}, ${now}, ${now}
    )
    RETURNING *
  `;
  return mapReadinessRunRow(rows[0] as Record<string, unknown>);
}

export async function listReadinessRunsForWorkspace(params: {
  workspaceId: string;
  includeArchived?: boolean;
  limit?: number;
}): Promise<ReadinessRunRecord[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const rows = params.includeArchived
    ? await sql`
        SELECT * FROM knowledge_readiness_runs
        WHERE workspace_id = ${params.workspaceId}
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT * FROM knowledge_readiness_runs
        WHERE workspace_id = ${params.workspaceId} AND status <> 'archived'
        ORDER BY updated_at DESC
        LIMIT ${limit}
      `;
  return rows.map((row) => mapReadinessRunRow(row as Record<string, unknown>));
}

export async function getReadinessRun(params: {
  runId: string;
  workspaceId: string;
}): Promise<ReadinessRunRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_readiness_runs
    WHERE id = ${params.runId} AND workspace_id = ${params.workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapReadinessRunRow(rows[0] as Record<string, unknown>);
}

/**
 * Patch a readiness run. Uses COALESCE(new, existing) semantics — passing `null`
 * (or omitting a field) leaves the column unchanged. We never need to clear these
 * back to null once set, so this is sufficient and avoids fragment composition.
 */
export async function updateReadinessRun(params: {
  runId: string;
  workspaceId: string;
  status?: ReadinessRunStatus;
  sizeActual?: number | null;
  linkJobId?: string | null;
  embedJobId?: string | null;
  validateJobId?: string | null;
  qualitySummary?: ReadinessRunQualitySummary | null;
}): Promise<ReadinessRunRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const qualityJson =
    params.qualitySummary != null ? JSON.stringify(params.qualitySummary) : null;
  const rows = await sql`
    UPDATE knowledge_readiness_runs
    SET
      status = COALESCE(${params.status ?? null}, status),
      size_actual = COALESCE(${params.sizeActual ?? null}::integer, size_actual),
      link_job_id = COALESCE(${params.linkJobId ?? null}, link_job_id),
      embed_job_id = COALESCE(${params.embedJobId ?? null}, embed_job_id),
      validate_job_id = COALESCE(${params.validateJobId ?? null}, validate_job_id),
      quality_summary = COALESCE(${qualityJson}::jsonb, quality_summary),
      updated_at = ${now}
    WHERE id = ${params.runId} AND workspace_id = ${params.workspaceId}
    RETURNING *
  `;
  if (rows.length === 0) return null;
  return mapReadinessRunRow(rows[0] as Record<string, unknown>);
}

/** Stamp cohort membership (idempotent). Returns the number of newly-added units. */
export async function addReadinessRunUnits(params: {
  runId: string;
  unitIds: string[];
}): Promise<number> {
  if (params.unitIds.length === 0) return 0;
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO knowledge_readiness_run_units (run_id, unit_id)
    SELECT ${params.runId}, unnest(${params.unitIds}::text[])
    ON CONFLICT (run_id, unit_id) DO NOTHING
    RETURNING unit_id
  `;
  return rows.length;
}

export async function listReadinessRunUnitIds(runId: string): Promise<string[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT unit_id FROM knowledge_readiness_run_units WHERE run_id = ${runId}
  `;
  return rows.map((row) => String((row as Record<string, unknown>).unit_id));
}

// ─── Knowledge graph targets (Bring-Your-Own store) ──────────────────────────

export type ConnectGraphTargetRecord = {
  id: string;
  workspaceId: string;
  label: string | null;
  provider: string;
  endpoint: string | null;
  namespace: string | null;
  database: string | null;
  username: string | null;
  useDashboardDatabase: boolean;
  defaultDomainPackId: string | null;
  settings: Record<string, unknown>;
  secretCiphertext: string | null;
  secretIv: string | null;
  secretAuthTag: string | null;
  secretEncryptionVersion: number;
  status: string;
  lastTestedAt: number | null;
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
};

function mapConnectGraphTargetRow(row: Record<string, unknown>): ConnectGraphTargetRecord {
  const settings = row.settings;
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    label: row.label != null ? String(row.label) : null,
    provider: String(row.provider),
    endpoint: row.endpoint != null ? String(row.endpoint) : null,
    namespace: row.namespace != null ? String(row.namespace) : null,
    database: row.database != null ? String(row.database) : null,
    username: row.username != null ? String(row.username) : null,
    useDashboardDatabase: Boolean(row.use_dashboard_database),
    defaultDomainPackId: row.default_domain_pack_id != null ? String(row.default_domain_pack_id) : null,
    settings:
      settings && typeof settings === "object" && !Array.isArray(settings)
        ? (settings as Record<string, unknown>)
        : {},
    secretCiphertext: row.secret_ciphertext != null ? String(row.secret_ciphertext) : null,
    secretIv: row.secret_iv != null ? String(row.secret_iv) : null,
    secretAuthTag: row.secret_auth_tag != null ? String(row.secret_auth_tag) : null,
    secretEncryptionVersion: Number(row.secret_encryption_version ?? 0),
    status: String(row.status),
    lastTestedAt: row.last_tested_at != null ? Number(row.last_tested_at) : null,
    lastError: row.last_error != null ? String(row.last_error) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

/** Read the active-graph pointer stored in the workspace stage-routing config. */
async function readActiveGraphTargetId(workspaceId: string): Promise<string | null> {
  const raw = await getConnectStageRoutingConfig(workspaceId);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const id = (raw as Record<string, unknown>).active_graph_target_id;
  return typeof id === "string" && id ? id : null;
}

/** List every saved graph for a workspace (Graph Library), most-recently-updated first. */
export async function listConnectGraphTargetsForWorkspace(
  workspaceId: string,
): Promise<ConnectGraphTargetRecord[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_graph_targets WHERE workspace_id = ${workspaceId} ORDER BY updated_at DESC
  `;
  return rows.map((r) => mapConnectGraphTargetRow(r as Record<string, unknown>));
}

export async function getConnectGraphTargetById(params: {
  id: string;
  workspaceId: string;
}): Promise<ConnectGraphTargetRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_graph_targets WHERE id = ${params.id} AND workspace_id = ${params.workspaceId} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapConnectGraphTargetRow(rows[0] as Record<string, unknown>);
}

/**
 * The workspace's *active* graph target — what retrieval, ingest, and the MCP
 * orchestrator all read. Resolves the active-graph pointer, falling back to the
 * most-recently-updated saved graph (back-compat for single-target workspaces).
 */
export async function getConnectGraphTargetForWorkspace(
  workspaceId: string,
): Promise<ConnectGraphTargetRecord | null> {
  await ensureIngestionRoutingSchema();
  const activeId = await readActiveGraphTargetId(workspaceId);
  if (activeId) {
    const active = await getConnectGraphTargetById({ id: activeId, workspaceId });
    if (active) return active;
  }
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_graph_targets WHERE workspace_id = ${workspaceId}
    ORDER BY updated_at DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapConnectGraphTargetRow(rows[0] as Record<string, unknown>);
}

/**
 * Create a new saved graph (Graph Library entry) when `id` is omitted, or update
 * an existing one in place when `id` is supplied. Never overwrites a sibling graph.
 */
export async function upsertConnectGraphTarget(params: {
  /** Existing graph id to update; omit to create a new saved graph. */
  id?: string;
  workspaceId: string;
  label?: string | null;
  provider: string;
  endpoint?: string | null;
  namespace?: string | null;
  database?: string | null;
  username?: string | null;
  useDashboardDatabase?: boolean;
  defaultDomainPackId?: string | null;
  settings?: Record<string, unknown>;
  /** Initial status (e.g. 'ok' for the one-click dashboard-Neon path). */
  status?: "untested" | "ok" | "error";
  /** Encrypted secret payload; omit to keep an existing secret. */
  secret?: {
    ciphertext: string;
    iv: string;
    authTag: string;
    encryptionVersion: number;
  } | null;
}): Promise<ConnectGraphTargetRecord> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const existing = params.id
    ? await getConnectGraphTargetById({ id: params.id, workspaceId: params.workspaceId })
    : null;
  const id = existing?.id ?? params.id ?? crypto.randomUUID();
  const setSecret = params.secret != null;
  const cipher = setSecret ? params.secret!.ciphertext : (existing?.secretCiphertext ?? null);
  const iv = setSecret ? params.secret!.iv : (existing?.secretIv ?? null);
  const tag = setSecret ? params.secret!.authTag : (existing?.secretAuthTag ?? null);
  const version = setSecret ? params.secret!.encryptionVersion : (existing?.secretEncryptionVersion ?? 0);
  const createdAt = existing?.createdAt ?? now;
  const useDash = params.useDashboardDatabase ?? existing?.useDashboardDatabase ?? false;
  const label = params.label !== undefined ? params.label : (existing?.label ?? null);
  const packId =
    params.defaultDomainPackId !== undefined
      ? params.defaultDomainPackId
      : (existing?.defaultDomainPackId ?? null);
  const settings = params.settings ?? existing?.settings ?? {};
  const settingsJson = JSON.stringify(settings);
  // Preserve last connectivity status on partial updates (save without explicit status).
  const status = params.status ?? existing?.status ?? "untested";
  await sql`
    INSERT INTO knowledge_graph_targets (
      id, workspace_id, label, provider, endpoint, namespace, database, username, use_dashboard_database,
      default_domain_pack_id, settings,
      secret_ciphertext, secret_iv, secret_auth_tag, secret_encryption_version,
      status, last_tested_at, last_error, created_at, updated_at
    ) VALUES (
      ${id}, ${params.workspaceId}, ${label}, ${params.provider}, ${params.endpoint ?? null}, ${params.namespace ?? null},
      ${params.database ?? null}, ${params.username ?? null}, ${useDash},
      ${packId}, ${settingsJson}::jsonb,
      ${cipher}, ${iv}, ${tag}, ${version},
      ${status}, NULL, NULL, ${createdAt}, ${now}
    )
    ON CONFLICT (id) DO UPDATE SET
      label = ${label},
      provider = EXCLUDED.provider,
      endpoint = EXCLUDED.endpoint,
      namespace = EXCLUDED.namespace,
      database = EXCLUDED.database,
      username = EXCLUDED.username,
      use_dashboard_database = EXCLUDED.use_dashboard_database,
      default_domain_pack_id = ${packId},
      settings = ${settingsJson}::jsonb,
      secret_ciphertext = ${cipher},
      secret_iv = ${iv},
      secret_auth_tag = ${tag},
      secret_encryption_version = ${version},
      status = ${status},
      last_error = NULL,
      updated_at = ${now}
  `;
  const updated = await getConnectGraphTargetById({ id, workspaceId: params.workspaceId });
  if (!updated) throw new Error("graph target upsert failed");
  return updated;
}

export async function deleteConnectGraphTarget(params: {
  id: string;
  workspaceId: string;
}): Promise<boolean> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM knowledge_graph_targets WHERE id = ${params.id} AND workspace_id = ${params.workspaceId}
    RETURNING id
  `;
  return rows.length > 0;
}

/**
 * Patch a graph's bundle (domain pack + settings snapshot) without touching its
 * connection, secret, or connectivity status. Used to keep a graph's saved
 * settings tracking live edits while it is the workspace's active graph.
 */
export async function updateConnectGraphTargetBundle(params: {
  graphTargetId: string;
  workspaceId: string;
  /** undefined = leave unchanged; null = clear. */
  defaultDomainPackId?: string | null;
  /** Shallow-merged into settings; keys set to null are removed. */
  settingsPatch?: Record<string, unknown>;
}): Promise<void> {
  const existing = await getConnectGraphTargetById({
    id: params.graphTargetId,
    workspaceId: params.workspaceId,
  });
  if (!existing) return;
  const settings: Record<string, unknown> = { ...existing.settings };
  if (params.settingsPatch) {
    for (const [k, v] of Object.entries(params.settingsPatch)) {
      if (v === null || v === undefined) delete settings[k];
      else settings[k] = v;
    }
  }
  const packId =
    params.defaultDomainPackId !== undefined
      ? params.defaultDomainPackId
      : existing.defaultDomainPackId;
  const sql = getSql();
  const now = Date.now();
  await sql`
    UPDATE knowledge_graph_targets
    SET default_domain_pack_id = ${packId},
        settings = ${JSON.stringify(settings)}::jsonb,
        updated_at = ${now}
    WHERE id = ${params.graphTargetId} AND workspace_id = ${params.workspaceId}
  `;
}

export type ConnectGraphStatsCacheRecord = {
  stats: unknown;
  domainPackId: string | null;
  computedAt: number;
};

export async function getConnectGraphStatsCache(params: {
  workspaceId: string;
  graphTargetId: string;
}): Promise<ConnectGraphStatsCacheRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT stats, domain_pack_id, computed_at
    FROM knowledge_graph_stats_cache
    WHERE workspace_id = ${params.workspaceId} AND graph_target_id = ${params.graphTargetId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as { stats: unknown; domain_pack_id: unknown; computed_at: unknown };
  return {
    stats: row.stats,
    domainPackId: row.domain_pack_id != null ? String(row.domain_pack_id) : null,
    computedAt: Number(row.computed_at),
  };
}

export async function setConnectGraphStatsCache(params: {
  workspaceId: string;
  graphTargetId: string;
  stats: unknown;
  domainPackId: string | null;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const json = JSON.stringify(params.stats ?? null);
  await sql`
    INSERT INTO knowledge_graph_stats_cache (workspace_id, graph_target_id, stats, domain_pack_id, computed_at)
    VALUES (${params.workspaceId}, ${params.graphTargetId}, ${json}::jsonb, ${params.domainPackId}, ${now})
    ON CONFLICT (workspace_id, graph_target_id) DO UPDATE SET
      stats = ${json}::jsonb,
      domain_pack_id = ${params.domainPackId},
      computed_at = ${now}
  `;
}

/** Drop cached stats so the next load recomputes (call after ingest/revalidate/embed changes the graph). */
export async function invalidateConnectGraphStatsCache(params: {
  workspaceId: string;
  graphTargetId?: string;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  if (params.graphTargetId) {
    await sql`
      DELETE FROM knowledge_graph_stats_cache
      WHERE workspace_id = ${params.workspaceId} AND graph_target_id = ${params.graphTargetId}
    `;
  } else {
    await sql`DELETE FROM knowledge_graph_stats_cache WHERE workspace_id = ${params.workspaceId}`;
  }
}

/** Connectivity check against the dashboard's own Neon database (one-click Postgres target). */
export async function pingDashboardDatabase(): Promise<boolean> {
  const sql = getSql();
  const rows = await sql`SELECT 1 AS ok`;
  return rows.length > 0;
}

/** Insert a source record into the Postgres graph spine (domain-agnostic). Returns the new id. */
export async function insertConnectGraphSourcePostgres(params: {
  workspaceId: string;
  domainPackId?: string | null;
  jobId?: string | null;
  title?: string | null;
  url?: string | null;
  textPreview?: string | null;
  sourceKind?: string | null;
  /** Stage 3.2: stable cross-run identity of the document (deriveClaimSourceKey). */
  sourceKey?: string | null;
  /** Stage 3.2: content hash of the source version this row registered. */
  contentHash?: string | null;
}): Promise<string> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO knowledge_graph_sources (
      id, workspace_id, domain_pack_id, job_id, title, url, text_preview, source_kind,
      source_key, content_hash, last_seen_at, payload, created_at
    ) VALUES (
      ${id}, ${params.workspaceId}, ${params.domainPackId ?? null}, ${params.jobId ?? null},
      ${params.title ?? null}, ${params.url ?? null}, ${params.textPreview ?? null}, ${params.sourceKind ?? null},
      ${params.sourceKey ?? null}, ${params.contentHash ?? null}, ${now},
      NULL, ${now}
    )
  `;
  return id;
}

/**
 * Stage 3.2: latest registered version of a source by its stable source key.
 * Drives the unchanged-document skip (hash match) and the changed-document claim diff.
 */
export async function findLatestConnectGraphSourceByKeyPostgres(params: {
  workspaceId: string;
  sourceKey: string;
}): Promise<{ id: string; contentHash: string | null } | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, content_hash FROM knowledge_graph_sources
    WHERE workspace_id = ${params.workspaceId} AND source_key = ${params.sourceKey}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = rows[0] as { id: string; content_hash: string | null } | undefined;
  return row ? { id: row.id, contentHash: row.content_hash ?? null } : null;
}

/** Stage 3.2: the ONLY write an unchanged-source re-ingest performs (ADR §3 step 1). */
export async function touchConnectGraphSourceSeenPostgres(params: {
  workspaceId: string;
  id: string;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  await sql`
    UPDATE knowledge_graph_sources SET last_seen_at = ${Date.now()}
    WHERE id = ${params.id} AND workspace_id = ${params.workspaceId}
  `;
}

/**
 * Store an extracted graph (units + relations) in the Postgres spine.
 * `units` carry caller-local ids referenced by `relations`; this maps them to
 * generated db ids. Returns how many of each were written.
 */
export async function storeExtractedGraphPostgres(params: {
  workspaceId: string;
  domainPackId?: string | null;
  sourceId: string;
  units: {
    localId: string;
    text: string;
    unitType?: string | null;
    domain?: string | null;
    sourceChunkIndex?: number;
  }[];
  relations: { fromLocalId: string; toLocalId: string; relationType: string }[];
}): Promise<{ units: { id: string; text: string; type: string | null }[]; relations: number }> {
  await ensureIngestionRoutingSchema();
  const sourceId = params.sourceId?.trim();
  if (!sourceId) {
    throw new Error(
      "Graph units require a registered ingest source (source_id).",
    );
  }
  const sql = getSql();
  const now = Date.now();
  const idByLocal = new Map<string, string>();
  const insertedUnits: { id: string; text: string; type: string | null }[] = [];
  for (const u of params.units) {
    if (!u.text?.trim()) continue;
    const dbId = crypto.randomUUID();
    idByLocal.set(u.localId, dbId);
    const payload =
      u.sourceChunkIndex != null ? JSON.stringify({ source_chunk_index: u.sourceChunkIndex }) : null;
    await sql`
      INSERT INTO knowledge_graph_units (
        id, workspace_id, domain_pack_id, source_id, unit_type, domain, text, embedding, payload, source_chunk_index, created_at
      ) VALUES (
        ${dbId}, ${params.workspaceId}, ${params.domainPackId ?? null}, ${sourceId},
        ${u.unitType ?? null}, ${u.domain ?? null}, ${u.text}, NULL, ${payload}::jsonb,
        ${u.sourceChunkIndex ?? null}, ${now}
      )
    `;
    insertedUnits.push({ id: dbId, text: u.text, type: u.unitType ?? null });
  }
  let relationCount = 0;
  for (const r of params.relations) {
    const from = idByLocal.get(r.fromLocalId);
    const to = idByLocal.get(r.toLocalId);
    if (!from || !to) continue;
    await sql`
      INSERT INTO knowledge_graph_relations (
        id, workspace_id, domain_pack_id, from_unit_id, to_unit_id, relation_type, payload, created_at
      ) VALUES (
        ${crypto.randomUUID()}, ${params.workspaceId}, ${params.domainPackId ?? null},
        ${from}, ${to}, ${r.relationType}, NULL, ${now}
      )
    `;
    relationCount += 1;
  }
  return { units: insertedUnits, relations: relationCount };
}

/** Aggregate graph stats for the workspace (journey payoff + monitoring). */
export async function getConnectGraphStats(workspaceId: string): Promise<{
  units: number;
  relations: number;
  groups: number;
  embedded: number;
  validation: {
    ok: number;
    weak: number;
    unsupported: number;
    unvalidated: number;
    awaiting_triage: number;
    unsupported_untriaged: number;
  };
}> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const humanReviewPrefix = "Human review:%";
  const [unitRows, relRows, groupRows, embeddedRows, valRows, triageRows] = await Promise.all([
    sql`SELECT count(*)::int AS c FROM knowledge_graph_units WHERE workspace_id = ${workspaceId}`,
    sql`SELECT count(*)::int AS c FROM knowledge_graph_relations WHERE workspace_id = ${workspaceId}`,
    sql`SELECT count(*)::int AS c FROM knowledge_graph_groups WHERE workspace_id = ${workspaceId}`,
    sql`SELECT count(*)::int AS c FROM knowledge_graph_units WHERE workspace_id = ${workspaceId} AND embedding IS NOT NULL`,
    sql`SELECT validation_status AS s, count(*)::int AS c FROM knowledge_graph_units WHERE workspace_id = ${workspaceId} GROUP BY validation_status`,
    sql`
      SELECT
        count(*) FILTER (
          WHERE validation_status IN ('weak', 'unsupported')
            AND COALESCE(validation_note, '') NOT LIKE ${humanReviewPrefix}
        )::int AS awaiting_triage,
        count(*) FILTER (
          WHERE validation_status = 'unsupported'
            AND COALESCE(validation_note, '') NOT LIKE ${humanReviewPrefix}
        )::int AS unsupported_untriaged
      FROM knowledge_graph_units
      WHERE workspace_id = ${workspaceId}
    `,
  ]);
  const validation = {
    ok: 0,
    weak: 0,
    unsupported: 0,
    unvalidated: 0,
    awaiting_triage: Number((triageRows[0] as { awaiting_triage: number })?.awaiting_triage ?? 0),
    unsupported_untriaged: Number(
      (triageRows[0] as { unsupported_untriaged: number })?.unsupported_untriaged ?? 0,
    ),
  };
  for (const r of valRows as { s: string | null; c: number }[]) {
    const c = Number(r.c);
    if (r.s === "ok") validation.ok = c;
    else if (r.s === "weak") validation.weak = c;
    else if (r.s === "unsupported") validation.unsupported = c;
    else validation.unvalidated += c;
  }
  return {
    units: Number((unitRows[0] as { c: number })?.c ?? 0),
    relations: Number((relRows[0] as { c: number })?.c ?? 0),
    groups: Number((groupRows[0] as { c: number })?.c ?? 0),
    embedded: Number((embeddedRows[0] as { c: number })?.c ?? 0),
    validation,
  };
}

/** Read a slice of the graph for the explorer UI (Postgres spine). */
export async function getConnectGraphExplorer(
  workspaceId: string,
  opts?: { groupLimit?: number; unitLimit?: number; unitOffset?: number },
): Promise<{
  groups: { id: string; name: string; summary: string | null; members: { text: string; role: string | null; validationStatus: string | null }[] }[];
  units: {
    id: string;
    text: string;
    unitType: string | null;
    domain: string | null;
    validationStatus: string | null;
    validationNote: string | null;
    sourceTitle: string | null;
    sourceUrl: string | null;
    sourceKind: string | null;
    author: string | null;
  }[];
}> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const groupLimit = Math.min(Math.max(opts?.groupLimit ?? 20, 1), 100);
  const unitLimit = Math.min(Math.max(opts?.unitLimit ?? 50, 1), 5000);
  const unitOffset = Math.max(opts?.unitOffset ?? 0, 0);

  const groupRows = (await sql`
    SELECT id, name, summary FROM knowledge_graph_groups
    WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT ${groupLimit}
  `) as { id: string; name: string; summary: string | null }[];
  const groupIds = groupRows.map((g) => g.id);

  const memberRows = groupIds.length
    ? ((await sql`
        SELECT gm.group_id AS group_id, gm.role AS role, u.text AS text, u.validation_status AS validation_status
        FROM knowledge_graph_group_members gm
        JOIN knowledge_graph_units u ON u.id = gm.unit_id
        WHERE gm.workspace_id = ${workspaceId} AND gm.group_id = ANY(${groupIds})
      `) as { group_id: string; role: string | null; text: string; validation_status: string | null }[])
    : [];

  const unitRows = (await sql`
    SELECT
      u.id,
      u.text,
      u.unit_type,
      u.domain,
      u.validation_status,
      u.validation_note,
      s.title AS source_title,
      s.url AS source_url,
      s.source_kind AS source_kind
    FROM knowledge_graph_units u
    LEFT JOIN knowledge_graph_sources s
      ON s.id = u.source_id AND s.workspace_id = u.workspace_id
    WHERE u.workspace_id = ${workspaceId}
    ORDER BY u.created_at DESC
    LIMIT ${unitLimit}
    OFFSET ${unitOffset}
  `) as {
    id: string;
    text: string;
    unit_type: string | null;
    domain: string | null;
    validation_status: string | null;
    validation_note: string | null;
    source_title: string | null;
    source_url: string | null;
    source_kind: string | null;
  }[];

  const groups = groupRows.map((g) => ({
    id: g.id,
    name: g.name,
    summary: g.summary ?? null,
    members: memberRows
      .filter((m) => m.group_id === g.id)
      .map((m) => ({ text: m.text, role: m.role ?? null, validationStatus: m.validation_status ?? null })),
  }));
  const units = unitRows.map((u) => ({
    id: u.id,
    text: u.text,
    unitType: u.unit_type ?? null,
    domain: u.domain ?? null,
    validationStatus: u.validation_status ?? null,
    validationNote: u.validation_note ?? null,
    sourceTitle: u.source_title ?? null,
    sourceUrl: u.source_url ?? null,
    sourceKind: u.source_kind ?? null,
    author: null,
  }));
  return { groups, units };
}

/**
 * Set embeddings on units (embedding stage). Batched (chunks of 200 to keep the
 * request payload bounded — vectors are large) instead of one round-trip per unit.
 */
export async function updateUnitEmbeddingsPostgres(params: {
  workspaceId: string;
  embeddings: { unitId: string; vector: number[] }[];
}): Promise<number> {
  if (params.embeddings.length === 0) return 0;
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const BATCH = 200;
  for (let i = 0; i < params.embeddings.length; i += BATCH) {
    const slice = params.embeddings.slice(i, i + BATCH);
    const unitIds = slice.map((e) => e.unitId);
    const vectors = slice.map((e) => JSON.stringify(e.vector));
    await sql`
      UPDATE knowledge_graph_units g
      SET embedding = u.vector::jsonb
      FROM unnest(${unitIds}::text[], ${vectors}::text[]) AS u(unit_id, vector)
      WHERE g.id = u.unit_id AND g.workspace_id = ${params.workspaceId}
    `;
  }
  return params.embeddings.length;
}

let claimVersionsSchemaEnsured = false;
/** CREATE TABLE IF NOT EXISTS mirror of migrations/055_connect_claim_versions.sql (dev safety). */
async function ensureConnectClaimVersionsSchema(): Promise<void> {
  if (claimVersionsSchemaEnsured) return;
  const sql = getSql();
  await sql`
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
      evidence_match      TEXT,
      evidence_status     TEXT        NOT NULL,
      source_hash         TEXT,
      verification_state  TEXT        NOT NULL DEFAULT 'unverified',
      judged_by           TEXT,
      judged_at           TIMESTAMPTZ,
      valid_from          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      valid_to            TIMESTAMPTZ,
      superseded_by       BIGINT,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_connect_claim_versions_unit ON connect_claim_versions (workspace_id, unit_id) WHERE valid_to IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_connect_claim_versions_state ON connect_claim_versions (workspace_id, verification_state) WHERE valid_to IS NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_connect_claim_versions_claim_key ON connect_claim_versions (workspace_id, claim_key) WHERE claim_key IS NOT NULL`;
  claimVersionsSchemaEnsured = true;
}

export type ConnectClaimVersionInsert = {
  unitId: string;
  text: string;
  evidenceQuote: string | null;
  spanStart: number | null;
  spanEnd: number | null;
  evidenceMatch: string | null;
  evidenceStatus: "bound" | "unbound" | "no_evidence";
  sourceHash: string | null;
  /** Stage 3.2: deterministic claim identity (computeClaimKey). Null only for legacy paths. */
  claimKey?: string | null;
  /** Stage 3.2: 1 for new claims; prior version + 1 for carried/changed claims. */
  versionNo?: number;
  /**
   * Stage 3.2 carry-forward: an unchanged claim's verification state is copied onto its
   * new version — no re-judging (the chain records who judged it and when, unchanged).
   */
  verificationState?: string | null;
  judgedBy?: string | null;
  judgedAt?: string | null;
};

/**
 * EBV Layer 1 + Stage 3.2: insert claim-version rows with their evidence bindings and
 * claim identity/version metadata. Single multi-row statement via unnest — the Neon HTTP
 * driver pays one network round-trip per query, so a per-row loop would cost N round-trips
 * per chunk. Returns the inserted row ids per unit so re-ingest can chain superseded_by
 * forward.
 */
export async function insertConnectClaimVersionsPostgres(params: {
  workspaceId: string;
  rows: ConnectClaimVersionInsert[];
}): Promise<{ unitId: string; versionId: string }[]> {
  if (params.rows.length === 0) return [];
  await ensureConnectClaimVersionsSchema();
  const sql = getSql();
  const unitIds = params.rows.map((r) => r.unitId);
  const claimKeys = params.rows.map((r) => r.claimKey ?? null);
  const versionNos = params.rows.map((r) => r.versionNo ?? 1);
  const texts = params.rows.map((r) => r.text);
  const quotes = params.rows.map((r) => r.evidenceQuote);
  const starts = params.rows.map((r) => r.spanStart);
  const ends = params.rows.map((r) => r.spanEnd);
  const matches = params.rows.map((r) => r.evidenceMatch);
  const statuses = params.rows.map((r) => r.evidenceStatus);
  const hashes = params.rows.map((r) => r.sourceHash);
  // Stage 3.2 carry-forward: copied verification state for unchanged claims.
  const states = params.rows.map((r) => r.verificationState ?? "unverified");
  const judgedBys = params.rows.map((r) => r.judgedBy ?? null);
  const judgedAts = params.rows.map((r) => r.judgedAt ?? null);
  const rows = await sql`
    INSERT INTO connect_claim_versions
      (workspace_id, unit_id, claim_key, version_no, text, evidence_quote, span_start, span_end,
       evidence_match, evidence_status, source_hash, verification_state, judged_by, judged_at)
    SELECT ${params.workspaceId}, u.unit_id, u.claim_key, u.version_no, u.text, u.evidence_quote,
           u.span_start, u.span_end, u.evidence_match, u.evidence_status, u.source_hash,
           u.verification_state, u.judged_by, u.judged_at
    FROM unnest(
      ${unitIds}::text[], ${claimKeys}::text[], ${versionNos}::int[], ${texts}::text[],
      ${quotes}::text[], ${starts}::int[], ${ends}::int[], ${matches}::text[],
      ${statuses}::text[], ${hashes}::text[], ${states}::text[], ${judgedBys}::text[],
      ${judgedAts}::timestamptz[]
    ) AS u(unit_id, claim_key, version_no, text, evidence_quote, span_start, span_end,
           evidence_match, evidence_status, source_hash, verification_state, judged_by, judged_at)
    RETURNING id, unit_id
  `;
  return (rows as { id: number | string; unit_id: string }[]).map((r) => ({
    unitId: r.unit_id,
    versionId: String(r.id),
  }));
}

export type ConnectCurrentClaimVersionRow = {
  versionId: string;
  claimKey: string | null;
  versionNo: number;
  unitId: string;
  text: string;
  verificationState: string | null;
  judgedBy: string | null;
  judgedAt: string | null;
  validationStatus: string | null;
  validationNote: string | null;
};

/**
 * Stage 3.2: current (valid_to IS NULL) claim versions attached to ANY prior source row
 * with this stable source key, joined with the unit's validation verdict — the prior side
 * of the re-ingest diff. Keyed by source_key (not one source row id) so claims from an
 * older generation can never be silently kept when an intermediate run registered a row
 * without processing the document.
 */
export async function listCurrentConnectClaimVersionsForSourceKeyPostgres(params: {
  workspaceId: string;
  sourceKey: string;
}): Promise<ConnectCurrentClaimVersionRow[]> {
  await ensureIngestionRoutingSchema();
  await ensureConnectClaimVersionsSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT ccv.id, ccv.claim_key, ccv.version_no, ccv.unit_id, ccv.text,
           ccv.verification_state, ccv.judged_by, ccv.judged_at,
           u.validation_status, u.validation_note
    FROM connect_claim_versions ccv
    JOIN knowledge_graph_units u
      ON u.id = ccv.unit_id AND u.workspace_id = ccv.workspace_id
    WHERE ccv.workspace_id = ${params.workspaceId}
      AND u.source_id IN (
        SELECT s.id FROM knowledge_graph_sources s
        WHERE s.workspace_id = ${params.workspaceId} AND s.source_key = ${params.sourceKey}
      )
      AND ccv.valid_to IS NULL
    ORDER BY ccv.id
  `;
  return (rows as {
    id: number | string;
    claim_key: string | null;
    version_no: number;
    unit_id: string;
    text: string;
    verification_state: string | null;
    judged_by: string | null;
    judged_at: string | Date | null;
    validation_status: string | null;
    validation_note: string | null;
  }[]).map((r) => ({
    versionId: String(r.id),
    claimKey: r.claim_key ?? null,
    versionNo: Number(r.version_no ?? 1),
    unitId: r.unit_id,
    text: r.text,
    verificationState: r.verification_state ?? null,
    judgedBy: r.judged_by ?? null,
    judgedAt:
      r.judged_at instanceof Date ? r.judged_at.toISOString() : r.judged_at ? String(r.judged_at) : null,
    validationStatus: r.validation_status ?? null,
    validationNote: r.validation_note ?? null,
  }));
}

/**
 * Stage 3.2: close validity windows (ADR §2/§3). Sets valid_to = NOW() and links
 * superseded_by forward when a successor version exists (null for removed claims).
 * Additive and reversible — version rows are NEVER deleted.
 */
export async function supersedeConnectClaimVersionsPostgres(params: {
  workspaceId: string;
  rows: { versionId: string; supersededBy: string | null }[];
}): Promise<number> {
  if (params.rows.length === 0) return 0;
  await ensureConnectClaimVersionsSchema();
  const sql = getSql();
  // Batched via unnest (one round-trip), same style as the inserts above.
  const ids = params.rows.map((r) => r.versionId);
  const successors = params.rows.map((r) => r.supersededBy);
  const updated = await sql`
    UPDATE connect_claim_versions ccv
    SET valid_to = NOW(), superseded_by = u.superseded_by
    FROM unnest(${ids}::bigint[], ${successors}::bigint[]) AS u(id, superseded_by)
    WHERE ccv.workspace_id = ${params.workspaceId} AND ccv.id = u.id AND ccv.valid_to IS NULL
    RETURNING ccv.id
  `;
  return updated.length;
}

let claimJudgmentsSchemaEnsured = false;
/** CREATE TABLE IF NOT EXISTS mirror of migrations/056_connect_claim_judgments.sql (dev safety). */
async function ensureConnectClaimJudgmentsSchema(): Promise<void> {
  if (claimJudgmentsSchemaEnsured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS connect_claim_judgments (
      id              BIGSERIAL   PRIMARY KEY,
      workspace_id    TEXT        NOT NULL,
      unit_id         TEXT        NOT NULL,
      verdict         TEXT        NOT NULL,
      confidence      REAL,
      note            TEXT,
      judge_model     TEXT,
      prompt_version  INT         NOT NULL,
      judged_at       TIMESTAMPTZ NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_connect_claim_judgments_unit ON connect_claim_judgments (workspace_id, unit_id, judged_at DESC)`;
  claimJudgmentsSchemaEnsured = true;
}

export type ConnectClaimJudgmentInsert = {
  unitId: string;
  verdict: string;
  confidence: number | null;
  note: string | null;
  judgeModel: string | null;
  promptVersion: number;
  judgedAt: string;
};

/**
 * EBV Layer 2: append entailment judgments (audit history — never updates prior rows,
 * so a re-judged claim retains every verdict with its judge model + prompt version).
 */
export async function insertConnectClaimJudgmentsPostgres(params: {
  workspaceId: string;
  rows: ConnectClaimJudgmentInsert[];
}): Promise<number> {
  if (params.rows.length === 0) return 0;
  await ensureConnectClaimJudgmentsSchema();
  const sql = getSql();
  const unitIds = params.rows.map((r) => r.unitId);
  const verdicts = params.rows.map((r) => r.verdict);
  const confidences = params.rows.map((r) => r.confidence);
  const notes = params.rows.map((r) => r.note);
  const judgeModels = params.rows.map((r) => r.judgeModel);
  const promptVersions = params.rows.map((r) => r.promptVersion);
  const judgedAts = params.rows.map((r) => r.judgedAt);
  // Single multi-row INSERT (one Neon HTTP round-trip), append-only as before.
  await sql`
    INSERT INTO connect_claim_judgments
      (workspace_id, unit_id, verdict, confidence, note, judge_model, prompt_version, judged_at)
    SELECT ${params.workspaceId}, u.unit_id, u.verdict, u.confidence, u.note,
           u.judge_model, u.prompt_version, u.judged_at
    FROM unnest(
      ${unitIds}::text[], ${verdicts}::text[], ${confidences}::real[], ${notes}::text[],
      ${judgeModels}::text[], ${promptVersions}::int[], ${judgedAts}::timestamptz[]
    ) AS u(unit_id, verdict, confidence, note, judge_model, prompt_version, judged_at)
  `;
  return params.rows.length;
}

/**
 * EBV Layer 1: set verification state on the CURRENT version of each unit (post-validation).
 * Single multi-row UPDATE ... FROM unnest (one Neon HTTP round-trip instead of one per unit).
 */
export async function updateConnectClaimVersionStatesPostgres(params: {
  workspaceId: string;
  states: { unitId: string; state: string; judgedBy?: string | null }[];
}): Promise<number> {
  if (params.states.length === 0) return 0;
  await ensureConnectClaimVersionsSchema();
  const sql = getSql();
  const unitIds = params.states.map((s) => s.unitId);
  const states = params.states.map((s) => s.state);
  const judgedBys = params.states.map((s) => s.judgedBy ?? null);
  await sql`
    UPDATE connect_claim_versions v
    SET verification_state = u.state, judged_by = u.judged_by, judged_at = NOW()
    FROM unnest(${unitIds}::text[], ${states}::text[], ${judgedBys}::text[]) AS u(unit_id, state, judged_by)
    WHERE v.workspace_id = ${params.workspaceId} AND v.unit_id = u.unit_id AND v.valid_to IS NULL
  `;
  return params.states.length;
}

/**
 * EBV breakdown for the trust scorecard (Postgres spine): current claim versions
 * (valid_to IS NULL) grouped by verification_state and evidence_status, plus the
 * latest entailment judgment timestamp. Counts cover only units with EBV rows —
 * the scorecard treats the remainder as unverified / unbound (fail-safe).
 */
export async function getConnectClaimVersionBreakdownPostgres(workspaceId: string): Promise<{
  verificationStates: Record<string, number>;
  evidenceStatuses: Record<string, number>;
  lastJudgedAt: string | null;
}> {
  await ensureConnectClaimVersionsSchema();
  await ensureConnectClaimJudgmentsSchema();
  const sql = getSql();
  const [stateRows, evidenceRows, judgedRows] = await Promise.all([
    sql`
      SELECT verification_state AS k, count(*)::int AS c FROM connect_claim_versions
      WHERE workspace_id = ${workspaceId} AND valid_to IS NULL
      GROUP BY verification_state
    `,
    sql`
      SELECT evidence_status AS k, count(*)::int AS c FROM connect_claim_versions
      WHERE workspace_id = ${workspaceId} AND valid_to IS NULL
      GROUP BY evidence_status
    `,
    sql`
      SELECT max(judged_at) AS latest FROM connect_claim_judgments
      WHERE workspace_id = ${workspaceId}
    `,
  ]);
  const toRecord = (rows: unknown): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const r of rows as { k: string | null; c: number }[]) {
      if (r.k) out[r.k] = Number(r.c);
    }
    return out;
  };
  const latestRaw = (judgedRows[0] as { latest: string | Date | null } | undefined)?.latest ?? null;
  const lastJudgedAt =
    latestRaw instanceof Date ? latestRaw.toISOString() : latestRaw ? String(latestRaw) : null;
  return {
    verificationStates: toRecord(stateRows),
    evidenceStatuses: toRecord(evidenceRows),
    lastJudgedAt,
  };
}

/**
 * Coverage-gap counts for the trust scorecard (Postgres spine, PR #189 semantics):
 * units whose validation note records a validator/judge omission ("coverage_gap: …")
 * and units soft-excluded by remediation (incl. omitted verdicts defaulted to drop).
 */
export async function getConnectGraphCoverageCountsPostgres(workspaceId: string): Promise<{
  validatorGaps: number;
  remediationDrops: number;
}> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT
      count(*) FILTER (WHERE validation_note LIKE 'coverage_gap%')::int AS validator_gaps,
      count(*) FILTER (
        WHERE validation_status = 'removed' AND validation_note LIKE 'Remediation (%'
      )::int AS remediation_drops
    FROM knowledge_graph_units
    WHERE workspace_id = ${workspaceId}
  `;
  const row = rows[0] as { validator_gaps: number; remediation_drops: number } | undefined;
  return {
    validatorGaps: Number(row?.validator_gaps ?? 0),
    remediationDrops: Number(row?.remediation_drops ?? 0),
  };
}

// ── Stage 2.4: connect_eval_verdicts (quality-history timeline) ─────────────

let evalVerdictsSchemaEnsured = false;
/** CREATE TABLE IF NOT EXISTS mirror of migrations/057_connect_eval_verdicts.sql (dev safety). */
async function ensureConnectEvalVerdictsSchema(): Promise<void> {
  if (evalVerdictsSchemaEnsured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS connect_eval_verdicts (
      id              BIGSERIAL   PRIMARY KEY,
      workspace_id    TEXT        NOT NULL,
      source          TEXT        NOT NULL,
      evaluated_at    TIMESTAMPTZ NOT NULL,
      pass            BOOLEAN     NOT NULL,
      verdict_schema  TEXT        NOT NULL,
      verdict         JSONB       NOT NULL,
      diff            JSONB,
      recorded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_connect_eval_verdicts_workspace ON connect_eval_verdicts (workspace_id, evaluated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_connect_eval_verdicts_pass ON connect_eval_verdicts (workspace_id, pass, evaluated_at DESC)`;
  evalVerdictsSchemaEnsured = true;
}

export type ConnectEvalVerdictRow = {
  id: string;
  workspaceId: string;
  source: string;
  evaluatedAt: string;
  pass: boolean;
  verdictSchema: string;
  verdict: unknown;
  diff: unknown | null;
  recordedAt: string;
};

/** Stage 2.4: persist one eval verdict to the workspace quality-history timeline. */
export async function insertConnectEvalVerdict(params: {
  workspaceId: string;
  source: string;
  evaluatedAt: string;
  pass: boolean;
  verdictSchema: string;
  verdict: unknown;
  diff: unknown | null;
}): Promise<{ id: string; recordedAt: string }> {
  await ensureConnectEvalVerdictsSchema();
  const sql = getSql();
  const rows = await sql`
    INSERT INTO connect_eval_verdicts
      (workspace_id, source, evaluated_at, pass, verdict_schema, verdict, diff)
    VALUES
      (${params.workspaceId}, ${params.source}, ${params.evaluatedAt}, ${params.pass},
       ${params.verdictSchema}, ${JSON.stringify(params.verdict)}, ${params.diff ? JSON.stringify(params.diff) : null})
    RETURNING id, recorded_at
  `;
  const row = rows[0] as { id: string | number; recorded_at: Date | string };
  const recordedAt = row.recorded_at instanceof Date ? row.recorded_at.toISOString() : String(row.recorded_at);
  return { id: String(row.id), recordedAt };
}

/** Stage 2.4: list eval-verdict history for a workspace, newest first. */
export async function listConnectEvalVerdicts(params: {
  workspaceId: string;
  limit?: number;
  /** Offset-based pagination cursor (the id of the last seen row — exclusive upper bound). */
  beforeId?: string | null;
}): Promise<ConnectEvalVerdictRow[]> {
  await ensureConnectEvalVerdictsSchema();
  const sql = getSql();
  const limit = Math.min(params.limit ?? 50, 200);
  const rows = params.beforeId
    ? await sql`
        SELECT id, workspace_id, source, evaluated_at, pass, verdict_schema, verdict, diff, recorded_at
        FROM connect_eval_verdicts
        WHERE workspace_id = ${params.workspaceId} AND id < ${params.beforeId}
        ORDER BY evaluated_at DESC, id DESC
        LIMIT ${limit}
      `
    : await sql`
        SELECT id, workspace_id, source, evaluated_at, pass, verdict_schema, verdict, diff, recorded_at
        FROM connect_eval_verdicts
        WHERE workspace_id = ${params.workspaceId}
        ORDER BY evaluated_at DESC, id DESC
        LIMIT ${limit}
      `;
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    workspaceId: String(r.workspace_id),
    source: String(r.source),
    evaluatedAt: r.evaluated_at instanceof Date ? r.evaluated_at.toISOString() : String(r.evaluated_at),
    pass: Boolean(r.pass),
    verdictSchema: String(r.verdict_schema),
    verdict: r.verdict,
    diff: r.diff ?? null,
    recordedAt: r.recorded_at instanceof Date ? r.recorded_at.toISOString() : String(r.recorded_at),
  }));
}

/**
 * Set per-unit validation results (validation stage). Batched into one multi-row
 * UPDATE — the per-row loop cost one Neon HTTP round-trip per unit, which dominated
 * the validation stage's persistence time on larger sources.
 */
export async function updateUnitValidationPostgres(params: {
  workspaceId: string;
  results: { unitId: string; status: string; note?: string | null }[];
}): Promise<number> {
  if (params.results.length === 0) return 0;
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const unitIds = params.results.map((r) => r.unitId);
  const statuses = params.results.map((r) => r.status);
  const notes = params.results.map((r) => r.note ?? null);
  await sql`
    UPDATE knowledge_graph_units g
    SET validation_status = u.status, validation_note = u.note
    FROM unnest(${unitIds}::text[], ${statuses}::text[], ${notes}::text[]) AS u(unit_id, status, note)
    WHERE g.id = u.unit_id AND g.workspace_id = ${params.workspaceId}
  `;
  return params.results.length;
}

/** Replace a unit's text (remediation repair). */
export async function updateUnitTextPostgres(params: {
  workspaceId: string;
  unitId: string;
  text: string;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  await sql`
    UPDATE knowledge_graph_units SET text = ${params.text}, validation_status = 'ok', validation_note = 'remediated'
    WHERE id = ${params.unitId} AND workspace_id = ${params.workspaceId}
  `;
}

/** Delete a unit and any relations referencing it (remediation drop). Group memberships cascade. */
export async function deleteUnitPostgres(params: { workspaceId: string; unitId: string }): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  await sql`
    DELETE FROM knowledge_graph_relations
    WHERE workspace_id = ${params.workspaceId} AND (from_unit_id = ${params.unitId} OR to_unit_id = ${params.unitId})
  `;
  await sql`DELETE FROM knowledge_graph_units WHERE id = ${params.unitId} AND workspace_id = ${params.workspaceId}`;
}

export type ConnectGraphUnitReviewRow = {
  unitId: string;
  validationStatus: string | null;
  validationNote: string | null;
  unitType: string | null;
  domainPackId: string | null;
  sourceId: string | null;
};

export async function getConnectGraphUnitForReview(params: {
  workspaceId: string;
  unitId: string;
}): Promise<ConnectGraphUnitReviewRow | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, validation_status, validation_note, unit_type, domain_pack_id, source_id
    FROM knowledge_graph_units
    WHERE id = ${params.unitId} AND workspace_id = ${params.workspaceId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    unitId: String(row.id),
    validationStatus: row.validation_status != null ? String(row.validation_status) : null,
    validationNote: row.validation_note != null ? String(row.validation_note) : null,
    unitType: row.unit_type != null ? String(row.unit_type) : null,
    domainPackId: row.domain_pack_id != null ? String(row.domain_pack_id) : null,
    sourceId: row.source_id != null ? String(row.source_id) : null,
  };
}

export async function isWorkspaceIngestQualityTelemetryEnabled(
  workspaceId: string,
): Promise<boolean> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT settings FROM workspaces WHERE id = ${workspaceId} LIMIT 1
  `;
  if (rows.length === 0) return true;
  const settings = rows[0]?.settings;
  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    const flag = (settings as Record<string, unknown>).ingest_quality_telemetry;
    if (flag === false) return false;
  }
  return true;
}

export type ConnectReviewSignalContext = {
  telemetryEnabled: boolean;
  ingestJobId: string | null;
  sourceKind: string | null;
  timeSinceIngestCompleteMs: number | null;
};

/** Resolve ingest job + G5 latency for a reviewed unit (Postgres graph spine). */
export async function getConnectReviewSignalContext(params: {
  workspaceId: string;
  sourceId: string | null;
  domainPackId: string | null;
}): Promise<ConnectReviewSignalContext> {
  await ensureIngestionRoutingSchema();
  const telemetryEnabled = await isWorkspaceIngestQualityTelemetryEnabled(params.workspaceId);
  if (!telemetryEnabled) {
    return {
      telemetryEnabled: false,
      ingestJobId: null,
      sourceKind: null,
      timeSinceIngestCompleteMs: null,
    };
  }

  const sql = getSql();
  let ingestJobId: string | null = null;
  let sourceKind: string | null = null;
  let completedAtMs: number | null = null;

  if (params.sourceId) {
    const sourceRows = await sql`
      SELECT job_id, source_kind FROM knowledge_graph_sources
      WHERE id = ${params.sourceId} AND workspace_id = ${params.workspaceId}
      LIMIT 1
    `;
    if (sourceRows.length > 0) {
      const src = sourceRows[0] as Record<string, unknown>;
      ingestJobId = src.job_id != null ? String(src.job_id) : null;
      sourceKind = src.source_kind != null ? String(src.source_kind) : null;
    }
  }

  if (ingestJobId) {
    const jobRows = await sql`
      SELECT updated_at FROM knowledge_ingest_jobs
      WHERE id = ${ingestJobId} AND workspace_id = ${params.workspaceId} AND status = 'completed'
      LIMIT 1
    `;
    if (jobRows.length > 0) {
      completedAtMs = Number((jobRows[0] as Record<string, unknown>).updated_at);
    } else {
      ingestJobId = null;
    }
  }

  if (completedAtMs == null) {
    const fallback =
      params.domainPackId != null
        ? await sql`
            SELECT id, updated_at FROM knowledge_ingest_jobs
            WHERE workspace_id = ${params.workspaceId}
              AND status = 'completed'
              AND domain_pack_id = ${params.domainPackId}
            ORDER BY updated_at DESC
            LIMIT 1
          `
        : await sql`
            SELECT id, updated_at FROM knowledge_ingest_jobs
            WHERE workspace_id = ${params.workspaceId} AND status = 'completed'
            ORDER BY updated_at DESC
            LIMIT 1
          `;
    if (fallback.length > 0) {
      const row = fallback[0] as Record<string, unknown>;
      ingestJobId = String(row.id);
      completedAtMs = Number(row.updated_at);
    }
  }

  const timeSinceIngestCompleteMs =
    completedAtMs != null && Number.isFinite(completedAtMs)
      ? Math.max(0, Date.now() - completedAtMs)
      : null;

  return {
    telemetryEnabled: true,
    ingestJobId,
    sourceKind,
    timeSinceIngestCompleteMs,
  };
}

export type ReviewSignalEvalRow = {
  verdict_delta: string | null;
  pack_archetype: string | null;
  ai_flag_theme: string | null;
  human_note_theme: string | null;
  action_type: string | null;
};

export async function listReviewSignalsForEval(params: { days: number }): Promise<ReviewSignalEvalRow[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const since = Date.now() - params.days * 24 * 60 * 60 * 1000;
  const rows = await sql`
    SELECT verdict_delta, pack_archetype, ai_flag_theme, human_note_theme, action_type
    FROM knowledge_review_signals
    WHERE created_at >= ${since}
  `;
  return rows.map((row: Record<string, unknown>) => ({
    verdict_delta: row.verdict_delta != null ? String(row.verdict_delta) : null,
    pack_archetype: row.pack_archetype != null ? String(row.pack_archetype) : null,
    ai_flag_theme: row.ai_flag_theme != null ? String(row.ai_flag_theme) : null,
    human_note_theme: row.human_note_theme != null ? String(row.human_note_theme) : null,
    action_type: row.action_type != null ? String(row.action_type) : null,
  }));
}

export type IngestQualityRunRecord = {
  id: string;
  windowDays: number;
  status: "evaluated" | "applied" | "failed";
  fired: unknown;
  briefMarkdown: string | null;
  appliedActions: unknown;
  createdByUserId: string | null;
  createdAt: number;
  appliedAt: number | null;
};

function mapIngestQualityRunRow(row: Record<string, unknown>): IngestQualityRunRecord {
  return {
    id: String(row.id),
    windowDays: Number(row.window_days),
    status: String(row.status) as IngestQualityRunRecord["status"],
    fired: row.fired,
    briefMarkdown: row.brief_markdown != null ? String(row.brief_markdown) : null,
    appliedActions: row.applied_actions,
    createdByUserId: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    createdAt: Number(row.created_at),
    appliedAt: row.applied_at != null ? Number(row.applied_at) : null,
  };
}

export async function insertIngestQualityRun(params: {
  windowDays: number;
  status: "evaluated" | "applied" | "failed";
  fired: unknown;
  briefMarkdown: string | null;
  createdByUserId: string | null;
}): Promise<string> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const id = crypto.randomUUID();
  const now = Date.now();
  await sql`
    INSERT INTO knowledge_ingest_quality_runs (
      id, window_days, status, fired, brief_markdown, created_by_user_id, created_at
    ) VALUES (
      ${id}, ${params.windowDays}, ${params.status},
      ${JSON.stringify(params.fired)}, ${params.briefMarkdown}, ${params.createdByUserId}, ${now}
    )
  `;
  return id;
}

export async function listIngestQualityRuns(params?: { limit?: number }): Promise<IngestQualityRunRecord[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const limit = Math.min(50, Math.max(1, params?.limit ?? 20));
  const rows = await sql`
    SELECT * FROM knowledge_ingest_quality_runs
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => mapIngestQualityRunRow(row as Record<string, unknown>));
}

export async function getIngestQualityRunById(runId: string): Promise<IngestQualityRunRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_ingest_quality_runs WHERE id = ${runId} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapIngestQualityRunRow(rows[0] as Record<string, unknown>);
}

export async function markIngestQualityRunApplied(params: {
  runId: string;
  appliedActions: unknown;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  await sql`
    UPDATE knowledge_ingest_quality_runs
    SET status = 'applied', applied_actions = ${JSON.stringify(params.appliedActions)}, applied_at = ${now}
    WHERE id = ${params.runId}
  `;
}

export async function listProductionG2SampleJobs(params: {
  limit: number;
}): Promise<import("./connect/ingest-quality-gates-data").ProductionG2SampleJob[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const limit = Math.min(20, Math.max(1, params.limit));
  const rows = await sql`
    SELECT id, workspace_id, project_id, label, updated_at, progress
    FROM knowledge_ingest_jobs
    WHERE status = 'completed'
    ORDER BY updated_at DESC
    LIMIT ${limit * 3}
  `;
  const jobs: import("./connect/ingest-quality-gates-data").ProductionG2SampleJob[] = [];
  for (const row of rows) {
    if (jobs.length >= limit) break;
    const progressRaw = row.progress;
    const qualityRaw =
      progressRaw &&
      typeof progressRaw === "object" &&
      !Array.isArray(progressRaw) &&
      "quality_report" in progressRaw
        ? (progressRaw as Record<string, unknown>).quality_report
        : undefined;
    const report = parseStoredProductionQualityReport(qualityRaw);
    if (!report) continue;
    jobs.push(
      buildProductionG2SampleJob({
        id: String(row.id),
        workspaceId: String(row.workspace_id),
        projectId: row.project_id != null ? String(row.project_id) : null,
        label: row.label != null ? String(row.label) : null,
        updatedAt: Number(row.updated_at),
        report,
      }),
    );
  }
  return jobs;
}

export async function getRecentProductionG2Metrics(params: { limit: number }): Promise<{
  ok_pct: number;
  unsupported_pct: number;
  sample_jobs: number;
}> {
  const jobs = await listProductionG2SampleJobs(params);
  const aggregate = summarizeG2Aggregate(jobs);
  return {
    ok_pct: aggregate.ok_pct,
    unsupported_pct: aggregate.unsupported_pct,
    sample_jobs: aggregate.sample_jobs,
  };
}

export async function bumpBuiltinPackPromptVersionsByArchetypes(params: {
  archetypes: string[];
}): Promise<
  { id: string; slug: string; archetype: string | null; promptTemplateVersion: number }[]
> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const archetypes = [...new Set(params.archetypes.map((a) => a.trim()).filter(Boolean))];
  if (archetypes.length === 0) return [];

  const rows = await sql`
    UPDATE knowledge_domain_packs
    SET prompt_template_version = prompt_template_version + 1, updated_at = ${Date.now()}
    WHERE is_builtin = true AND archetype = ANY(${archetypes})
    RETURNING id, slug, archetype, prompt_template_version
  `;
  return rows.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    slug: String(row.slug),
    archetype: row.archetype != null ? String(row.archetype) : null,
    promptTemplateVersion: Number(row.prompt_template_version ?? 1),
  }));
}

export async function insertKnowledgeReviewSignal(params: {
  workspaceId: string;
  unitId: string;
  aiStatus: string | null;
  aiFlagReason: string | null;
  humanStatus: string;
  humanNote: string | null;
  aiFlagTheme: string;
  humanNoteTheme: string;
  verdictDelta: string;
  actionType: string;
  domainPackId: string | null;
  packArchetype: string | null;
  packSlug: string | null;
  qualityPreset: string | null;
  schemaMode: string | null;
  unitType: string | null;
  sourceKind: string | null;
  ingestJobId: string | null;
  timeSinceIngestCompleteMs: number | null;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  await sql`
    INSERT INTO knowledge_review_signals (
      id, workspace_id, unit_id, ai_status, ai_flag_reason, human_status, human_note,
      ai_flag_theme, human_note_theme, verdict_delta, action_type,
      domain_pack_id, pack_archetype, pack_slug, quality_preset, schema_mode, unit_type,
      source_kind, ingest_job_id, time_since_ingest_complete_ms, created_at
    ) VALUES (
      ${crypto.randomUUID()}, ${params.workspaceId}, ${params.unitId},
      ${params.aiStatus}, ${params.aiFlagReason}, ${params.humanStatus}, ${params.humanNote},
      ${params.aiFlagTheme}, ${params.humanNoteTheme}, ${params.verdictDelta}, ${params.actionType},
      ${params.domainPackId}, ${params.packArchetype}, ${params.packSlug}, ${params.qualityPreset},
      ${params.schemaMode}, ${params.unitType}, ${params.sourceKind}, ${params.ingestJobId},
      ${params.timeSinceIngestCompleteMs}, ${now}
    )
  `;
}

/** Store groups + memberships (grouping stage). `members.unitId` are existing unit ids. */
export async function storeGroupsPostgres(params: {
  workspaceId: string;
  domainPackId?: string | null;
  groups: { name: string; summary?: string | null; members: { unitId: string; role?: string | null }[] }[];
}): Promise<{ groups: number; members: number }> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  let groupCount = 0;
  let memberCount = 0;
  for (const g of params.groups) {
    if (!g.name?.trim() || g.members.length === 0) continue;
    const groupId = crypto.randomUUID();
    await sql`
      INSERT INTO knowledge_graph_groups (id, workspace_id, domain_pack_id, name, summary, payload, created_at)
      VALUES (${groupId}, ${params.workspaceId}, ${params.domainPackId ?? null}, ${g.name}, ${g.summary ?? null}, NULL, ${now})
    `;
    groupCount += 1;
    for (const m of g.members) {
      await sql`
        INSERT INTO knowledge_graph_group_members (id, workspace_id, group_id, unit_id, role, created_at)
        VALUES (${crypto.randomUUID()}, ${params.workspaceId}, ${groupId}, ${m.unitId}, ${m.role ?? null}, ${now})
      `;
      memberCount += 1;
    }
  }
  return { groups: groupCount, members: memberCount };
}

export async function updateConnectGraphTargetStatus(params: {
  workspaceId: string;
  /** Specific graph to update; defaults to the workspace's active graph. */
  graphTargetId?: string;
  status: "untested" | "ok" | "error";
  lastError?: string | null;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const targetId =
    params.graphTargetId ??
    (await getConnectGraphTargetForWorkspace(params.workspaceId))?.id;
  if (!targetId) return;
  const sql = getSql();
  const now = Date.now();
  await sql`
    UPDATE knowledge_graph_targets
    SET status = ${params.status},
        last_error = ${params.lastError ?? null},
        last_tested_at = ${now},
        updated_at = ${now}
    WHERE id = ${targetId} AND workspace_id = ${params.workspaceId}
  `;
}

// ─── Knowledge domain packs ──────────────────────────────────────────────────

export type ConnectDomainPackRecord = {
  id: string;
  workspaceId: string;
  slug: string;
  title: string;
  description: string | null;
  ontology: unknown;
  prompts: unknown;
  graphSchema: unknown;
  passageProfile: unknown;
  entityLinking: unknown;
  embedding: unknown;
  qualityPreset: string;
  crossModelValidation: boolean;
  archetype: string | null;
  promptTemplateVersion: number;
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
};

function mapConnectDomainPackRow(row: Record<string, unknown>): ConnectDomainPackRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    slug: String(row.slug),
    title: String(row.title),
    description: row.description != null ? String(row.description) : null,
    ontology: row.ontology,
    prompts: row.prompts ?? {},
    graphSchema: row.graph_schema,
    passageProfile: row.passage_profile,
    entityLinking: row.entity_linking ?? null,
    embedding: row.embedding,
    qualityPreset: row.quality_preset != null ? String(row.quality_preset) : "production",
    crossModelValidation: row.cross_model_validation !== false,
    archetype: row.archetype != null ? String(row.archetype) : null,
    promptTemplateVersion: Number(row.prompt_template_version ?? 1),
    isBuiltin: Boolean(row.is_builtin),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function listConnectDomainPacksForWorkspace(
  workspaceId: string,
): Promise<ConnectDomainPackRecord[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_domain_packs WHERE workspace_id = ${workspaceId} ORDER BY updated_at DESC
  `;
  return rows.map((r) => mapConnectDomainPackRow(r as Record<string, unknown>));
}

export async function getConnectDomainPackById(params: {
  id: string;
  workspaceId: string;
}): Promise<ConnectDomainPackRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_domain_packs WHERE id = ${params.id} AND workspace_id = ${params.workspaceId} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapConnectDomainPackRow(rows[0] as Record<string, unknown>);
}

export async function upsertConnectDomainPack(params: {
  workspaceId: string;
  slug: string;
  title: string;
  description?: string | null;
  ontology: unknown;
  prompts: unknown;
  graphSchema: unknown;
  passageProfile: unknown;
  entityLinking?: unknown;
  embedding: unknown;
  qualityPreset?: string;
  crossModelValidation?: boolean;
  archetype?: string | null;
  promptTemplateVersion?: number;
  isBuiltin?: boolean;
}): Promise<ConnectDomainPackRecord> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const id = crypto.randomUUID();
  const ontologyJson = JSON.stringify(params.ontology ?? {});
  const promptsJson = JSON.stringify(params.prompts ?? {});
  const graphSchemaJson = JSON.stringify(params.graphSchema ?? {});
  const passageJson = JSON.stringify(params.passageProfile ?? {});
  const entityJson = params.entityLinking != null ? JSON.stringify(params.entityLinking) : null;
  const embeddingJson = JSON.stringify(params.embedding ?? {});
  const qualityPreset = params.qualityPreset ?? "production";
  const crossModelValidation = params.crossModelValidation !== false;
  const archetype = params.archetype ?? null;
  const promptTemplateVersion = params.promptTemplateVersion ?? 1;
  await sql`
    INSERT INTO knowledge_domain_packs (
      id, workspace_id, slug, title, description, ontology, prompts, graph_schema,
      passage_profile, entity_linking, embedding, quality_preset, cross_model_validation,
      archetype, prompt_template_version, is_builtin, created_at, updated_at
    ) VALUES (
      ${id}, ${params.workspaceId}, ${params.slug}, ${params.title}, ${params.description ?? null},
      ${ontologyJson}::jsonb, ${promptsJson}::jsonb, ${graphSchemaJson}::jsonb,
      ${passageJson}::jsonb, ${entityJson}::jsonb, ${embeddingJson}::jsonb,
      ${qualityPreset}, ${crossModelValidation}, ${archetype}, ${promptTemplateVersion},
      ${params.isBuiltin ?? false}, ${now}, ${now}
    )
    ON CONFLICT (workspace_id, slug) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      ontology = EXCLUDED.ontology,
      prompts = EXCLUDED.prompts,
      graph_schema = EXCLUDED.graph_schema,
      passage_profile = EXCLUDED.passage_profile,
      entity_linking = EXCLUDED.entity_linking,
      embedding = EXCLUDED.embedding,
      quality_preset = EXCLUDED.quality_preset,
      cross_model_validation = EXCLUDED.cross_model_validation,
      archetype = COALESCE(EXCLUDED.archetype, knowledge_domain_packs.archetype),
      prompt_template_version = EXCLUDED.prompt_template_version,
      updated_at = ${now}
  `;
  const rows = await sql`
    SELECT * FROM knowledge_domain_packs WHERE workspace_id = ${params.workspaceId} AND slug = ${params.slug} LIMIT 1
  `;
  return mapConnectDomainPackRow(rows[0] as Record<string, unknown>);
}

export async function deleteConnectDomainPack(params: { id: string; workspaceId: string }): Promise<boolean> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM knowledge_domain_packs
    WHERE id = ${params.id} AND workspace_id = ${params.workspaceId} AND is_builtin = false
    RETURNING id
  `;
  return rows.length > 0;
}

// ─── Knowledge pipeline profiles ─────────────────────────────────────────────

export type ConnectPipelineProfileRecord = {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  domainPackId: string;
  graphTargetId: string | null;
  defaultStopAfterStage: string | null;
  createdAt: number;
  updatedAt: number;
};

function mapConnectPipelineProfileRow(row: Record<string, unknown>): ConnectPipelineProfileRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    title: String(row.title),
    description: row.description != null ? String(row.description) : null,
    domainPackId: String(row.domain_pack_id),
    graphTargetId: row.graph_target_id != null ? String(row.graph_target_id) : null,
    defaultStopAfterStage: row.default_stop_after_stage != null ? String(row.default_stop_after_stage) : null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function listConnectPipelineProfilesForWorkspace(
  workspaceId: string,
): Promise<ConnectPipelineProfileRecord[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_pipeline_profiles WHERE workspace_id = ${workspaceId} ORDER BY updated_at DESC
  `;
  return rows.map((r) => mapConnectPipelineProfileRow(r as Record<string, unknown>));
}

export async function getConnectPipelineProfileById(params: {
  id: string;
  workspaceId: string;
}): Promise<ConnectPipelineProfileRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_pipeline_profiles WHERE id = ${params.id} AND workspace_id = ${params.workspaceId} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapConnectPipelineProfileRow(rows[0] as Record<string, unknown>);
}

export async function insertConnectPipelineProfile(params: {
  workspaceId: string;
  title: string;
  description?: string | null;
  domainPackId: string;
  graphTargetId?: string | null;
  defaultStopAfterStage?: string | null;
}): Promise<ConnectPipelineProfileRecord> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const id = crypto.randomUUID();
  await sql`
    INSERT INTO knowledge_pipeline_profiles (
      id, workspace_id, title, description, domain_pack_id, graph_target_id, default_stop_after_stage, created_at, updated_at
    ) VALUES (
      ${id}, ${params.workspaceId}, ${params.title}, ${params.description ?? null},
      ${params.domainPackId}, ${params.graphTargetId ?? null}, ${params.defaultStopAfterStage ?? null}, ${now}, ${now}
    )
  `;
  const rows = await sql`SELECT * FROM knowledge_pipeline_profiles WHERE id = ${id} LIMIT 1`;
  return mapConnectPipelineProfileRow(rows[0] as Record<string, unknown>);
}

export async function deleteConnectPipelineProfile(params: { id: string; workspaceId: string }): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  await sql`
    DELETE FROM knowledge_pipeline_profiles WHERE id = ${params.id} AND workspace_id = ${params.workspaceId}
  `;
}

// ─── Knowledge source documents (connectors + parsing) ───────────────────────

export type ConnectSourceDocumentRecord = {
  id: string;
  workspaceId: string;
  sourceKind: string;
  name: string;
  mime: string | null;
  url: string | null;
  text: string | null;
  charCount: number;
  chunkCount: number;
  status: string;
  error: string | null;
  parserProvider: string | null;
  provenance: Record<string, unknown> | null;
  createdAt: number;
};

function mapConnectSourceDocumentRow(row: Record<string, unknown>): ConnectSourceDocumentRecord {
  const prov = row.provenance;
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    sourceKind: String(row.source_kind),
    name: String(row.name),
    mime: row.mime != null ? String(row.mime) : null,
    url: row.url != null ? String(row.url) : null,
    text: row.text != null ? String(row.text) : null,
    charCount: Number(row.char_count ?? 0),
    chunkCount: Number(row.chunk_count ?? 0),
    status: String(row.status),
    error: row.error != null ? String(row.error) : null,
    parserProvider: row.parser_provider != null ? String(row.parser_provider) : null,
    provenance:
      prov && typeof prov === "object" && !Array.isArray(prov) ? (prov as Record<string, unknown>) : null,
    createdAt: Number(row.created_at),
  };
}

export async function insertConnectSourceDocument(params: {
  id: string;
  workspaceId: string;
  sourceKind: string;
  name: string;
  mime?: string | null;
  url?: string | null;
  text?: string | null;
  charCount: number;
  chunkCount: number;
  status: "parsed" | "failed" | "pending";
  error?: string | null;
  parserProvider?: string | null;
  provenance?: Record<string, unknown> | null;
}): Promise<ConnectSourceDocumentRecord> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const provenanceJson =
    params.provenance && Object.keys(params.provenance).length > 0
      ? JSON.stringify(params.provenance)
      : null;
  await sql`
    INSERT INTO knowledge_source_documents (
      id, workspace_id, source_kind, name, mime, url, text, char_count, chunk_count, status, error, parser_provider, provenance, created_at
    ) VALUES (
      ${params.id}, ${params.workspaceId}, ${params.sourceKind}, ${params.name}, ${params.mime ?? null},
      ${params.url ?? null}, ${params.text ?? null}, ${params.charCount}, ${params.chunkCount}, ${params.status},
      ${params.error ?? null}, ${params.parserProvider ?? null}, ${provenanceJson}::jsonb, ${now}
    )
  `;
  const rows = await sql`SELECT * FROM knowledge_source_documents WHERE id = ${params.id} LIMIT 1`;
  return mapConnectSourceDocumentRow(rows[0] as Record<string, unknown>);
}

/** All graph spine sources for a workspace (metadata only). */
export async function listConnectGraphSourcesForWorkspace(
  workspaceId: string,
): Promise<
  {
    id: string;
    title: string | null;
    url: string | null;
    textPreview: string | null;
    sourceKind: string | null;
    jobId: string | null;
  }[]
> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, title, url, text_preview, source_kind, job_id
    FROM knowledge_graph_sources
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
    LIMIT 500
  `) as {
    id: string;
    title: string | null;
    url: string | null;
    text_preview: string | null;
    source_kind: string | null;
    job_id: string | null;
  }[];
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    url: r.url,
    textPreview: r.text_preview,
    sourceKind: r.source_kind,
    jobId: r.job_id,
  }));
}

/** Count parsed pipeline documents (no text payload — for options/audit panels). */
export async function countParsedConnectSourceDocumentsForWorkspace(
  workspaceId: string,
): Promise<number> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT count(*)::int AS c
    FROM knowledge_source_documents
    WHERE workspace_id = ${workspaceId}
      AND status = 'parsed'
      AND text IS NOT NULL
      AND btrim(text) <> ''
  `) as { c: number }[];
  return Number(rows[0]?.c ?? 0);
}

/** Count parsed pipeline documents imported from a BYO graph source catalog. */
export async function countGraphImportedCatalogSources(workspaceId: string): Promise<number> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT count(*)::int AS c
    FROM knowledge_source_documents
    WHERE workspace_id = ${workspaceId}
      AND status = 'parsed'
      AND source_kind = 'graph_import'
      AND text IS NOT NULL
      AND btrim(text) <> ''
  `) as { c: number }[];
  return Number(rows[0]?.c ?? 0);
}

/** Parsed pipeline documents with full text for automated source matching. */
export async function listParsedConnectSourceDocumentTextsForWorkspace(
  workspaceId: string,
  limit = 200,
): Promise<
  {
    id: string;
    name: string;
    url: string | null;
    text: string;
    sourceKind: string | null;
    provenance: Record<string, unknown> | null;
  }[]
> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const cap = Math.min(Math.max(limit, 1), 500);
  const rows = (await sql`
    SELECT id, name, url, text, source_kind, provenance
    FROM knowledge_source_documents
    WHERE workspace_id = ${workspaceId}
      AND status = 'parsed'
      AND text IS NOT NULL
    ORDER BY created_at DESC
    LIMIT ${cap}
  `) as {
    id: string;
    name: string;
    url: string | null;
    text: string | null;
    source_kind: string | null;
    provenance: unknown;
  }[];
  return rows
    .filter((r) => typeof r.text === "string" && r.text.trim().length > 0)
    .map((r) => {
      const prov =
        r.provenance && typeof r.provenance === "object" && !Array.isArray(r.provenance)
          ? (r.provenance as Record<string, unknown>)
          : null;
      return {
        id: r.id,
        name: r.name,
        url: r.url,
        text: r.text!.trim(),
        sourceKind: typeof r.source_kind === "string" ? r.source_kind : null,
        provenance: prov,
      };
    });
}

/** Ideas likely missing usable source provenance (legacy spine rows or empty metadata). */
export async function countGraphUnitsNeedingSourceLink(workspaceId: string): Promise<number> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT count(*)::int AS c
    FROM knowledge_graph_units u
    JOIN knowledge_graph_sources s
      ON s.id = u.source_id AND s.workspace_id = u.workspace_id
    WHERE u.workspace_id = ${workspaceId}
      AND (
        s.source_kind = 'legacy'
        OR (
          s.text_preview IS NULL
          AND s.url IS NULL
          AND coalesce(s.title, '') NOT ILIKE '%http%'
        )
      )
  `) as { c: number }[];
  return Number(rows[0]?.c ?? 0);
}

export async function findConnectGraphSourceByTitleOrUrl(params: {
  workspaceId: string;
  title?: string | null;
  url?: string | null;
}): Promise<string | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const url = params.url?.trim();
  if (url) {
    const byUrl = (await sql`
      SELECT id FROM knowledge_graph_sources
      WHERE workspace_id = ${params.workspaceId} AND url = ${url}
      ORDER BY created_at DESC
      LIMIT 1
    `) as { id: string }[];
    if (byUrl[0]?.id) return byUrl[0].id;
  }
  const title = params.title?.trim();
  if (title) {
    const byTitle = (await sql`
      SELECT id FROM knowledge_graph_sources
      WHERE workspace_id = ${params.workspaceId} AND title = ${title}
      ORDER BY created_at DESC
      LIMIT 1
    `) as { id: string }[];
    if (byTitle[0]?.id) return byTitle[0].id;
  }
  return null;
}

export async function updateUnitSourcePostgres(params: {
  workspaceId: string;
  unitId: string;
  sourceId: string;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  await sql`
    UPDATE knowledge_graph_units
    SET source_id = ${params.sourceId}
    WHERE id = ${params.unitId} AND workspace_id = ${params.workspaceId}
  `;
}

/** List documents for a workspace (without full text). */
export async function listConnectSourceDocumentsForWorkspace(
  workspaceId: string,
): Promise<ConnectSourceDocumentRecord[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id, source_kind, name, mime, url, provenance, NULL AS text, char_count, chunk_count, status, error, parser_provider, created_at
    FROM knowledge_source_documents
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
    LIMIT 500
  `;
  return rows.map((r) => mapConnectSourceDocumentRow(r as Record<string, unknown>));
}

/** Fetch full documents (incl. text) by ids, scoped to a workspace. */
export async function getConnectSourceDocumentsByIds(params: {
  ids: string[];
  workspaceId: string;
}): Promise<ConnectSourceDocumentRecord[]> {
  await ensureIngestionRoutingSchema();
  if (params.ids.length === 0) return [];
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_source_documents
    WHERE workspace_id = ${params.workspaceId} AND id = ANY(${params.ids})
  `;
  return rows.map((r) => mapConnectSourceDocumentRow(r as Record<string, unknown>));
}

/** Resolve parsed document text by name or URL for graph re-validation. */
export async function findConnectSourceDocumentText(params: {
  workspaceId: string;
  name?: string | null;
  url?: string | null;
}): Promise<string | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const url = params.url?.trim();
  if (url) {
    const byUrl = (await sql`
      SELECT text FROM knowledge_source_documents
      WHERE workspace_id = ${params.workspaceId} AND url = ${url}
        AND status = 'parsed' AND text IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `) as { text: string | null }[];
    if (byUrl[0]?.text?.trim()) return byUrl[0].text.trim();
  }
  const name = params.name?.trim();
  if (name) {
    const exact = (await sql`
      SELECT text FROM knowledge_source_documents
      WHERE workspace_id = ${params.workspaceId} AND name = ${name}
        AND status = 'parsed' AND text IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `) as { text: string | null }[];
    if (exact[0]?.text?.trim()) return exact[0].text.trim();
    const fuzzy = (await sql`
      SELECT text FROM knowledge_source_documents
      WHERE workspace_id = ${params.workspaceId} AND name ILIKE ${name}
        AND status = 'parsed' AND text IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 1
    `) as { text: string | null }[];
    if (fuzzy[0]?.text?.trim()) return fuzzy[0].text.trim();
  }
  return null;
}

export async function deleteConnectSourceDocument(params: { id: string; workspaceId: string }): Promise<boolean> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    DELETE FROM knowledge_source_documents WHERE id = ${params.id} AND workspace_id = ${params.workspaceId}
    RETURNING id
  `;
  return rows.length > 0;
}

// ─── Knowledge source connections (cloud connectors) ─────────────────────────

export type ConnectSourceConnectionRecord = {
  id: string;
  workspaceId: string;
  provider: string;
  label: string | null;
  config: unknown;
  secretCiphertext: string | null;
  secretIv: string | null;
  secretAuthTag: string | null;
  secretEncryptionVersion: number;
  status: string;
  createdAt: number;
  updatedAt: number;
};

function mapConnectSourceConnectionRow(row: Record<string, unknown>): ConnectSourceConnectionRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspace_id),
    provider: String(row.provider),
    label: row.label != null ? String(row.label) : null,
    config: row.config ?? {},
    secretCiphertext: row.secret_ciphertext != null ? String(row.secret_ciphertext) : null,
    secretIv: row.secret_iv != null ? String(row.secret_iv) : null,
    secretAuthTag: row.secret_auth_tag != null ? String(row.secret_auth_tag) : null,
    secretEncryptionVersion: Number(row.secret_encryption_version ?? 0),
    status: String(row.status),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

export async function insertConnectSourceConnection(params: {
  id: string;
  workspaceId: string;
  provider: string;
  label?: string | null;
  config: unknown;
  status: string;
  secret?: { ciphertext: string; iv: string; authTag: string; encryptionVersion: number } | null;
}): Promise<ConnectSourceConnectionRecord> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  const configJson = JSON.stringify(params.config ?? {});
  await sql`
    INSERT INTO knowledge_sources (
      id, workspace_id, provider, label, config,
      secret_ciphertext, secret_iv, secret_auth_tag, secret_encryption_version, status, created_at, updated_at
    ) VALUES (
      ${params.id}, ${params.workspaceId}, ${params.provider}, ${params.label ?? null}, ${configJson}::jsonb,
      ${params.secret?.ciphertext ?? null}, ${params.secret?.iv ?? null}, ${params.secret?.authTag ?? null},
      ${params.secret?.encryptionVersion ?? 0}, ${params.status}, ${now}, ${now}
    )
  `;
  const rows = await sql`SELECT * FROM knowledge_sources WHERE id = ${params.id} LIMIT 1`;
  return mapConnectSourceConnectionRow(rows[0] as Record<string, unknown>);
}

export async function listConnectSourceConnections(
  workspaceId: string,
): Promise<ConnectSourceConnectionRecord[]> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_sources WHERE workspace_id = ${workspaceId} ORDER BY updated_at DESC
  `;
  return rows.map((r) => mapConnectSourceConnectionRow(r as Record<string, unknown>));
}

export async function getConnectSourceConnection(params: {
  id: string;
  workspaceId: string;
}): Promise<ConnectSourceConnectionRecord | null> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT * FROM knowledge_sources WHERE id = ${params.id} AND workspace_id = ${params.workspaceId} LIMIT 1
  `;
  if (rows.length === 0) return null;
  return mapConnectSourceConnectionRow(rows[0] as Record<string, unknown>);
}

export async function updateConnectSourceConnection(params: {
  id: string;
  workspaceId: string;
  status?: string;
  config?: unknown;
  secret?: { ciphertext: string; iv: string; authTag: string; encryptionVersion: number } | null;
}): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  const now = Date.now();
  if (params.status !== undefined) {
    await sql`UPDATE knowledge_sources SET status = ${params.status}, updated_at = ${now} WHERE id = ${params.id} AND workspace_id = ${params.workspaceId}`;
  }
  if (params.config !== undefined) {
    const configJson = JSON.stringify(params.config);
    await sql`UPDATE knowledge_sources SET config = ${configJson}::jsonb, updated_at = ${now} WHERE id = ${params.id} AND workspace_id = ${params.workspaceId}`;
  }
  if (params.secret) {
    await sql`
      UPDATE knowledge_sources SET
        secret_ciphertext = ${params.secret.ciphertext},
        secret_iv = ${params.secret.iv},
        secret_auth_tag = ${params.secret.authTag},
        secret_encryption_version = ${params.secret.encryptionVersion},
        updated_at = ${now}
      WHERE id = ${params.id} AND workspace_id = ${params.workspaceId}
    `;
  }
}

export async function deleteConnectSourceConnection(params: { id: string; workspaceId: string }): Promise<void> {
  await ensureIngestionRoutingSchema();
  const sql = getSql();
  await sql`DELETE FROM knowledge_sources WHERE id = ${params.id} AND workspace_id = ${params.workspaceId}`;
}

// ---------------------------------------------------------------------------
// Management keys (project-scoped; issued via session auth)
// ---------------------------------------------------------------------------

const MANAGEMENT_KEY_PREFIX = "rmk_";

export type ManagementKeyRecord = {
  id: string;
  workspaceId: string;
  /** Friendly label set by the issuing user (optional). */
  label: string | null;
  keyPrefix: string;
  status: "active" | "revoked";
  createdAt: number;
  lastUsedAt: number | null;
};

function mapManagementKeyRow(r: Record<string, unknown>): ManagementKeyRecord {
  return {
    id: r.id as string,
    workspaceId: r.workspaceId as string,
    label: (r.label as string | null) ?? null,
    keyPrefix: r.keyPrefix as string,
    status: ((r.status as string) === "revoked" ? "revoked" : "active") as ManagementKeyRecord["status"],
    createdAt: Number(r.createdAt),
    lastUsedAt: r.lastUsedAt != null ? Number(r.lastUsedAt) : null,
  };
}

/**
 * List management keys for a workspace (session auth only).
 * Scoping model: management keys are workspace-level; gateway keys are project-level.
 */
export async function listManagementKeys(workspaceId: string): Promise<ManagementKeyRecord[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, workspace_id AS "workspaceId", name AS label, key_prefix AS "keyPrefix",
           COALESCE(status, 'active') AS status,
           created_at AS "createdAt", last_used_at AS "lastUsedAt"
    FROM management_keys
    WHERE workspace_id = ${workspaceId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => mapManagementKeyRow(r as Record<string, unknown>));
}

/**
 * Create a management key scoped to the given workspace.
 * Returns the raw key once; caller must display it to the user. Only prefix + hash are stored.
 * Session auth required (never callable via gateway or management key).
 */
export async function createManagementKey(params: {
  workspaceId: string;
  label?: string;
  actorId: string;
}): Promise<{ rawKey: string; keyPrefix: string; keyId: string }> {
  const rawKey = MANAGEMENT_KEY_PREFIX + randomBytes(24).toString("base64url");
  const keyHash = hashKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12) + "…";
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  const label = params.label?.trim() || null;
  const sql = getSql();
  await sql`
    INSERT INTO management_keys (id, workspace_id, name, key_prefix, key_hash, status, created_at)
    VALUES (${id}, ${params.workspaceId}, ${label}, ${keyPrefix}, ${keyHash}, 'active', ${createdAt})
  `;
  try {
    await insertAuditEvent({
      workspaceId: params.workspaceId,
      actorId: params.actorId,
      actorType: "user",
      eventType: "management_key_created",
      targetType: "management_key",
      targetId: id,
      summary: `Management key created${label ? `: ${label}` : ""}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    console.error("[audit] management_key_created:", msg.slice(0, 80));
  }
  return { rawKey, keyPrefix, keyId: id };
}

/**
 * Revoke (soft-delete) a management key. Returns true if found and revoked.
 * Session auth required.
 */
export async function revokeManagementKey(params: {
  keyId: string;
  workspaceId: string;
  actorId: string;
}): Promise<boolean> {
  const sql = getSql();
  const now = Date.now();
  const rows = await sql`
    UPDATE management_keys
    SET status = 'revoked', last_used_at = COALESCE(last_used_at, ${now})
    WHERE id = ${params.keyId} AND workspace_id = ${params.workspaceId}
    RETURNING id
  `;
  const revoked = Array.isArray(rows) && rows.length > 0;
  if (revoked) {
    try {
      await insertAuditEvent({
        workspaceId: params.workspaceId,
        actorId: params.actorId,
        actorType: "user",
        eventType: "management_key_revoked",
        targetType: "management_key",
        targetId: params.keyId,
        summary: "Management key revoked",
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      console.error("[audit] management_key_revoked:", msg.slice(0, 80));
    }
  }
  return revoked;
}
