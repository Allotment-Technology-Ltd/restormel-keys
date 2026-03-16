/**
 * Neon (Postgres) storage: projects and api_keys.
 * No raw API keys stored; prefix + hash only. See security-baseline.
 * Requires DATABASE_URL (Neon connection string). Schema: apps/dashboard/migrations/001_initial.sql.
 */
import { neon } from "@neondatabase/serverless";
import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "rk_";

export type Project = {
  id: string;
  name: string;
  userId: string;
  createdAt: number;
};

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

/** List projects for user */
export async function listProjects(userId: string): Promise<Project[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", created_at AS "createdAt"
    FROM projects
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    userId: r.userId,
    createdAt: Number(r.createdAt),
  })) as Project[];
}

/** Create project; returns new project with id */
export async function createProject(userId: string, name: string): Promise<Project> {
  const sql = getSql();
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await sql`
    INSERT INTO projects (id, name, user_id, created_at)
    VALUES (${id}, ${name || "Unnamed project"}, ${userId}, ${createdAt})
  `;
  return { id, name: name || "Unnamed project", userId, createdAt };
}

/** Get project; returns null if not found or not owner */
export async function getProject(projectId: string, userId: string): Promise<Project | null> {
  const sql = getSql();
  const rows = await sql`
    SELECT id, name, user_id AS "userId", created_at AS "createdAt"
    FROM projects
    WHERE id = ${projectId} AND user_id = ${userId}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return { id: r.id, name: r.name, userId: r.userId, createdAt: Number(r.createdAt) } as Project;
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

/** Delete project (and its api_keys via FK CASCADE) */
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

/** List API keys for project (prefix only) */
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
 * Create API key. Returns { rawKey, keyPrefix } once; caller must show to user. Store only prefix + hash.
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
  return { rawKey, keyPrefix };
}

/** Revoke (delete) API key */
export async function deleteApiKey(projectId: string, keyId: string, userId: string): Promise<boolean> {
  const project = await getProject(projectId, userId);
  if (!project) return false;
  const sql = getSql();
  const rows = await sql`
    DELETE FROM api_keys WHERE id = ${keyId} AND project_id = ${projectId}
    RETURNING id
  `;
  return Array.isArray(rows) && rows.length > 0;
}
