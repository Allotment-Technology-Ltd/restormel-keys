import {
  getOrCreateDefaultWorkspace,
  getWorkspace,
  downgradeWorkspaceIfProExpired,
} from "$lib/server/db";

export type WorkspacePlan = "free" | "pro";

export type WorkspaceEntitlements = {
  workspaceId: string;
  /** Billing / stored tier after expiry downgrade */
  plan: WorkspacePlan;
  projectLimit: number;
  monthlyRequestLimit: number;
  /** Pro access from founding promo until this time (ms); null if not time-limited Pro */
  foundingProExpiresAt: number | null;
};

const FREE = {
  projectLimit: 2,
  monthlyRequestLimit: 1_000,
};

const PRO = {
  projectLimit: 10,
  monthlyRequestLimit: 100_000,
};

export async function getWorkspaceEntitlements(locals: App.Locals): Promise<WorkspaceEntitlements | null> {
  const uid = locals.user?.uid;
  if (!uid) return null;
  const ws = await getOrCreateDefaultWorkspace(uid);
  await downgradeWorkspaceIfProExpired(ws.id);
  const hydrated = await getWorkspace(ws.id);
  const plan = hydrated?.plan ?? ws.plan ?? "free";
  const expiresAt = hydrated?.planExpiresAt ?? ws.planExpiresAt ?? null;
  const now = Date.now();
  const effectivePro =
    plan === "pro" &&
    (expiresAt == null || expiresAt <= 0 || expiresAt > now);
  const tier = effectivePro ? PRO : FREE;
  const foundingProExpiresAt =
    effectivePro && expiresAt != null && expiresAt > now ? expiresAt : null;

  return {
    workspaceId: ws.id,
    plan: effectivePro ? "pro" : "free",
    projectLimit: tier.projectLimit,
    monthlyRequestLimit: tier.monthlyRequestLimit,
    foundingProExpiresAt,
  };
}
