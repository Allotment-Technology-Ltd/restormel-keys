/**
 * Service operators (internal): not end-customers; exempt from plan limits for dogfooding.
 *
 * **Preferred:** Neon Auth / Better Auth **role** on the session (`user.role` from `get-session`) —
 * set the user to **admin** (or `service_admin` / `operator` / `superadmin`) in the Neon Auth console so
 * `resolveServiceAdminStatus` picks it up without DB edits or env churn.
 *
 * Fallback order: session role → `RESTORMEL_SERVICE_ADMIN_USER_IDS` → `RESTORMEL_SERVICE_OWNER_EMAILS`
 * (or built-in defaults when that env is unset) → `service_admins` row.
 *
 * Never log raw session payloads; do not treat this as customer RBAC for multi-tenant end users.
 */
import { neon } from "@neondatabase/serverless";

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

/** Primary operator emails when RESTORMEL_SERVICE_OWNER_EMAILS is not set (GitHub may return either Gmail alias). */
const DEFAULT_SERVICE_OWNER_EMAILS = ["adam.boon1984@gmail.com", "adam.boon1984@googlemail.com"] as const;

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

export function normalizeEmailForServiceOwnerMatch(email: string | null | undefined): string | null {
  if (!email || typeof email !== "string") return null;
  const t = email.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

function parseServiceOwnerEmailSet(): Set<string> {
  const raw = process.env.RESTORMEL_SERVICE_OWNER_EMAILS;
  if (raw === undefined) {
    return new Set(
      DEFAULT_SERVICE_OWNER_EMAILS.map((e) => normalizeEmailForServiceOwnerMatch(e)).filter(
        (e): e is string => e != null
      )
    );
  }
  if (!raw.trim()) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s) => normalizeEmailForServiceOwnerMatch(s))
      .filter((e): e is string => e != null)
  );
}

/** True when the sign-in email is on the service-owner allowlist (env or defaults). */
export function emailImpliesServiceOwner(email: string | null | undefined): boolean {
  const n = normalizeEmailForServiceOwnerMatch(email);
  if (!n) return false;
  return parseServiceOwnerEmailSet().has(n);
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
 * Whether this Better Auth user is a service operator for limit bypass and admin UI.
 */
export async function resolveServiceAdminStatus(
  userId: string,
  sessionRole?: string | null,
  email?: string | null
): Promise<boolean> {
  if (!userId) return false;
  if (roleImpliesServiceAdmin(sessionRole)) return true;
  if (parseAdminUserIdsEnv().has(userId)) return true;
  if (emailImpliesServiceOwner(email)) return true;
  return isServiceAdminUserIdInDb(userId);
}

/** Ensures allowlisted service-owner emails get a service_admins row (for auditing and UI toggles). */
export async function syncServiceOwnerBootstrap(userId: string, email: string | null | undefined): Promise<void> {
  if (!userId || !emailImpliesServiceOwner(email)) return;
  try {
    const sql = getSql();
    const now = Date.now();
    await sql`
      INSERT INTO service_admins (user_id, note, created_at)
      VALUES (${userId}, ${"bootstrap:service_owner_email"}, ${now})
      ON CONFLICT (user_id) DO NOTHING
    `;
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === "42P01") return;
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[service-admin] bootstrap sync failed:", msg.slice(0, 80));
  }
}
