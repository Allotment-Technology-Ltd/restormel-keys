import { getOrCreateDefaultWorkspace, getWorkspace } from "$lib/server/db";

export type WorkspacePlan = "free" | "pro";

export type WorkspaceEntitlements = {
  workspaceId: string;
  plan: WorkspacePlan;
  projectLimit: number;
  monthlyRequestLimit: number;
};

/** Free tier: 2 projects so builders can add e.g. a dogfood/eval project without upgrading. */
const FREE: Omit<WorkspaceEntitlements, "workspaceId"> = {
  plan: "free",
  projectLimit: 2,
  monthlyRequestLimit: 1_000,
};

const PRO: Omit<WorkspaceEntitlements, "workspaceId"> = {
  plan: "pro",
  projectLimit: 10,
  monthlyRequestLimit: 100_000,
};

export async function getWorkspaceEntitlements(locals: App.Locals): Promise<WorkspaceEntitlements | null> {
  const uid = locals.user?.uid;
  if (!uid) return null;
  const ws = await getOrCreateDefaultWorkspace(uid);
  const hydrated = await getWorkspace(ws.id);
  const plan = hydrated?.plan ?? ws.plan ?? "free";
  const tier = plan === "pro" ? PRO : FREE;
  return { workspaceId: ws.id, ...tier };
}

