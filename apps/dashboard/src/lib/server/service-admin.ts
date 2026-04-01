/**
 * Service operators (internal): not end-customers; exempt from plan limits for dogfooding.
 * Sources (first match wins): session role "admin", RESTORMEL_SERVICE_ADMIN_USER_IDS, service_admins row.
 * Never log raw session payloads; do not treat this as customer RBAC for multi-tenant end users.
 */
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

function parseAdminUserIdsEnv(): Set<string> {
  const raw = (process.env.RESTORMEL_SERVICE_ADMIN_USER_IDS ?? "").trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function roleImpliesServiceAdmin(role: string | null | undefined): boolean {
  if (!role || typeof role !== "string") return false;
  const n = role.trim().toLowerCase();
  return n === "admin" || n === "superadmin" || n === "service_admin" || n === "operator";
}

export async function isServiceAdminUserIdInDb(userId: string): Promise<boolean> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT 1 AS ok FROM service_admins WHERE user_id = ${userId} LIMIT 1
    `;
    return Array.isArray(rows) && rows.length > 0;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return false;
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[service-admin] lookup failed:", msg.slice(0, 80));
    return false;
  }
}

/**
 * Whether this Better Auth user is a service operator for limit bypass.
 */
export async function resolveServiceAdminStatus(
  userId: string,
  sessionRole?: string | null
): Promise<boolean> {
  if (!userId) return false;
  if (roleImpliesServiceAdmin(sessionRole)) return true;
  if (parseAdminUserIdsEnv().has(userId)) return true;
  return isServiceAdminUserIdInDb(userId);
}
