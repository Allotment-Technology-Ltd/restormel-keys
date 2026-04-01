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
  /** Internal operator: subscription-style limits waived (dogfooding). */
  isServiceAdmin: boolean;
};

const FREE = {
  projectLimit: 2,
  monthlyRequestLimit: 1_000,
};

const PRO = {
  projectLimit: 10,
  monthlyRequestLimit: 100_000,
};

/** Internal operators: high caps so resolve/project APIs do not throttle dogfood traffic. */
const SERVICE_ADMIN = {
  projectLimit: 999,
  monthlyRequestLimit: 10_000_000,
};

export async function getWorkspaceEntitlements(locals: App.Locals): Promise<WorkspaceEntitlements | null> {
  const uid = locals.user?.uid;
  if (!uid) return null;
  const isServiceAdmin = locals.user?.isServiceAdmin === true;
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
    isServiceAdmin ||
    isFounderUser ||
    (plan === "pro" && (expiresAt == null || expiresAt <= 0 || expiresAt > now));
  const tier = isServiceAdmin ? SERVICE_ADMIN : effectivePro ? PRO : FREE;
  const foundingProExpiresAt =
    !isFounderUser && !isServiceAdmin && effectivePro && expiresAt != null && expiresAt > now ? expiresAt : null;

  return {
    workspaceId: ws.id,
    plan: effectivePro ? "pro" : "free",
    projectLimit: tier.projectLimit,
    monthlyRequestLimit: tier.monthlyRequestLimit,
    foundingProExpiresAt,
    isFounderUser,
    isServiceAdmin,
  };
}
