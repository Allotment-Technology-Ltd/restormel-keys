/**
 * Service-owner-only: list signed-in dashboard users and toggle service_admins membership.
 * Lists from app `users` mirror (Neon Auth upserts on session); enriches from Better Auth `"user"` when present.
 */
import type { AdminUserListRow } from "$lib/admin-user-list";
import { env } from "$env/dynamic/private";
import { getDb } from "$lib/server/db-adapter";
import { emailImpliesServiceOwner, normalizeEmailForServiceOwnerMatch } from "$lib/server/service-admin";
import { listServiceAdminEmails } from "$lib/server/service-admin-emails";

function getSql() {
  const url = env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // Dual-driver (P3a): routes via the shared adapter (neon-http or pg Pool).
  return getDb(url);
}

function parseAdminUserIdsEnvLocal(): Set<string> {
  const raw = (process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function isMissingRelationError(e: unknown, relation: string): boolean {
  const code = (e as { code?: string })?.code;
  if (code === "42P01") return true;
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes(`relation "${relation}" does not exist`) || msg.includes(`relation ${relation} does not exist`);
}

export type RegisteredUserRow = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string;
};

export type { AdminUserListRow };

function effectiveServiceOwner(
  userId: string,
  email: string,
  inDb: boolean,
  envIds: Set<string>,
  grantedEmails: Set<string>
): { isServiceOwner: boolean; serviceOwnerImmutable: boolean } {
  const normalized = normalizeEmailForServiceOwnerMatch(email);
  const allowEmail = emailImpliesServiceOwner(email) || (normalized != null && grantedEmails.has(normalized));
  const isServiceOwner = inDb || envIds.has(userId) || allowEmail;
  return { isServiceOwner, serviceOwnerImmutable: emailImpliesServiceOwner(email) };
}

/** Pure mapping for admin UI rows (unit-tested). */
export function mapRegisteredUsersToAdminList(
  rows: RegisteredUserRow[],
  params: {
    dbServiceAdminIds: Set<string>;
    envAdminUserIds: Set<string>;
    grantedEmails: Set<string>;
  }
): AdminUserListRow[] {
  const { dbServiceAdminIds, envAdminUserIds, grantedEmails } = params;
  return rows.map((r) => {
    const dbMember = dbServiceAdminIds.has(r.id);
    const { isServiceOwner, serviceOwnerImmutable } = effectiveServiceOwner(
      r.id,
      r.email,
      dbMember,
      envAdminUserIds,
      grantedEmails
    );
    return {
      id: r.id,
      email: r.email,
      name: r.name,
      emailVerified: r.emailVerified,
      createdAt: r.createdAt,
      isServiceOwner,
      dbServiceOwner: dbMember,
      serviceOwnerImmutable,
      operatorViaEnvUserId: envAdminUserIds.has(r.id),
    };
  });
}

function rowFromRecord(r: Record<string, unknown>): RegisteredUserRow {
  return {
    id: String(r.id),
    email: String(r.email ?? ""),
    name: String(r.name ?? ""),
    emailVerified: Boolean(r.emailVerified),
    createdAt: String(r.createdAt ?? ""),
  };
}

async function listRegisteredUserRows(): Promise<RegisteredUserRow[]> {
  const sql = getSql();
  try {
    const rows = await sql`
      SELECT
        m.id AS id,
        COALESCE(m.email, u.email, '') AS email,
        COALESCE(u.name, '') AS name,
        COALESCE(u."emailVerified", false) AS "emailVerified",
        COALESCE(m.created_at::text, (EXTRACT(EPOCH FROM u."createdAt") * 1000)::bigint::text, '') AS "createdAt"
      FROM users m
      LEFT JOIN "user" u ON u.id = m.id
      ORDER BY COALESCE(m.created_at, (EXTRACT(EPOCH FROM u."createdAt") * 1000)::bigint, 0) DESC
    `;
    return rows.map((r) => rowFromRecord(r as Record<string, unknown>));
  } catch (e) {
    if (isMissingRelationError(e, "users")) {
      const rows = await sql`
        SELECT u.id AS id, u.email AS email, u.name AS name,
               u."emailVerified" AS "emailVerified",
               u."createdAt"::text AS "createdAt"
        FROM "user" u
        ORDER BY u."createdAt" DESC
      `;
      return rows.map((r) => rowFromRecord(r as Record<string, unknown>));
    }
    if (isMissingRelationError(e, "user")) {
      const rows = await sql`
        SELECT m.id AS id, COALESCE(m.email, '') AS email,
               '' AS name, false AS "emailVerified",
               m.created_at::text AS "createdAt"
        FROM users m
        ORDER BY m.created_at DESC
      `;
      return rows.map((r) => rowFromRecord(r as Record<string, unknown>));
    }
    throw e;
  }
}

async function lookupRegisteredUserEmail(userId: string): Promise<string | null> {
  const sql = getSql();
  try {
    const mirrorRows = await sql`
      SELECT email FROM users WHERE id = ${userId} LIMIT 1
    `;
    if (Array.isArray(mirrorRows) && mirrorRows.length > 0) {
      const email = (mirrorRows[0] as { email?: string | null }).email;
      if (typeof email === "string" && email.trim()) return email;
    }
  } catch (e) {
    if (!isMissingRelationError(e, "users")) throw e;
  }

  try {
    const authRows = await sql`
      SELECT email FROM "user" WHERE id = ${userId} LIMIT 1
    `;
    if (Array.isArray(authRows) && authRows.length > 0) {
      const email = (authRows[0] as { email?: string }).email;
      if (typeof email === "string" && email.trim()) return email;
    }
  } catch (e) {
    if (!isMissingRelationError(e, "user")) throw e;
  }

  return null;
}

export async function listUsersForServiceOwnerAdmin(): Promise<AdminUserListRow[]> {
  const sql = getSql();
  const grantedEmails = new Set(
    (await listServiceAdminEmails())
      .map((row) => normalizeEmailForServiceOwnerMatch(row.email))
      .filter((e): e is string => e != null)
  );
  const rows = await listRegisteredUserRows();
  const adminRows = await sql`
    SELECT user_id FROM service_admins
  `;
  const dbServiceAdminIds = new Set(
    adminRows.map((r) => String((r as { user_id: unknown }).user_id ?? "")).filter(Boolean)
  );
  const envAdminUserIds = parseAdminUserIdsEnvLocal();

  return mapRegisteredUsersToAdminList(rows, {
    dbServiceAdminIds,
    envAdminUserIds,
    grantedEmails,
  });
}

export type SetServiceOwnerResult =
  | { ok: true }
  | { ok: false; code: "not_found" | "forbidden_immutable" | "forbidden_self" | "db_error"; message: string };

/**
 * Toggle service_admins row only. Email-allowlist owners stay effective owners even without a row.
 */
export async function setUserServiceOwnerMembership(params: {
  actorUserId: string;
  targetUserId: string;
  enabled: boolean;
}): Promise<SetServiceOwnerResult> {
  const { actorUserId, targetUserId, enabled } = params;
  if (actorUserId === targetUserId && !enabled) {
    return {
      ok: false,
      code: "forbidden_self",
      message: "Another service owner must change your role.",
    };
  }

  const sql = getSql();
  try {
    const targetEmail = await lookupRegisteredUserEmail(targetUserId);
    if (targetEmail == null) {
      return { ok: false, code: "not_found", message: "User not found." };
    }

    if (!enabled && emailImpliesServiceOwner(targetEmail)) {
      return {
        ok: false,
        code: "forbidden_immutable",
        message:
          "This account is on the primary service-owner email allowlist; change RESTORMEL_SERVICE_OWNER_EMAILS to demote.",
      };
    }

    if (enabled) {
      const now = Date.now();
      await sql`
        INSERT INTO service_admins (user_id, note, created_at)
        VALUES (${targetUserId}, ${"ui:promoted"}, ${now})
        ON CONFLICT (user_id) DO NOTHING
      `;
    } else {
      await sql`DELETE FROM service_admins WHERE user_id = ${targetUserId}`;
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, code: "db_error", message: msg.slice(0, 200) };
  }
}
