/**
 * Per-user memoization of the post-session work `hooks.server.ts` runs on EVERY request:
 * service-admin status, founders-circle status, and the idempotent bootstrap syncs
 * (service_admins row, founders approval row, users upsert).
 *
 * Before this cache a single authenticated request paid up to 4 sequential Neon
 * round-trips in hooks alone — including every 1.5s run-console status poll (F8) —
 * and from a mis-pinned function region each round-trip was ~80ms (see
 * docs/reviews/dashboard-latency-taskforce-2026-06.md).
 *
 * Semantics preserved:
 * - status reads are cached for 30s, aligned with the existing 20s session cache
 *   (`auth.ts SESSION_CACHE_MS`) and 30s workspace cache (`workspace-cache.ts`);
 *   an admin/founders grant has always been able to lag by the session cache TTL.
 * - the bootstrap syncs are idempotent bookkeeping writes (`ON CONFLICT` upserts);
 *   they run once per (uid, email, role) per process instead of once per request.
 * - a failed founders lookup (`null`) is NOT cached, so transient DB errors keep
 *   the existing per-request fail-open behavior instead of sticking for the TTL.
 */
import {
  resolveServiceAdminStatus,
  syncServiceOwnerBootstrap,
} from "$lib/server/service-admin";
import {
  isFoundersCircleApproved,
  syncFoundersAccessForServiceOwner,
} from "$lib/server/founders-access";
import { upsertUser } from "$lib/server/db";

export type SessionAuthContext = {
  isServiceAdmin: boolean;
  /** Raw lookup result — `null` means the lookup failed (hooks treats that as fail-open). */
  foundersCircleApproved: boolean | null;
};

export type SessionAuthDeps = {
  resolveServiceAdminStatus: typeof resolveServiceAdminStatus;
  isFoundersCircleApproved: typeof isFoundersCircleApproved;
  syncServiceOwnerBootstrap: typeof syncServiceOwnerBootstrap;
  syncFoundersAccessForServiceOwner: typeof syncFoundersAccessForServiceOwner;
  upsertUser: typeof upsertUser;
};

const defaultDeps: SessionAuthDeps = {
  resolveServiceAdminStatus,
  isFoundersCircleApproved,
  syncServiceOwnerBootstrap,
  syncFoundersAccessForServiceOwner,
  upsertUser,
};

export const SESSION_AUTH_CACHE_MS = 30_000;
const MAX_ENTRIES = 1000;

type Entry = { at: number; value: SessionAuthContext };
const statusCache = new Map<string, Entry>();
/** Idempotent bootstrap writes — once per (uid,email,role) per process. */
const bootstrapSynced = new Set<string>();

function cacheKey(uid: string, email: string | null, role: string | null): string {
  return `${uid}\0${email ?? ""}\0${role ?? ""}`;
}

/** Test/admin hook — drop cached status (all users when uid omitted). */
export function invalidateSessionAuthCache(uid?: string): void {
  if (uid == null) {
    statusCache.clear();
    bootstrapSynced.clear();
    return;
  }
  const prefix = `${uid}\0`;
  for (const key of [...statusCache.keys()]) {
    if (key.startsWith(prefix)) statusCache.delete(key);
  }
  for (const key of [...bootstrapSynced]) {
    if (key.startsWith(prefix)) bootstrapSynced.delete(key);
  }
}

function evictIfFull(): void {
  if (statusCache.size < MAX_ENTRIES) return;
  const oldest = statusCache.keys().next().value;
  if (oldest !== undefined) statusCache.delete(oldest);
}

async function runBootstrapSyncs(
  key: string,
  uid: string,
  email: string | null,
  deps: SessionAuthDeps
): Promise<void> {
  if (bootstrapSynced.has(key)) return;
  bootstrapSynced.add(key);
  try {
    await deps.syncServiceOwnerBootstrap(uid, email);
    await deps.syncFoundersAccessForServiceOwner(email);
    await deps.upsertUser(uid, email);
  } catch (e) {
    // Same handling hooks.server.ts had inline: log and continue — but retry next request.
    bootstrapSynced.delete(key);
    const msg = e instanceof Error ? e.message : "";
    if (msg) console.error("[db] upsertUser:", msg.slice(0, 100));
  }
}

/**
 * Resolve service-admin + founders status for a session user, memoized per instance.
 * Also runs the once-per-process bootstrap syncs that previously ran on every request.
 */
export async function resolveSessionAuthContext(
  params: { uid: string; email: string | null; role: string | null },
  deps: SessionAuthDeps = defaultDeps
): Promise<SessionAuthContext> {
  const { uid, email, role } = params;
  const key = cacheKey(uid, email, role);

  const hit = statusCache.get(key);
  if (hit && Date.now() - hit.at < SESSION_AUTH_CACHE_MS) {
    return hit.value;
  }

  const isServiceAdmin = await deps.resolveServiceAdminStatus(uid, role, email);
  const foundersCircleApproved = await deps.isFoundersCircleApproved(email);
  const value: SessionAuthContext = { isServiceAdmin, foundersCircleApproved };

  // Don't cache failed founders lookups — keep per-request fail-open retry behavior.
  if (foundersCircleApproved !== null) {
    evictIfFull();
    statusCache.set(key, { at: Date.now(), value });
  }

  await runBootstrapSyncs(key, uid, email, deps);

  return value;
}
