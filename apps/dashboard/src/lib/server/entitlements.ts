import {
  getOrCreateDefaultWorkspace,
  getWorkspace,
  downgradeWorkspaceIfProExpired,
  getAuthUserSignupRank,
  foundingPromoMaxUsers,
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
  /** True when user is inside founder cohort (first N users), always Pro regardless subscription. */
  isFounderUser: boolean;
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
  const signupRank = await getAuthUserSignupRank(uid);
  const founderCap = foundingPromoMaxUsers();
  const isFounderUser = founderCap > 0 && signupRank != null && signupRank <= founderCap;
  const effectivePro =
    isFounderUser || (plan === "pro" && (expiresAt == null || expiresAt <= 0 || expiresAt > now));
  const tier = effectivePro ? PRO : FREE;
  const foundingProExpiresAt =
    !isFounderUser && effectivePro && expiresAt != null && expiresAt > now ? expiresAt : null;

  return {
    workspaceId: ws.id,
    plan: effectivePro ? "pro" : "free",
    projectLimit: tier.projectLimit,
    monthlyRequestLimit: tier.monthlyRequestLimit,
    foundingProExpiresAt,
    isFounderUser,
  };
}
