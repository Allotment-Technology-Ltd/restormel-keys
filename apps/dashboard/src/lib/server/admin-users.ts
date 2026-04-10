/**
 * Service-owner-only: list Better Auth users and toggle service_admins membership.
 */
import type { AdminUserListRow } from "$lib/admin-user-list";
import { neon } from "@neondatabase/serverless";
import { emailImpliesServiceOwner } from "$lib/server/service-admin";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
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

export type { AdminUserListRow };

function effectiveServiceOwner(
  userId: string,
  email: string,
  inDb: boolean,
  envIds: Set<string>
): { isServiceOwner: boolean; serviceOwnerImmutable: boolean } {
  const allowEmail = emailImpliesServiceOwner(email);
  const isServiceOwner = inDb || envIds.has(userId) || allowEmail;
  return { isServiceOwner, serviceOwnerImmutable: allowEmail };
}

export async function listUsersForServiceOwnerAdmin(): Promise<AdminUserListRow[]> {
  const sql = getSql();
  const rows = await sql`
    SELECT u.id AS id, u.email AS email, u.name AS name,
           u."emailVerified" AS "emailVerified",
           u."createdAt"::text AS "createdAt"
    FROM "user" u
    ORDER BY u."createdAt" DESC
  `;
  const adminRows = await sql`
    SELECT user_id FROM service_admins
  `;
  const inDb = new Set(
    adminRows.map((r) => String((r as { user_id: unknown }).user_id ?? "")).filter(Boolean)
  );
  const envIds = parseAdminUserIdsEnvLocal();

  return rows.map((r: Record<string, unknown>) => {
    const id = String(r.id);
    const email = String(r.email ?? "");
    const dbMember = inDb.has(id);
    const { isServiceOwner, serviceOwnerImmutable } = effectiveServiceOwner(id, email, dbMember, envIds);
    return {
      id,
      email,
      name: String(r.name ?? ""),
      emailVerified: Boolean(r.emailVerified),
      createdAt: String(r.createdAt ?? ""),
      isServiceOwner,
      dbServiceOwner: dbMember,
      serviceOwnerImmutable: serviceOwnerImmutable,
      operatorViaEnvUserId: envIds.has(id),
    };
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
    const userRows = await sql`
      SELECT email FROM "user" WHERE id = ${targetUserId} LIMIT 1
    `;
    if (!Array.isArray(userRows) || userRows.length === 0) {
      return { ok: false, code: "not_found", message: "User not found." };
    }
    const targetEmail =
      userRows[0] && typeof (userRows[0] as { email?: string }).email === "string"
        ? (userRows[0] as { email: string }).email
        : null;

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
